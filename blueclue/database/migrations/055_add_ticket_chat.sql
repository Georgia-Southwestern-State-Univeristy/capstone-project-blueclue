-- Migration: Add ticket chat system
-- Allows clients to request a private chat with the assigned technician on a ticket

-- Add notification type for ticket chat requests
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_chat_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_chat_accepted';

-- Ticket chat sessions
CREATE TABLE IF NOT EXISTS ticket_chats (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tech_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'closed')),
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_active_ticket_chat UNIQUE (ticket_id)
);

-- Ticket chat messages
CREATE TABLE IF NOT EXISTS ticket_chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES ticket_chats(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (LENGTH(message) > 0 AND LENGTH(message) <= 5000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_chats_ticket_id ON ticket_chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_tech_id ON ticket_chats(tech_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_status ON ticket_chats(status);
CREATE INDEX IF NOT EXISTS idx_ticket_chat_messages_chat_id ON ticket_chat_messages(chat_id);
