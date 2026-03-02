import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// useChatStore – persistent chat state (sessionStorage-backed)
// ============================================================================

const STORAGE_KEYS = {
  MESSAGES: 'blueclue_chat_messages',
  OPEN: 'blueclue_chat_open',
  UNREAD: 'blueclue_chat_unread',
  CONVERSATION_ID: 'blueclue_chat_conversation_id',
}

const readJSON = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'bot',
  text: "Hi! I'm the BlueClue Assistant. How can I help you today?",
  timestamp: new Date().toISOString(),
}

export default function useChatStore() {
  const [messages, setMessages] = useState(() => readJSON(STORAGE_KEYS.MESSAGES, [WELCOME_MESSAGE]))
  const [isOpen, setIsOpen] = useState(() => readJSON(STORAGE_KEYS.OPEN, false))
  const [unreadCount, setUnreadCount] = useState(() => readJSON(STORAGE_KEYS.UNREAD, 0))
  const [conversationId, setConversationId] = useState(() => readJSON(STORAGE_KEYS.CONVERSATION_ID, null))
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const newMessageTimer = useRef(null)

  // Persist to sessionStorage whenever values change
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages)) }, [messages])
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.OPEN, JSON.stringify(isOpen)) }, [isOpen])
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.UNREAD, JSON.stringify(unreadCount)) }, [unreadCount])
  useEffect(() => {
    if (conversationId !== null) {
      sessionStorage.setItem(STORAGE_KEYS.CONVERSATION_ID, JSON.stringify(conversationId))
    }
  }, [conversationId])

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg])

    // If chat is closed and it's a bot message, bump unread
    setUnreadCount((prev) => {
      // We read isOpen from sessionStorage to avoid stale closure
      const open = readJSON(STORAGE_KEYS.OPEN, false)
      if (!open && msg.sender === 'bot') return prev + 1
      return prev
    })

    // Flash "new message" dot for 3 seconds
    if (msg.sender === 'bot') {
      setHasNewMessage(true)
      clearTimeout(newMessageTimer.current)
      newMessageTimer.current = setTimeout(() => setHasNewMessage(false), 3000)
    }
  }, [])

  const openChat = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) setUnreadCount(0)
      return next
    })
  }, [])

  const updateConversationId = useCallback((id) => {
    setConversationId(id)
  }, [])

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
    setIsOpen(false)
    setUnreadCount(0)
    setConversationId(null)
    setHasNewMessage(false)
    Object.values(STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k))
  }, [])

  return {
    messages,
    isOpen,
    unreadCount,
    hasNewMessage,
    conversationId,
    addMessage,
    setMessages,
    openChat,
    closeChat,
    toggleChat,
    updateConversationId,
    clearChat,
  }
}
