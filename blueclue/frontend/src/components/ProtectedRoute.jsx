import { Navigate } from 'react-router-dom'
import { getUser, isAuthenticated } from '../services/authService'

/**
 * ProtectedRoute – guards a route by authentication and optional role check.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children – The page/component to render
 * @param {string[]} [props.allowedRoles] – If provided, only these roles may access the route
 * @param {string} [props.redirectTo] – Where to send unauthorised users (default: role-appropriate dashboard)
 */
export default function ProtectedRoute({ children, allowedRoles, redirectTo }) {
  const authenticated = isAuthenticated()
  const user = getUser()

  // Not logged in → login page
  if (!authenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Role check (if allowedRoles specified)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to an appropriate dashboard for their role
    const fallback = redirectTo || getRoleHome(user.role)
    return <Navigate to={fallback} replace />
  }

  return children
}

/** Map a role to its default home route */
function getRoleHome(role) {
  switch (role) {
    case 'management':
    case 'admin':
      return '/management-dashboard'
    case 'technician':
    case 'senior_technician':
      return '/technician'
    case 'customer':
    case 'guest':
    default:
      return '/client-dashboard'
  }
}
