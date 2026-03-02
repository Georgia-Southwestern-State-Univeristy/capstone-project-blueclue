-- ============================================================================
-- Migration 019: Knowledge Base System
-- ============================================================================
-- Description: Creates knowledge base tables for storing support articles,
--              FAQs, and documentation that can be used by customers and
--              the chatbot AI assistant
-- Date: 2026-02-26
-- Safe to run multiple times: Yes (uses IF NOT EXISTS checks)
-- ============================================================================

-- Create ENUM type for article difficulty levels
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_difficulty') THEN
        CREATE TYPE article_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
        RAISE NOTICE 'Created article_difficulty ENUM type';
    ELSE
        RAISE NOTICE 'article_difficulty ENUM type already exists, skipping';
    END IF;
END $$;

-- ============================================================================
-- TABLE: knowledge_articles
-- ============================================================================
-- Stores support articles, FAQs, and documentation

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Supports markdown and HTML
    category VARCHAR(100) NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb, -- Array of tag strings for flexible categorization
    difficulty article_difficulty DEFAULT 'beginner',
    
    -- Visibility and publishing
    is_public BOOLEAN NOT NULL DEFAULT true, -- Customer-visible articles
    is_published BOOLEAN NOT NULL DEFAULT false, -- Draft vs published state
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Analytics and engagement metrics
    views INTEGER NOT NULL DEFAULT 0,
    helpful_votes INTEGER NOT NULL DEFAULT 0,
    not_helpful_votes INTEGER NOT NULL DEFAULT 0,
    
    -- Authorship and timestamps
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at TIMESTAMP WITH TIME ZONE, -- Track when article was last reviewed for accuracy
    
    -- SEO and metadata
    slug VARCHAR(300) UNIQUE, -- URL-friendly version of title
    excerpt TEXT, -- Short summary for previews (max 300 chars recommended)
    meta_description VARCHAR(160), -- SEO description
    
    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT category_not_empty CHECK (LENGTH(TRIM(category)) > 0),
    CONSTRAINT votes_non_negative CHECK (helpful_votes >= 0 AND not_helpful_votes >= 0),
    CONSTRAINT views_non_negative CHECK (views >= 0),
    CONSTRAINT published_consistency CHECK (
        (is_published = true AND published_at IS NOT NULL) OR
        (is_published = false)
    )
);

