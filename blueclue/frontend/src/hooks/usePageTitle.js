import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': 'Login',
  '/login': 'Login',
  '/welcome': 'Welcome',
  '/register': 'Register',
  '/verify-email': 'Verify Email',
  '/change-password': 'Change Password',
  '/faq': 'FAQ',
  '/faq/search': 'FAQ Search',
  '/faq/article': 'FAQ Article',
  '/help': 'FAQ',
  '/client-dashboard': 'Client Dashboard',
  '/technician': 'Dashboard',
  '/management-dashboard': 'Management Dashboard',
  '/analytics': 'Analytics',
  '/knowledge-base': 'Knowledge Base',
  '/template-manager': 'Template Manager',
  '/ml-admin': 'ML Admin',
  '/chat-analytics': 'Chat Analytics',
}

export default function usePageTitle() {
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    // Check exact match first, then try prefix match for dynamic routes
    const title = pageTitles[path]
      || Object.entries(pageTitles).find(([key]) => key !== '/' && path.startsWith(key))?.[1]
      || 'BlueClue'

    document.title = `BlueClue | ${title}`
    window.scrollTo(0, 0)
  }, [location.pathname])
}
