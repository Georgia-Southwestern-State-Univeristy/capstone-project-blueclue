import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { logout, isAuthenticated, getUser } from '../services/authService'
import { ThemeContext } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'
import NotificationDropdown from './NotificationDropdown'
import ChatWidgetButton from './ChatWidgetButton'
import ChatWindow from './ChatWindow'
import SettingsSidebar from './SettingsSidebar'
import TicketDetailView from './TicketDetailView'
import ProfileDetailView from './ProfileDetailView'
import { getUserById } from '../services/userService'
import TicketFromChatModal from './TicketFromChatModal'
import useChatStore from '../hooks/useChatStore'
import { requestNotificationPermission } from '../utils/chatNotifications'
import { sendChatMessage, sendTechChatMessage, submitChatFeedback, submitConversationSurvey, clearChatHistory, createTicketFromChat, requestChatHandoff, uploadChatFile } from '../services/chatService'
import ConversationSurveyModal from './ConversationSurveyModal'
import { getSocket } from '../services/socketService'
import logo from '../assets/EditedBlueClueLogo.png'

// ── Module-level constants (stable refs, safe to use in useCallback deps) ──
const RESOLVED_PHRASES = [
  /^thanks?\b/i, /^thank you\b/i, /\bthat (fixed|worked|solved|helped|did it)\b/i,
  /\bproblem (solved|fixed|resolved)\b/i, /\bissue (solved|fixed|resolved)\b/i,
  /\ball (good|set|sorted)\b/i, /\bthat'?s? (all|it|good)\b/i,
  /\bgot it\b/i, /\bnever mind\b/i, /\bno more (help|questions)\b/i,
  /\bi'?m good\b/i, /\bperfect\b/i,
]
const isResolutionMessage = (text) =>
  RESOLVED_PHRASES.some((re) => re.test(text.trim()))

const WRAP_UP_BUTTONS = [
  { id: 'ask_another', label: 'Ask another question', primary: false },
  { id: 'end_chat',    label: 'End chat',             primary: true  },
]