-- Indexes for knowledge_articles
CREATE INDEX IF NOT EXISTS idx_kb_title ON knowledge_articles(title);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_kb_is_public ON knowledge_articles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_kb_is_published ON knowledge_articles(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_kb_created_by ON knowledge_articles(created_by);
CREATE INDEX IF NOT EXISTS idx_kb_created_at ON knowledge_articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_published_at ON knowledge_articles(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_slug ON knowledge_articles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_difficulty ON knowledge_articles(difficulty);
CREATE INDEX IF NOT EXISTS idx_kb_not_deleted ON knowledge_articles(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kb_deleted_at ON knowledge_articles(deleted_at) WHERE deleted_at IS NOT NULL;

-- GIN index for JSONB tags for fast tag searches
CREATE INDEX IF NOT EXISTS idx_kb_tags ON knowledge_articles USING GIN (tags);

-- Full-text search index on title and content
CREATE INDEX IF NOT EXISTS idx_kb_fulltext ON knowledge_articles 
USING GIN (to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || content));

-- Composite index for common query patterns (public + published articles)
CREATE INDEX IF NOT EXISTS idx_kb_public_published ON knowledge_articles(is_public, is_published, published_at DESC)
WHERE is_public = true AND is_published = true AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: article_feedback
-- ============================================================================
-- Tracks user feedback on knowledge base articles

CREATE TABLE IF NOT EXISTS article_feedback (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Nullable for guest feedback
    was_helpful BOOLEAN NOT NULL,
    feedback TEXT, -- Optional written feedback from users
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate votes from same user on same article
    CONSTRAINT unique_user_article_feedback UNIQUE (article_id, user_id)
);

-- Indexes for article_feedback
CREATE INDEX IF NOT EXISTS idx_feedback_article ON article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON article_feedback(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON article_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_helpful ON article_feedback(article_id, was_helpful);

-- ============================================================================
-- TRIGGER: Update knowledge_articles.updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_knowledge_articles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_knowledge_articles_timestamp'
    ) THEN
        CREATE TRIGGER trigger_update_knowledge_articles_timestamp
            BEFORE UPDATE ON knowledge_articles
            FOR EACH ROW
            EXECUTE FUNCTION update_knowledge_articles_timestamp();
        RAISE NOTICE 'Created trigger for knowledge_articles updated_at';
    ELSE
        RAISE NOTICE 'Trigger for knowledge_articles already exists';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER: Auto-set published_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION set_published_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- When article is being published, set published_at if not already set
    IF NEW.is_published = true AND NEW.published_at IS NULL THEN
        NEW.published_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- When article is published for first time after being draft, update timestamp
    IF TG_OP = 'UPDATE' AND NEW.is_published = true AND OLD.is_published = false THEN
        NEW.published_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- If unpublishing, keep the original published_at for historical reference
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_set_published_at'
    ) THEN
        CREATE TRIGGER trigger_set_published_at
            BEFORE INSERT OR UPDATE ON knowledge_articles
            FOR EACH ROW
            EXECUTE FUNCTION set_published_at_timestamp();
        RAISE NOTICE 'Created trigger for auto-setting published_at';
    ELSE
        RAISE NOTICE 'Trigger for published_at already exists';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER: Update article vote counts when feedback is added
-- ============================================================================

CREATE OR REPLACE FUNCTION update_article_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment appropriate vote counter
        IF NEW.was_helpful = true THEN
            UPDATE knowledge_articles 
            SET helpful_votes = helpful_votes + 1 
            WHERE id = NEW.article_id;
        ELSE
            UPDATE knowledge_articles 
            SET not_helpful_votes = not_helpful_votes + 1 
            WHERE id = NEW.article_id;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- If vote changed, decrement old and increment new
        IF OLD.was_helpful != NEW.was_helpful THEN
            IF OLD.was_helpful = true THEN
                UPDATE knowledge_articles 
                SET helpful_votes = helpful_votes - 1,
                    not_helpful_votes = not_helpful_votes + 1
                WHERE id = NEW.article_id;
            ELSE
                UPDATE knowledge_articles 
                SET helpful_votes = helpful_votes + 1,
                    not_helpful_votes = not_helpful_votes - 1
                WHERE id = NEW.article_id;
            END IF;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement appropriate counter
        IF OLD.was_helpful = true THEN
            UPDATE knowledge_articles 
            SET helpful_votes = helpful_votes - 1 
            WHERE id = OLD.article_id;
        ELSE
            UPDATE knowledge_articles 
            SET not_helpful_votes = not_helpful_votes - 1 
            WHERE id = OLD.article_id;
        END IF;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_article_votes_on_feedback'
    ) THEN
        CREATE TRIGGER trigger_update_article_votes_on_feedback
            AFTER INSERT OR UPDATE OR DELETE ON article_feedback
            FOR EACH ROW
            EXECUTE FUNCTION update_article_votes();
        RAISE NOTICE 'Created trigger for auto-updating article votes';
    ELSE
        RAISE NOTICE 'Trigger for article votes already exists';
    END IF;
END $$;

-- ============================================================================
-- VIEWS: Useful queries for the knowledge base
-- ============================================================================

-- View for published public articles (most common query)
CREATE OR REPLACE VIEW public_knowledge_articles AS
SELECT 
    id,
    title,
    slug,
    excerpt,
    category,
    tags,
    difficulty,
    views,
    helpful_votes,
    not_helpful_votes,
    CASE 
        WHEN (helpful_votes + not_helpful_votes) > 0 
        THEN ROUND((helpful_votes::DECIMAL / (helpful_votes + not_helpful_votes)) * 100, 1)
        ELSE NULL
    END as helpfulness_percentage,
    published_at,
    last_reviewed_at
