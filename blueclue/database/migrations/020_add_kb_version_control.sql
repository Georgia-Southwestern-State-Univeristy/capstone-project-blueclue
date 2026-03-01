-- ============================================================================
-- Migration 020: Knowledge Base Version Control
-- ============================================================================
-- Description: Adds version control for knowledge base articles to track
--              all changes, who made them, and allow reverting to previous versions
-- Date: 2026-02-26
-- Safe to run multiple times: Yes (uses IF NOT EXISTS checks)
-- ============================================================================

-- ============================================================================
-- TABLE: article_versions
-- ============================================================================
-- Stores complete history of all article changes

CREATE TABLE IF NOT EXISTS article_versions (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL, -- Incremental version number per article
    
    -- Snapshot of article content at this version
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    difficulty article_difficulty,
    excerpt TEXT,
    slug VARCHAR(300),
    meta_description VARCHAR(160),
    
    -- Publishing state at this version
    is_public BOOLEAN NOT NULL,
    is_published BOOLEAN NOT NULL,
    
    -- Change tracking
    edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    change_summary TEXT, -- Brief description of what changed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_article_version UNIQUE (article_id, version_number),
    CONSTRAINT version_number_positive CHECK (version_number > 0)
);

-- Indexes for article_versions
CREATE INDEX IF NOT EXISTS idx_versions_article ON article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_versions_article_version ON article_versions(article_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_versions_edited_by ON article_versions(edited_by);
CREATE INDEX IF NOT EXISTS idx_versions_created_at ON article_versions(created_at DESC);

COMMENT ON TABLE article_versions IS 'Complete history of all article changes for version control and audit trail';
COMMENT ON COLUMN article_versions.version_number IS 'Incremental version number per article (1, 2, 3, ...)';
COMMENT ON COLUMN article_versions.change_summary IS 'Brief description of changes made in this version';

-- ============================================================================
-- TABLE: knowledge_categories
-- ============================================================================
-- Manage categories separately for better organization

CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Icon identifier for UI
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes for knowledge_categories
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON knowledge_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_categories_sort ON knowledge_categories(sort_order, name);

-- Insert default categories
INSERT INTO knowledge_categories (name, display_name, description, icon, sort_order) VALUES
    ('account-management', 'Account Management', 'Account setup, password resets, profile management', '👤', 1),
    ('using-the-system', 'Using the System', 'How to create tickets, navigate the interface, use features', '🎯', 2),
    ('troubleshooting', 'Troubleshooting', 'Common issues and how to resolve them', '🔧', 3),
    ('technical-guides', 'Technical Guides', 'In-depth technical documentation', '📚', 4),
    ('faqs', 'FAQs', 'Frequently asked questions', '❓', 5),
    ('policies', 'Policies', 'Company policies, SLAs, terms of service', '📋', 6)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE knowledge_categories IS 'Organized categories for knowledge base articles';

-- ============================================================================
-- TRIGGER: Auto-create version when article is updated
-- ============================================================================

CREATE OR REPLACE FUNCTION create_article_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    -- Get the next version number for this article
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO next_version
    FROM article_versions 
    WHERE article_id = NEW.id;
    
    -- Create version snapshot (only if content actually changed)
    IF TG_OP = 'UPDATE' AND (
        OLD.title != NEW.title OR 
        OLD.content != NEW.content OR
        OLD.category != NEW.category OR
        OLD.tags::text != NEW.tags::text OR
        OLD.difficulty != NEW.difficulty OR
        OLD.is_published != NEW.is_published OR
        OLD.is_public != NEW.is_public
    ) THEN
        INSERT INTO article_versions (
            article_id, version_number, title, content, category, tags,
            difficulty, excerpt, slug, meta_description, is_public, is_published,
            edited_by, change_summary
        ) VALUES (
            NEW.id, next_version, NEW.title, NEW.content, NEW.category, NEW.tags,
            NEW.difficulty, NEW.excerpt, NEW.slug, NEW.meta_description, 
            NEW.is_public, NEW.is_published,
            COALESCE(NEW.updated_by, NEW.created_by), -- Use updated_by if available
            'Auto-saved version' -- Can be overridden by application
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_by column to track who made the last edit
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE knowledge_articles
        ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added updated_by column to knowledge_articles';
    ELSE
        RAISE NOTICE 'Column updated_by already exists';
    END IF;
END $$;

-- Create trigger for auto-versioning
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_create_article_version'
    ) THEN
        CREATE TRIGGER trigger_create_article_version
            AFTER INSERT OR UPDATE ON knowledge_articles
            FOR EACH ROW
            EXECUTE FUNCTION create_article_version();
        RAISE NOTICE 'Created trigger for auto-versioning articles';
    ELSE
        RAISE NOTICE 'Trigger for article versioning already exists';
    END IF;
END $$;

-- ============================================================================
-- VIEWS: Version control queries
-- ============================================================================

-- View for article version history
CREATE OR REPLACE VIEW article_version_history AS
SELECT 
    av.id,
    av.article_id,
    av.version_number,
    av.title,
    av.change_summary,
    av.is_published,
    av.created_at as version_created_at,
    u.first_name || ' ' || u.last_name as edited_by_name,
    u.email as edited_by_email,
    ka.title as current_title,
    CASE 
        WHEN av.version_number = (
            SELECT MAX(version_number) 
            FROM article_versions av2 
            WHERE av2.article_id = av.article_id
        ) THEN true
        ELSE false
    END as is_latest_version
FROM article_versions av
JOIN users u ON av.edited_by = u.id
JOIN knowledge_articles ka ON av.article_id = ka.id
WHERE ka.deleted_at IS NULL
ORDER BY av.article_id, av.version_number DESC;

COMMENT ON VIEW article_version_history IS 'Article version history with editor information';

-- ============================================================================
-- FUNCTION: Restore article to previous version
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_article_version(
    p_article_id INTEGER,
    p_version_number INTEGER,
    p_restored_by INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_version RECORD;
BEGIN
    -- Get the version to restore
    SELECT * INTO v_version
    FROM article_versions
    WHERE article_id = p_article_id 
      AND version_number = p_version_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Version % not found for article %', p_version_number, p_article_id;
    END IF;
    
    -- Update the article with the version data
    UPDATE knowledge_articles
    SET 
        title = v_version.title,
        content = v_version.content,
        category = v_version.category,
        tags = v_version.tags,
        difficulty = v_version.difficulty,
        excerpt = v_version.excerpt,
        slug = v_version.slug,
        meta_description = v_version.meta_description,
        is_public = v_version.is_public,
        is_published = v_version.is_published,
        updated_by = p_restored_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_article_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION restore_article_version IS 'Restore an article to a previous version';

-- ============================================================================
-- Analytics View: Article Management Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW kb_management_stats AS
SELECT 
    (SELECT COUNT(*) FROM knowledge_articles WHERE deleted_at IS NULL) as total_articles,
    (SELECT COUNT(*) FROM knowledge_articles WHERE is_published = true AND deleted_at IS NULL) as published_articles,
    (SELECT COUNT(*) FROM knowledge_articles WHERE is_published = false AND deleted_at IS NULL) as draft_articles,
    (SELECT COUNT(*) FROM knowledge_articles WHERE is_public = true AND is_published = true AND deleted_at IS NULL) as public_articles,
    (SELECT COUNT(DISTINCT category) FROM knowledge_articles WHERE deleted_at IS NULL) as total_categories,
    (SELECT SUM(views) FROM knowledge_articles WHERE deleted_at IS NULL) as total_views,
    (SELECT SUM(helpful_votes) FROM knowledge_articles WHERE deleted_at IS NULL) as total_helpful_votes,
    (SELECT COUNT(*) FROM article_feedback) as total_feedback_submitted,
    (SELECT COUNT(*) FROM article_versions) as total_versions_saved;

COMMENT ON VIEW kb_management_stats IS 'Summary statistics for knowledge base management dashboard';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
DECLARE
    version_count INTEGER;
    category_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO version_count FROM article_versions;
    SELECT COUNT(*) INTO category_count FROM knowledge_categories;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Knowledge Base Version Control Migration Complete';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables created: article_versions, knowledge_categories';
    RAISE NOTICE 'Views created: article_version_history, kb_management_stats';
    RAISE NOTICE 'Function created: restore_article_version()';
    RAISE NOTICE 'Categories created: %', category_count;
    RAISE NOTICE 'Version records: %', version_count;
    RAISE NOTICE '============================================================================';
END $$;