function Navbar() {
  const navigate = useNavigate()
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [ticketDetailId, setTicketDetailId] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [handoffStatus, setHandoffStatus] = useState(null) // null | 'requested' | 'claimed'
  const [ticketFromChatOpen, setTicketFromChatOpen] = useState(false)
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveyShownForConvId, setSurveyShownForConvId] = useState(null)
  const [dmProfileUser, setDmProfileUser] = useState(null)

  // Persistent chat state
  const chat = useChatStore()
  const conversationIdRef = useRef(null)
  const [conversationId, setConversationId] = useState(null)
  const [ticketDetailOpen, setTicketDetailOpen] = useState(false)
  const notificationDropdownRef = useRef(null)
  const notificationBellRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const toolsDropdownRef = useRef(null)
  const authenticated = isAuthenticated()
  const user = getUser()

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
       if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false)
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false)
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target)) {
        setToolsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Socket: listen for tech_reply / handoff_resolved / chat_claimed ──
  useEffect(() => {
    if (!authenticated) return
    const socket = getSocket()
    if (!socket) return

    const handleTechReply = (data) => {
      chat.addMessage({
        id: data.messageId ?? Date.now(),
        sender: 'bot',
        text: `**${data.techName || 'Technician'}:** ${data.message}`,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      })
      setHandoffStatus('claimed')
    }

    const handleHandoffResolved = () => {
      setHandoffStatus(null)
      chat.addMessage({
        id: Date.now(),
        sender: 'bot',
        text: 'The technician has closed this chat session. If your issue persists, please open a new support ticket.',
        timestamp: new Date(),
        actionButtons: [{ id: 'create_ticket', label: 'Create a Ticket', primary: true }],
      })
    }

    const handleChatClaimed = (data) => {
      setHandoffStatus('claimed')
      chat.addMessage({
        id: Date.now(),
        sender: 'bot',
        text: `**${data.techName || 'A technician'}** has joined the chat! How can they help you?`,
        timestamp: new Date(),
      })
    }

    socket.on('tech_reply', handleTechReply)
    socket.on('handoff_resolved', handleHandoffResolved)
    socket.on('chat_claimed', handleChatClaimed)

    return () => {
      socket.off('tech_reply', handleTechReply)
      socket.off('handoff_resolved', handleHandoffResolved)
      socket.off('chat_claimed', handleChatClaimed)
    }
  }, [authenticated, chat])

  // Send a message — branches between customer and tech mode
  const handleChatSend = useCallback(async (text) => {
    requestNotificationPermission()
    chat.addMessage({ id: Date.now(), sender: 'user', text, timestamp: new Date() })

    // ── Intercept special quick-reply labels — handle locally, never hit backend ──
    if (chat.chatMode !== 'tech') {
      // "✅ This helped" → positive feedback + wrap-up (non-repeatable: suggestions are cleared)
      if (text === '✅ This helped') {
        setSuggestions(null)
        const lastBotMsg = [...chat.messages].reverse().find(m => m.sender === 'bot')
        if (lastBotMsg?.id) {
          submitChatFeedback(lastBotMsg.id, true).catch(() => {})
        }
        setTimeout(() => {
          chat.addMessage({
            id: Date.now() + 1,
            sender: 'bot',
            text: "Great! Is there anything else I can help with?",
            timestamp: new Date(),
            actionButtons: WRAP_UP_BUTTONS,
          })
        }, 300)
        return
      }

      // "❌ Still not working" → offer ticket / rephrase
      if (text === '❌ Still not working') {
        setSuggestions(null)
        setTimeout(() => {
          chat.addMessage({
            id: Date.now() + 1,
            sender: 'bot',
            text: "I'm sorry to hear that. Let me help you with more options:",
            timestamp: new Date(),
            actionButtons: [
              { id: 'create_ticket', label: '🎫 Create a support ticket', primary: true },
              { id: 'ask_another',   label: 'Rephrase my question',       primary: false },
            ],
          })
        }, 300)
        return
      }

      // "Create a support ticket" quick reply → trigger action directly
      if (text === 'Create a support ticket') {
        setSuggestions(null)
        setIsTyping(true)
        createTicketFromChat(conversationIdRef.current)
          .then(result => {
            setIsTyping(false)
            chat.addMessage({
              id: Date.now(),
              sender: 'bot',
              text: result.message || `Ticket ${result.ticketNumber} created. A technician will respond soon.`,
              timestamp: new Date(),
              actionButtons: [{ id: 'view_tickets', label: 'View my tickets', primary: false }],
            })
          })
          .catch(() => {
            setIsTyping(false)
            chat.addMessage({
              id: Date.now(),
              sender: 'bot',
              text: "Sorry, I couldn't create the ticket automatically. Please visit the Client Dashboard to submit one.",
              timestamp: new Date(),
            })
          })
        return
      }
    }

    // Gratitude / resolution detected — reply locally without hitting the AI
    if (chat.chatMode !== 'tech' && isResolutionMessage(text)) {
      setSuggestions(null)
      setTimeout(() => {
        chat.addMessage({
          id: Date.now() + 1,
          sender: 'bot',
          text: "Glad I could help! 😊 Is there anything else you'd like to do?",
          timestamp: new Date(),
          actionButtons: WRAP_UP_BUTTONS,
        })
      }, 300)
      return
    }

    setIsTyping(true)
    setSuggestions(null)

    try {
      const isTech = chat.chatMode === 'tech'
      const data = isTech
        ? await sendTechChatMessage(text, conversationIdRef.current)
        : await sendChatMessage(text, conversationIdRef.current)

      conversationIdRef.current = data.conversationId ?? conversationIdRef.current
      setConversationId(conversationIdRef.current)
      setIsTyping(false)

      if (!isTech && data.suggestions?.length) {
        setSuggestions(data.suggestions.map((s) => ({ label: s, value: s })))
      } else {
        setSuggestions(null)
      }

      chat.addMessage({
        id: data.messageId ?? Date.now() + 1,
        sender: 'bot',
        text: data.response,
        timestamp: new Date(),
        articleLinks: data.articleLinks?.length ? data.articleLinks : undefined,
        actionButtons: data.actionButtons?.length ? data.actionButtons : undefined,
      })

      // Auto-handoff: low confidence after 5+ exchanges — suggest human tech
      if (data.suggestHandoff && handoffStatus === null) {
        setTimeout(() => {
          chat.addMessage({
            id: Date.now() + 2,
            sender: 'bot',
            text: "It looks like I haven't been able to fully resolve your issue. Would you like me to connect you with a live technician?",
            timestamp: new Date(),
            actionButtons: [{ id: 'request_handoff', label: 'Talk to a Technician', primary: true }],
          })
        }, 600)
      }
    } catch (err) {
      setIsTyping(false)
      chat.addMessage({
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      })
      console.error('Chat error:', err)
    }
  }, [chat, handoffStatus])

  // Request human handoff
  const handleHandoff = useCallback(async () => {
    if (!conversationIdRef.current) {
      // No conversation started yet — action button from a stale/persisted session
      chat.addMessage({
        id: Date.now(),
        sender: 'bot',
        text: "Please send a message first so I can connect you with a technician.",
        timestamp: new Date(),
      })
      return
    }
    setHandoffStatus('requested')
    try {
      await requestChatHandoff(conversationIdRef.current)
    } catch (err) {
      console.error('Handoff request error:', err)
      setHandoffStatus(null)
      // Inform user of the failure
      chat.addMessage({
        id: Date.now(),
        sender: 'bot',
        text: "Sorry, I couldn't connect you to a technician right now. Please try again or submit a support ticket from your dashboard.",
        timestamp: new Date(),
      })
    }
  }, [chat])

  // File upload in chat
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > 5) {
      chat.addMessage({ id: Date.now(), sender: 'bot', text: 'File too large (max 5 MB).', timestamp: new Date() })
      return
    }
    chat.addMessage({ id: Date.now(), sender: 'user', text: `${file.name}`, timestamp: new Date() })
    try {
      const result = await uploadChatFile(file, conversationIdRef.current)
      conversationIdRef.current = result.conversationId ?? conversationIdRef.current
      setConversationId(conversationIdRef.current)
      chat.addMessage({
        id: Date.now() + 1,
        sender: 'bot',
        text: result.message || 'File received.',
        timestamp: new Date(),
      })
    } catch (err) {
      chat.addMessage({ id: Date.now() + 1, sender: 'bot', text: 'Upload failed. Please try again.', timestamp: new Date() })
      console.error('File upload error:', err)
    }
  }, [chat])

  // Handle action buttons embedded in bot messages
  const handleActionButton = useCallback(async (buttonId) => {
    if (buttonId === 'ask_another') {
      chat.newConversation()
      setSuggestions(null)
      return
    }
    if (buttonId === 'end_chat') {
      // Show feedback survey when there was a real conversation, otherwise close directly
      const hasUserMessages = chat.messages.some(m => m.sender === 'user')
      if (hasUserMessages && conversationId && conversationId !== surveyShownForConvId) {
        setShowSurvey(true)
      } else {
        chat.closeChat()
      }
      return
    }
    if (buttonId === 'request_handoff') {
      handleHandoff()
      return
    }
    if (buttonId === 'create_ticket') {
      setIsTyping(true)
      setSuggestions(null)
      try {
        const result = await createTicketFromChat(conversationIdRef.current)
        setIsTyping(false)
        chat.addMessage({
          id: Date.now(),
          sender: 'bot',
          text: result.message || `Ticket ${result.ticketNumber} created. A technician will respond soon.`,
          timestamp: new Date(),
          actionButtons: [
            { id: 'view_tickets', label: 'View my tickets', primary: false },
          ],
        })
      } catch (err) {
        setIsTyping(false)
        chat.addMessage({
          id: Date.now(),
          sender: 'bot',
          text: 'Sorry, I couldn\'t create the ticket automatically. Please visit the Client Dashboard to submit one.',
          timestamp: new Date(),
        })
        console.error('Create ticket from chat error:', err)
      }
    } else if (buttonId === 'view_tickets') {
      navigate('/client-dashboard')
      chat.closeChat()
    } else if (buttonId.startsWith('view_ticket_')) {
      const ticketId = parseInt(buttonId.replace('view_ticket_', ''), 10)
      if (ticketId) {
        setTicketDetailId(ticketId)
        setTicketDetailOpen(true)
      }
    }
  }, [chat, navigate, handleHandoff, conversationId, surveyShownForConvId])

  // Close chat — show survey first if there was a real user↔bot exchange
  const handleCloseChat = useCallback(() => {
    const hasUserMessages = chat.messages.some(m => m.sender === 'user')
    if (hasUserMessages && conversationId && conversationId !== surveyShownForConvId) {
      setShowSurvey(true)
    } else {
      chat.closeChat()
    }
  }, [chat, conversationId, surveyShownForConvId])

  // Survey submit — save response then close
  const handleSurveySubmit = useCallback(async (surveyData) => {
    setSurveyShownForConvId(conversationId)
    setShowSurvey(false)
    try {
      await submitConversationSurvey(conversationId, surveyData)
    } catch (err) {
      console.error('Survey submit error:', err)
    }
    chat.closeChat()
  }, [conversationId, chat])

  // Survey skip — just close
  const handleSurveySkip = useCallback(() => {
    setSurveyShownForConvId(conversationId)
    setShowSurvey(false)
    chat.closeChat()
  }, [conversationId, chat])

  // Feedback handler — sends rating + optional reason/details to backend
  const handleChatFeedback = useCallback(async (messageId, rating, feedbackDetails = {}) => {
    try {
      const helpful = rating === 'positive'
      await submitChatFeedback(
        messageId,
        helpful,
        feedbackDetails?.text || '',
        feedbackDetails?.reason || null,
      )
    } catch (err) {
      console.error('Feedback error:', err)
    }

    // After a thumbs-up, show wrap-up options instead of waiting for more input
    if (rating === 'positive') {
      setTimeout(() => {
        chat.addMessage({
          id: Date.now(),
          sender: 'bot',
          text: "Great! Is there anything else I can help with?",
          timestamp: new Date(),
          actionButtons: [
            { id: 'ask_another', label: 'Ask another question', primary: false },
            { id: 'end_chat',    label: 'End chat',             primary: true  },
          ],
        })
      }, 200)
    }
  }, [chat])

  const { resetTheme } = useContext(ThemeContext)

  const handleLogout = async () => {
    try {
      if (conversationIdRef.current) {
        await clearChatHistory(conversationIdRef.current)
      }
    } catch {
      // silently ignore — logout should always proceed
    }
    conversationIdRef.current = null
    setConversationId(null)
    setSuggestions(null)
    setShowSurvey(false)
    setSurveyShownForConvId(null)
    chat.clearChat()
    await logout()
    resetTheme()
    navigate('/login')
  }

  const handleLogoClick = () => {
    if (authenticated) {
      navigate('/welcome')
    } else {
      navigate('/login')
    }
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        {/* Logo + Desktop Nav */}
        <div className="flex items-center gap-4 md:gap-10">
          <button onClick={handleLogoClick} className="hover:opacity-80 transition-opacity flex-shrink-0">
            <img src={logo} alt="BlueClue Logo" className="h-10 md:h-16" />
          </button>
          <div className="hidden md:block h-8 w-px bg-gray-700"></div>
          <div className="hidden md:flex items-center gap-8">
            {authenticated && (
              <>
                {user?.role === 'customer' && (
                  <>
                    <Link to="/client-dashboard" className="text-gray-300 hover:text-white transition-colors">
                      Client Dashboard
                    </Link>
                    <Link to="/faq" className="text-gray-300 hover:text-white transition-colors">
                      Help Center
                    </Link>
                  </>
                )}
                {['technician', 'senior_technician', 'admin'].includes(user?.role) && (
                  <>
                    <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">
                      Dashboard
                    </Link>
                    {/* Knowledge Base only shown here if NOT also management/admin (avoid duplicate) */}
                    {user?.role !== 'management' && user?.role !== 'admin' && (
                      <Link to="/knowledge-base" className="text-gray-300 hover:text-white transition-colors">
                        Knowledge Base
                      </Link>
                    )}
                  </>
                )}
                {(user?.role === 'management' || user?.role === 'admin') && (
                  <>
                    <Link to="/management-dashboard" className="text-gray-300 hover:text-white transition-colors">
                      Dashboard
                    </Link>
                    <Link to="/analytics" className="text-gray-300 hover:text-white transition-colors">
                      Analytics
                    </Link>
                    {/* Tools dropdown for less-frequent management links */}
                    <div className="relative" ref={toolsDropdownRef}>
                      <button
                        onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                        className="text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                      >
                        Tools
                        <svg className={`w-3.5 h-3.5 transition-transform ${toolsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {toolsDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                          <Link
                            to="/knowledge-base"
                            onClick={() => setToolsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          >
                            Knowledge Base
                          </Link>
                          <Link
                            to="/template-manager"
                            onClick={() => setToolsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          >
                            Templates
                          </Link>
                          <Link
                            to="/technician-management"
                            onClick={() => setToolsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          >
                            Technician Management
                          </Link>
                          <Link
                            to="/ml-admin"
                            onClick={() => setToolsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          >
                            ML Dashboard
                          </Link>
                          <Link
                            to="/chat-analytics"
                            onClick={() => setToolsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          >
                            Chat Analytics
                          </Link>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {/* Analytics for technicians (management/admin already have it above) */}
                {['technician', 'senior_technician'].includes(user?.role) && (
                  <Link to="/analytics" className="text-gray-300 hover:text-white transition-colors">
                    Analytics
                  </Link>
                )}
                {['technician', 'senior_technician', 'management', 'admin'].includes(user?.role) && (
                  <Link to="/directory" className="text-gray-300 hover:text-white transition-colors">
                    Staff/Client Directory
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authenticated ? (
            <>
              {/* Logged In User Info */}
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-300">
                <span>{user?.firstName || user?.fullName || user?.username || 'User'}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 capitalize">{user?.role || 'User'}</span>
              </div>



            {/* Notification Bell & Dropdown */}
              <div className="relative" ref={notificationDropdownRef}>
                <NotificationBell 
                  ref={notificationBellRef}
                  onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)} 
                />
                <NotificationDropdown 
                  isOpen={notificationDropdownOpen}
                  onClose={() => setNotificationDropdownOpen(false)}
                  onNotificationUpdate={() => {
                    // Refresh the bell's unread count
                    if (notificationBellRef.current?.refresh) {
                      notificationBellRef.current.refresh();
                    }
                  }}
                  onTicketClick={(ticketId) => {
                    setTicketDetailId(ticketId);
                    setTicketDetailOpen(true);
                  }}
                  onDirectMessageClick={async (senderId) => {
                    try {
                      const user = await getUserById(senderId);
                      setDmProfileUser(user);
                    } catch (err) {
                      console.error('Failed to load sender profile:', err);
                    }
                  }}
                />
              </div>

              {/* Settings Gear Button */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Profile Icon + Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                  title="Profile"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-700">
                      <p className="text-sm font-medium text-white truncate">{user?.firstName || user?.fullName || user?.username || 'User'}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{user?.role?.replace(/_/g, ' ') || 'Guest'}</p>
                    </div>
                    {/* Logout */}
                    <button
                      onClick={() => { setProfileDropdownOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Login Button */
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          {authenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {authenticated && mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
          {/* User Info */}
          <div className="px-3 py-2 text-sm">
            <div className="text-white font-medium">{user?.firstName || user?.fullName || user?.username || 'User'}</div>
            <div className="text-gray-400 capitalize">{user?.role || 'Guest'}</div>
          </div>
          
          {(user?.role === 'customer' || user?.role === 'guest') && (
            <>
              <Link
                to="/client-dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Client Dashboard
              </Link>
              <Link
                to="/faq"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Help Center
              </Link>
            </>
          )}
          {['technician', 'senior_technician', 'admin'].includes(user?.role) && (
            <>
              <Link
                to="/technician"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Dashboard
              </Link>
            </>
          )}
          {(user?.role === 'management' || user?.role === 'admin') && (
            <>
              <Link
                to="/management-dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Dashboard
              </Link>
              <Link
                to="/knowledge-base"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Knowledge Base
              </Link>
              <Link
                to="/template-manager"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Templates
              </Link>
              <Link
                to="/ml-admin"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                ML Dashboard
              </Link>
            </>
          )}
          {['technician', 'senior_technician', 'management', 'admin'].includes(user?.role) && (
            <Link
              to="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              Analytics
            </Link>
          )}
          {['technician', 'senior_technician', 'management', 'admin'].includes(user?.role) && (
            <Link
              to="/directory"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              Staff/Client Directory
            </Link>
          )}
          {(user?.role === 'management' || user?.role === 'admin') && (
            <Link
              to="/chat-analytics"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              Chat Analytics
            </Link>
          )}
          

        </div>
      )}
      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

      {/* Floating Chat Button — fixed bottom-right */}
      {authenticated && (
        <ChatWidgetButton
          onClick={chat.toggleChat}
          unreadCount={chat.unreadCount}
          hasNewMessage={chat.hasNewMessage}
        />
      )}

      {/* Chat Window */}
      <ChatWindow
        isOpen={chat.isOpen}
        messages={chat.messages}
        onSend={handleChatSend}
        onClose={handleCloseChat}
        onMinimize={handleCloseChat}
        onFeedback={handleChatFeedback}
        isTyping={isTyping}
        suggestions={suggestions || undefined}
        onActionButton={handleActionButton}
        chatMode={chat.chatMode}
        onToggleMode={() => chat.toggleMode()}
        userRole={user?.role || 'customer'}
        onHandoff={handleHandoff}
        handoffStatus={handoffStatus}
        onFileUpload={handleFileUpload}
        onCreateTicket={handoffStatus === 'claimed' ? () => setTicketFromChatOpen(true) : undefined}
      />

      {/* Ticket-from-chat modal */}
      <TicketFromChatModal
        conversationId={conversationId}
        isOpen={ticketFromChatOpen}
        onClose={() => setTicketFromChatOpen(false)}
        onCreated={(ticketNumber) => {
          setTicketFromChatOpen(false)
          chat.addMessage({
            id: Date.now(),
            sender: 'bot',
            text: `Ticket **#${ticketNumber}** has been created. A technician will follow up soon.`,
            timestamp: new Date(),
          })
        }}
      />

      {/* Ticket Detail View - opened from notification clicks */}
      <TicketDetailView
        ticketId={ticketDetailId}
        isOpen={ticketDetailOpen}
        onClose={() => setTicketDetailOpen(false)}
      />

      {/* Profile Detail View - opened from DM notification clicks */}
      <ProfileDetailView
        user={dmProfileUser}
        isOpen={!!dmProfileUser}
        onClose={() => setDmProfileUser(null)}
        initialTab="messages"
      />

      {/* End-of-conversation survey */}
      {showSurvey && (
        <ConversationSurveyModal
          onSubmit={handleSurveySubmit}
          onSkip={handleSurveySkip}
        />
      )}
    </nav>
  )
}

export default Navbar
