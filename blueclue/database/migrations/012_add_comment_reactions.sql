-- Migration 012: Add Comment Reactions
-- Date: 2026-02-24
-- Description: Add support for emoji reactions on ticket comments

-- ============================================================================
-- TABLE: comment_reactions
-- ============================================================================
-- Stores emoji reactions on comments (helpful, thumbs up, etc.)

CREATE TABLE IF NOT EXISTS comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_emoji CHECK (emoji IN ('👍', '❤️', '😊', '🎉', '✅', '👏')),
    CONSTRAINT unique_user_comment_emoji UNIQUE (comment_id, user_id, emoji)
);

-- Indexes
CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON comment_reactions TO blueclue_app;
GRANT USAGE, SELECT ON SEQUENCE comment_reactions_id_seq TO blueclue_app;

-- Add comment count to comments (for caching reaction counts)
ALTER TABLE ticket_comments 
ADD COLUMN IF NOT EXISTS reaction_count JSONB DEFAULT '{}'::jsonb;

COMMENT ON TABLE comment_reactions IS 'Stores emoji reactions on ticket comments';
COMMENT ON COLUMN comment_reactions.emoji IS 'Emoji character for the reaction';
COMMENT ON COLUMN ticket_comments.reaction_count IS 'Cached count of reactions by emoji type';
