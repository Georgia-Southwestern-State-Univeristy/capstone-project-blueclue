-- =============================================================================
-- Migration 029: RAG (Retrieval-Augmented Generation) tables
-- =============================================================================
-- Uses FLOAT[] arrays for embedding storage — no pgvector extension required.
-- Cosine similarity is computed in Python by the RAG pipeline.
-- Safe to re-run (all statements use IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- 1. Article embeddings -------------------------------------------------------
--    Stores a float array per KB article.
--    embedding      = 1536-dim (OpenAI text-embedding-ada-002)
--    embedding_384  = 384-dim  (sentence-transformers/all-MiniLM-L6-v2 fallback)
--    embedding_model identifies which model produced the vector.
CREATE TABLE IF NOT EXISTS article_embeddings (
  id                SERIAL PRIMARY KEY,
  article_id        INTEGER NOT NULL,
  embedding         FLOAT[],              -- OpenAI ada-002 / 1536-dim
  embedding_384     FLOAT[],              -- MiniLM fallback / 384-dim
  embedding_model   VARCHAR(100)  NOT NULL DEFAULT 'text-embedding-ada-002',
  embedding_text    TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_article_embeddings_article UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS article_embeddings_article_idx
  ON article_embeddings (article_id);

-- 3. LLM response cache -------------------------------------------------------
--    Caches (query_hash → LLM answer) to avoid redundant API calls.
--    Entries auto-expire after 1 hour (cleaned up by a cron job).
CREATE TABLE IF NOT EXISTS llm_response_cache (
  id            SERIAL PRIMARY KEY,
  query_hash    VARCHAR(64)  NOT NULL UNIQUE,  -- SHA-256 of normalised query
  query_text    TEXT         NOT NULL,
  response_text TEXT         NOT NULL,
  article_ids   INTEGER[]    DEFAULT '{}',
  model_used    VARCHAR(100),
  prompt_tokens INTEGER      DEFAULT 0,
  completion_tokens INTEGER  DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS llm_cache_hash_idx    ON llm_response_cache (query_hash);
CREATE INDEX IF NOT EXISTS llm_cache_expires_idx ON llm_response_cache (expires_at);

-- 4. LLM usage tracking -------------------------------------------------------
--    Per-request token/cost log for spend monitoring and alerting.
CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  conversation_id      INTEGER,
  prompt_tokens        INTEGER      NOT NULL DEFAULT 0,
  completion_tokens    INTEGER      NOT NULL DEFAULT 0,
  total_tokens         INTEGER      NOT NULL DEFAULT 0,
  model_used           VARCHAR(100),
  cost_usd             NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms           INTEGER,
  rag_articles_used    INTEGER      NOT NULL DEFAULT 0,
  cache_hit            BOOLEAN      NOT NULL DEFAULT FALSE,
  fallback_used        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS llm_usage_user_idx ON llm_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS llm_usage_date_idx ON llm_usage_logs (created_at);

-- 5. Trigger: keep updated_at current on article_embeddings ------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_article_embeddings_updated_at ON article_embeddings;
CREATE TRIGGER trg_article_embeddings_updated_at
  BEFORE UPDATE ON article_embeddings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Helper view: embedding coverage ------------------------------------------
CREATE OR REPLACE VIEW kb_embedding_coverage AS
SELECT
  ka.id,
  ka.title,
  ka.category,
  ka.is_published,
  ka.is_public,
  ae.embedding_model,
  ae.updated_at AS last_embedded,
  CASE WHEN ae.id IS NULL THEN 'missing' ELSE 'ok' END AS status
FROM  knowledge_articles ka
LEFT  JOIN article_embeddings ae ON ae.article_id = ka.id
WHERE ka.deleted_at IS NULL;