FROM knowledge_articles
WHERE is_public = true 
  AND is_published = true 
  AND deleted_at IS NULL
ORDER BY published_at DESC;

-- View for article statistics
CREATE OR REPLACE VIEW article_statistics AS
SELECT 
    ka.id,
    ka.title,
    ka.category,
    ka.views,
    ka.helpful_votes,
    ka.not_helpful_votes,
    (ka.helpful_votes + ka.not_helpful_votes) as total_votes,
    CASE 
        WHEN (ka.helpful_votes + ka.not_helpful_votes) > 0 
        THEN ROUND((ka.helpful_votes::DECIMAL / (ka.helpful_votes + ka.not_helpful_votes)) * 100, 1)
        ELSE 0
    END as helpfulness_percentage,
    COUNT(af.id) as feedback_count,
    COUNT(CASE WHEN af.feedback IS NOT NULL AND af.feedback != '' THEN 1 END) as written_feedback_count,
    u.first_name || ' ' || u.last_name as author_name,
    ka.created_at,
    ka.published_at,
    ka.last_reviewed_at
FROM knowledge_articles ka
LEFT JOIN article_feedback af ON ka.id = af.article_id
LEFT JOIN users u ON ka.created_by = u.id
WHERE ka.deleted_at IS NULL
GROUP BY ka.id, u.first_name, u.last_name
ORDER BY ka.views DESC;

-- ============================================================================
-- COMMENTS: Document the schema
-- ============================================================================

COMMENT ON TABLE knowledge_articles IS 'Stores support articles, FAQs, and documentation for customers and chatbot';
COMMENT ON COLUMN knowledge_articles.content IS 'Article content in markdown or HTML format';
COMMENT ON COLUMN knowledge_articles.tags IS 'JSONB array of tags for flexible categorization and search';
COMMENT ON COLUMN knowledge_articles.is_public IS 'Whether article is visible to customers (vs internal-only)';
COMMENT ON COLUMN knowledge_articles.is_published IS 'Whether article is published (false = draft)';
COMMENT ON COLUMN knowledge_articles.slug IS 'URL-friendly version of title for SEO (e.g., how-to-reset-password)';
COMMENT ON COLUMN knowledge_articles.excerpt IS 'Short summary for article previews and search results';
COMMENT ON COLUMN knowledge_articles.last_reviewed_at IS 'Last time article was reviewed for accuracy and relevance';

COMMENT ON TABLE article_feedback IS 'User feedback and votes on knowledge base articles';
COMMENT ON COLUMN article_feedback.was_helpful IS 'Whether user found the article helpful (true) or not helpful (false)';
COMMENT ON COLUMN article_feedback.feedback IS 'Optional written feedback from the user';

-- ============================================================================
-- FUNCTION: Search knowledge base articles
-- ============================================================================

