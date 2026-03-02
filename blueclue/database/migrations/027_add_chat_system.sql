-- Migration: Add chat system tables
-- Version: 2.5.0
-- Date: 2026-03-02
-- Description: Creates tables for AI chatbot conversations and message history

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    was_helpful BOOLEAN,
    created_ticket INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'bot')),
    message TEXT NOT NULL,
    intent VARCHAR(100),
    confidence DECIMAL(5,4),
    suggested_articles JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_suggested_articles ON chat_messages USING GIN (suggested_articles);

-- Add comments
COMMENT ON TABLE chat_conversations IS 'Stores chat conversation sessions between users and the AI bot';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat conversations';
COMMENT ON COLUMN chat_conversations.was_helpful IS 'User rating of whether the conversation was helpful';
COMMENT ON COLUMN chat_conversations.created_ticket IS 'Optional link to ticket if chat resulted in ticket creation';
COMMENT ON COLUMN chat_messages.intent IS 'Detected user intent from intent recognition';
COMMENT ON COLUMN chat_messages.confidence IS 'Confidence score of intent detection (0.0-1.0)';
COMMENT ON COLUMN chat_messages.suggested_articles IS 'JSON array of knowledge base article IDs suggested by bot';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_conversations_updated_at();
