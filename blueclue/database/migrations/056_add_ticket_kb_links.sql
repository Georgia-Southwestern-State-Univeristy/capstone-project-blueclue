-- ============================================================================
-- Migration 056: Ticket Knowledge Base Article Links
-- ============================================================================
-- Description: Creates a junction table linking tickets to knowledge base
--              articles. Used for:
--              1. Associating KB articles when a ticket is marked resolved
--              2. Powering the "Similar Resolved Tickets" feature in the
--                 ticket expanded view
-- Date: 2026-04-25
-- Safe to run multiple times: Yes (uses IF NOT EXISTS checks)
-- ============================================================================

-- ============================================================================
-- TABLE: ticket_kb_articles
-- ============================================================================
-- Links tickets to one or more knowledge base articles.
-- is_resolution_article = true when the article was explicitly linked during
-- the "mark as resolved" workflow.

CREATE TABLE IF NOT EXISTS ticket_kb_articles (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_resolution_article BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT uq_ticket_article UNIQUE (ticket_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_kb_ticket_id  ON ticket_kb_articles(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_kb_article_id ON ticket_kb_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_ticket_kb_resolution ON ticket_kb_articles(ticket_id)
    WHERE is_resolution_article = true;
