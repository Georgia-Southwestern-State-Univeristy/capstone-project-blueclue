-- ============================================================================
-- Migration 025: Add Full-Text Search to Knowledge Base
-- ============================================================================
-- This migration adds PostgreSQL full-text search capabilities to the
-- knowledge_articles table for improved search performance
-- ============================================================================

-- Add tsvector column for full-text search
ALTER TABLE knowledge_articles 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION kb_article_search_vector_update() 
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(NEW.tags)), ' '
        ), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS kb_article_search_vector_trigger ON knowledge_articles;
CREATE TRIGGER kb_article_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, content, excerpt, category, tags
    ON knowledge_articles
    FOR EACH ROW
    EXECUTE FUNCTION kb_article_search_vector_update();

-- Update existing articles to populate search_vector
UPDATE knowledge_articles 
SET search_vector = 
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(
        ARRAY(SELECT jsonb_array_elements_text(tags)), ' '
    ), '')), 'B')
WHERE search_vector IS NULL;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_kb_articles_search_vector 
ON knowledge_articles USING GIN(search_vector);

-- Create additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_kb_articles_category 
ON knowledge_articles(category) 
WHERE deleted_at IS NULL AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_kb_articles_difficulty 
ON knowledge_articles(difficulty) 
WHERE deleted_at IS NULL AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_kb_articles_tags 
ON knowledge_articles USING GIN(tags)
WHERE deleted_at IS NULL AND is_published = true;

-- Create index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_kb_articles_popularity 
ON knowledge_articles(views DESC, helpful_votes DESC) 
WHERE deleted_at IS NULL AND is_published = true;

-- Create index for recent articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_recent 
ON knowledge_articles(published_at DESC) 
WHERE deleted_at IS NULL AND is_published = true;

COMMENT ON COLUMN knowledge_articles.search_vector IS 'Full-text search vector with weighted content (A=title, B=excerpt/category/tags, C=content)';
COMMENT ON INDEX idx_kb_articles_search_vector IS 'GIN index for full-text search performance';

-- Grant permissions
GRANT SELECT ON knowledge_articles TO PUBLIC;
