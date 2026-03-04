-- Migration 030: Chat tech mode, handoff, file attachments, analytics
-- ====================================================================

-- Add tech_mode flag to chat_conversations
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS chat_mode VARCHAR(20) NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_claimed_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS handoff_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_resolved_at TIMESTAMPTZ;

-- Add attachment fields to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER;

-- Track feedback on article suggestion cards (ticket prevention)
CREATE TABLE IF NOT EXISTS chat_article_suggestion_events (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticket_id        INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  article_id       INTEGER REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  description_text TEXT,
  action           VARCHAR(30) NOT NULL, -- 'shown', 'clicked', 'dismissed', 'ticket_cancelled'
  ab_group         CHAR(1)    NOT NULL DEFAULT 'A', -- A = shown suggestions, B = control
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_user_id     ON chat_article_suggestion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_case_article_id  ON chat_article_suggestion_events(article_id);
CREATE INDEX IF NOT EXISTS idx_case_created_at  ON chat_article_suggestion_events(created_at);

-- Index for chat analytics queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created ON chat_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_mode    ON chat_conversations(chat_mode);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created      ON chat_messages(created_at);