CREATE OR REPLACE FUNCTION search_knowledge_articles(
    search_query TEXT,
    filter_category VARCHAR DEFAULT NULL,
    filter_difficulty article_difficulty DEFAULT NULL,
    public_only BOOLEAN DEFAULT true,
    limit_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    id INTEGER,
    title VARCHAR,
    slug VARCHAR,
    excerpt TEXT,
    category VARCHAR,
    difficulty article_difficulty,
    views INTEGER,
    helpful_votes INTEGER,
    not_helpful_votes INTEGER,
    helpfulness_percentage NUMERIC,
    relevance_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ka.id,
        ka.title,
        ka.slug,
        ka.excerpt,
        ka.category,
        ka.difficulty,
        ka.views,
        ka.helpful_votes,
        ka.not_helpful_votes,
        CASE 
            WHEN (ka.helpful_votes + ka.not_helpful_votes) > 0 
            THEN ROUND((ka.helpful_votes::DECIMAL / (ka.helpful_votes + ka.not_helpful_votes)) * 100, 1)
            ELSE NULL
        END as helpfulness_percentage,
        ts_rank(
            to_tsvector('english', ka.title || ' ' || COALESCE(ka.excerpt, '') || ' ' || ka.content),
            plainto_tsquery('english', search_query)
        ) as relevance_rank
    FROM knowledge_articles ka
    WHERE ka.deleted_at IS NULL
      AND (NOT public_only OR ka.is_public = true)
      AND ka.is_published = true
      AND (filter_category IS NULL OR ka.category = filter_category)
      AND (filter_difficulty IS NULL OR ka.difficulty = filter_difficulty)
      AND (
          to_tsvector('english', ka.title || ' ' || COALESCE(ka.excerpt, '') || ' ' || ka.content) 
          @@ plainto_tsquery('english', search_query)
      )
    ORDER BY relevance_rank DESC, ka.views DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_knowledge_articles IS 'Full-text search for knowledge base articles with optional filters';

-- ============================================================================
-- Sample Data (Optional - for development/testing)
-- ============================================================================

-- Insert sample categories and articles if admin user exists
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    -- Find an admin or management user to be the article author
    SELECT id INTO admin_user_id FROM users WHERE role IN ('admin', 'management') LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert sample articles
        INSERT INTO knowledge_articles (
            title, content, category, tags, difficulty, is_public, is_published, 
            slug, excerpt, created_by
        ) VALUES
        (
            'How to Reset Your Password',
            E'# How to Reset Your Password\n\n## Steps:\n1. Click "Forgot Password" on the login page\n2. Enter your email address\n3. Check your email for a reset link\n4. Click the link and enter your new password\n5. Log in with your new credentials\n\n**Note:** Password reset links expire after 24 hours.',
            'Account Management',
            '["password", "reset", "login", "account"]'::jsonb,
            'beginner',
            true,
            true,
            'how-to-reset-password',
            'Learn how to reset your password if you''ve forgotten it or need to change it for security reasons.',
            admin_user_id
        ),
        (
            'Understanding Ticket Priority Levels',
            E'# Understanding Ticket Priority Levels\n\n## Priority Levels:\n\n### Critical\nSystem-wide outages or security breaches. Response time: < 1 hour\n\n### High\nSignificant business impact affecting multiple users. Response time: < 4 hours\n\n### Medium\nModerate impact on productivity. Response time: < 24 hours\n\n### Low\nMinor issues or feature requests. Response time: < 72 hours',
            'Using the System',
            '["priority", "tickets", "sla", "response-time"]'::jsonb,
            'beginner',
            true,
            true,
            'understanding-ticket-priority-levels',
            'Learn about the different ticket priority levels and their expected response times.',
            admin_user_id
        ),
        (
            'Advanced Search Techniques',
            E'# Advanced Search Techniques\n\n## Search Operators:\n\n- **Exact phrase:** Use quotes, e.g., `"network error"`\n- **Exclude terms:** Use minus sign, e.g., `-password`\n- **OR operator:** `email OR notification`\n- **Category filter:** `category:billing`\n- **Date range:** `created:2026-01-01..2026-12-31`\n\n## Tips:\n- Search is case-insensitive\n- Partial matches are supported\n- Combine operators for precise results',
            'Using the System',
            '["search", "advanced", "tips", "operators"]'::jsonb,
            'advanced',
            true,
            true,
            'advanced-search-techniques',
            'Master advanced search operators and techniques to find exactly what you need quickly.',
            admin_user_id
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Inserted sample knowledge base articles';
    ELSE
        RAISE NOTICE 'No admin user found, skipping sample articles';
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
DECLARE
    article_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO article_count FROM knowledge_articles;
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Knowledge Base Migration Complete';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables created: knowledge_articles, article_feedback';
    RAISE NOTICE 'Views created: public_knowledge_articles, article_statistics';
    RAISE NOTICE 'Function created: search_knowledge_articles()';
    RAISE NOTICE 'Current article count: %', article_count;
    RAISE NOTICE '============================================================================';
END $$;
