-- =============================================================================
-- Migration 039: Section-level chunk embeddings for the RAG pipeline
-- =============================================================================
-- Adds the `article_chunks` table to support sub-article embedding granularity.
-- Each row represents one section/window of a KB article with its own embedding
-- vector, enabling higher-precision retrieval for long multi-section articles.
--
-- Usage:
--   psql "${DATABASE_URL}" -f 039_add_article_chunks.sql
--
-- After applying: re-run the embeddings script with the new chunk mode:
--   python blueclue/ai/generate_embeddings.py --chunk-mode section [--force]
--
-- The rag_pipeline automatically falls back to full-article search when this
-- table is empty or absent (controlled by RAG_CHUNK_MODE env var).
-- =============================================================================

-- 1. article_chunks -----------------------------------------------------------
--    One row per section/window per KB article.
--    embedding      = 1536-dim (OpenAI ada-002 / text-embedding-3-small)
--    embedding_384  = 384-dim  (sentence-transformers/all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS article_chunks (
  id               SERIAL PRIMARY KEY,
  article_id       INTEGER      NOT NULL
                     REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  chunk_index      SMALLINT     NOT NULL DEFAULT 0,      -- 0-based order within article
  section_heading  VARCHAR(255),                         -- markdown heading text, or 'Chunk N'
  chunk_text       TEXT         NOT NULL,                -- raw section body (stored for display)
  embedding        FLOAT[],                              -- 1536-dim OpenAI / 3-small vector
  embedding_384    FLOAT[],                              -- 384-dim MiniLM fallback vector
  embedding_model  VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
  embedding_text   TEXT,                                 -- text that was actually embedded
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_article_chunks_article_idx UNIQUE (article_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS article_chunks_article_id_idx
  ON article_chunks (article_id);

-- 2. Keep updated_at current --------------------------------------------------
-- Reuse the set_updated_at() function created in migration 029 if it exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'set_updated_at'
  ) THEN
    CREATE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_article_chunks_updated_at ON article_chunks;
CREATE TRIGGER trg_article_chunks_updated_at
  BEFORE UPDATE ON article_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Coverage view extension --------------------------------------------------
--    Drop and recreate the coverage view to include chunk count per article.
DROP VIEW IF EXISTS kb_embedding_coverage;
CREATE VIEW kb_embedding_coverage AS
SELECT
  ka.id,
  ka.title,
  ka.category,
  ka.is_published,
  ka.is_public,
  ae.embedding_model                                      AS full_article_model,
  ae.updated_at                                           AS last_full_embedded,
  COUNT(ac.id)                                            AS chunk_count,
  MAX(ac.updated_at)                                      AS last_chunk_embedded,
  CASE WHEN ae.id IS NULL THEN 'missing' ELSE 'ok' END    AS full_article_status,
  CASE WHEN COUNT(ac.id) = 0 THEN 'missing' ELSE 'ok' END AS chunk_status
FROM  knowledge_articles ka
LEFT  JOIN article_embeddings ae ON ae.article_id = ka.id
LEFT  JOIN article_chunks ac     ON ac.article_id = ka.id
WHERE ka.deleted_at IS NULL
GROUP BY ka.id, ka.title, ka.category, ka.is_published, ka.is_public,
         ae.id, ae.embedding_model, ae.updated_at;
