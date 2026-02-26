import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { verifyEmail, resendVerification } from '../services/authService'
import logo from '../assets/EditedBlueClueLogo.png'

function VerifyEmail() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, success, error, already-verified, expired
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resendStatus, setResendStatus] = useState('') // idle, sending, sent, error
  const [resendMessage, setResendMessage] = useState('')
  const verificationAttempted = useRef(false)

  useEffect(() => {
    const verify = async () => {
      // Prevent multiple verification attempts (React Strict Mode, re-renders)
      if (verificationAttempted.current) {
        return
      }

      if (!token) {
        verificationAttempted.current = true
        setStatus('error')
        setMessage('Invalid verification link. No token provided.')
        return
      }

      // Mark that verification has started
      verificationAttempted.current = true

      try {
        const response = await verifyEmail(token)
        
        if (response.code === 'ALREADY_VERIFIED') {
          setStatus('already-verified')
          setMessage(response.message)
        } else if (response.code === 'VERIFIED') {
          setStatus('success')
          setMessage(response.message)
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login', {
              state: { message: 'Email verified successfully! You can now login.' }
            })
          }, 3000)
        } else {
          setStatus('success')
          setMessage(response.message)
        }

      } catch (error) {
        const errorMessage = error.message || 'Email verification failed'
        
        // Check for specific error codes
        if (errorMessage.includes('expired')) {
          setStatus('expired')
          setMessage('Verification link has expired. Request a new verification email below.')
        } else if (errorMessage.includes('Invalid')) {
          setStatus('error')
          setMessage('Invalid verification link. Please check your email for the correct link.')
        } else {
          setStatus('error')
          setMessage(errorMessage)
        }
      }
    }

    verify()
  }, [token, navigate])

  const handleResendEmail = async () => {
    if (!email) {
      setResendMessage('Please enter your email address.')
      return
    }

    setResendStatus('sending')
    setResendMessage('')

    try {
      await resendVerification(email)
      setResendStatus('sent')
      setResendMessage('Verification email sent! Please check your inbox.')
    } catch (error) {
      setResendStatus('error')
      setResendMessage(error.message || 'Failed to resend verification email.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="BlueClue Logo" className="h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Email Verification</h1>
        </div>

        {/* Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          
          {/* Verifying */}
          {status === 'verifying' && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-gray-300">Verifying your email address...</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center">
              <div className="inline-block bg-green-500/20 rounded-full p-3 mb-4">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Email Verified!</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to login in 3 seconds...</p>
              <Link
                to="/login"
                className="mt-4 inline-block text-blue-400 hover:text-blue-300 transition"
              >
                Click here if not redirected automatically
              </Link>
            </div>
          )}

          {/* Already Verified */}
          {status === 'already-verified' && (
            <div className="text-center">
              <div className="inline-block bg-blue-500/20 rounded-full p-3 mb-4">
                <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Already Verified</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link
                to="/login"
                className="w-full inline-block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Go to Login
              </Link>
            </div>
          )}

          {/* Expired or Error */}
          {(status === 'expired' || status === 'error') && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-block bg-red-500/20 rounded-full p-3 mb-4">
                  <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  {status === 'expired' ? 'Link Expired' : 'Verification Failed'}
                </h2>
                <p className="text-gray-400">{message}</p>
              </div>

              {/* Resend Email Form (only show for expired links) */}
              {status === 'expired' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                      disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                    />
                  </div>

                  {resendMessage && (
                    <div className={`px-4 py-3 rounded-lg ${
                      resendStatus === 'sent' 
                        ? 'bg-green-900/20 border border-green-500 text-green-400'
                        : 'bg-red-900/20 border border-red-500 text-red-400'
                    }`}>
                      {resendMessage}
                    </div>
                  )}

                  <button
                    onClick={handleResendEmail}
                    disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
                      resendStatus === 'sent'
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {resendStatus === 'sending' && 'Sending...'}
                    {resendStatus === 'sent' && 'Email Sent ✓'}
                    {(resendStatus === 'idle' || resendStatus === 'error') && 'Resend Verification Email'}
                  </button>
                </div>
              )}

              {/* Back to Login */}
              <Link
                to="/login"
                className="mt-6 block text-center text-blue-400 hover:text-blue-300 transition"
              >
                ← Back to Login
              </Link>
            </div>
          )}

        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Need help?{' '}
            <Link to="/" className="text-blue-400 hover:text-blue-300">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
