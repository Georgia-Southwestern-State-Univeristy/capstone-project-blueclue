import { useState, useEffect, useCallback } from 'react';

/**
 * useChatStore — Persistent chat state across page navigation.
 *
 * Stores messages, open/closed state, and unread count in sessionStorage
 * so they survive React-Router navigations. Provides a `clearChat()` method
 * that should be called on logout.
 *
 * Keys used in sessionStorage:
 *  - blueclue_chat_messages
 *  - blueclue_chat_open
 *  - blueclue_chat_unread
 */

const STORAGE_KEYS = {
  MESSAGES: 'blueclue_chat_messages',
  OPEN: 'blueclue_chat_open',
  UNREAD: 'blueclue_chat_unread',
};

const WELCOME_MESSAGE = {
  id: 1,
  sender: 'bot',
  text: "Hi! I'm the BlueClue Assistant. How can I help you today?",
  timestamp: new Date().toISOString(),
};

function loadJSON(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function useChatStore() {
  const [messages, setMessages] = useState(() =>
    loadJSON(STORAGE_KEYS.MESSAGES, [WELCOME_MESSAGE]),
  );
  const [isOpen, setIsOpen] = useState(() =>
    loadJSON(STORAGE_KEYS.OPEN, false),
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    loadJSON(STORAGE_KEYS.UNREAD, 0),
  );
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // ── Persist on change ──────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.OPEN, JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.UNREAD, JSON.stringify(unreadCount));
  }, [unreadCount]);

  // ── Actions ────────────────────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    const message = {
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    };
    setMessages((prev) => [...prev, message]);

    // If it's a bot message and chat is closed, bump unread
    if (msg.sender === 'bot') {
      setHasNewMessage(true);
      // Auto-clear the "new message" animation flag after 3s
      setTimeout(() => setHasNewMessage(false), 3000);

      // Only bump unread when chat is closed
      setUnreadCount((prev) => {
        const currentlyOpen = loadJSON(STORAGE_KEYS.OPEN, false);
        return currentlyOpen ? 0 : prev + 1;
      });
    }
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    setHasNewMessage(false);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        setHasNewMessage(false);
      }
      return next;
    });
  }, []);

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setIsOpen(false);
    setUnreadCount(0);
    setHasNewMessage(false);
    sessionStorage.removeItem(STORAGE_KEYS.MESSAGES);
    sessionStorage.removeItem(STORAGE_KEYS.OPEN);
    sessionStorage.removeItem(STORAGE_KEYS.UNREAD);
  }, []);

  return {
    messages,
    isOpen,
    unreadCount,
    hasNewMessage,
    addMessage,
    setMessages,
    openChat,
    closeChat,
    toggleChat,
    clearChat,
  };
}

export default useChatStore;
