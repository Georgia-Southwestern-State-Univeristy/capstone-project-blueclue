import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

// When deployed, VITE_API_URL is the backend's public URL including /api suffix
// (e.g. https://backend-xxx.up.railway.app/api).
// Strip the trailing /api so components that call '/api/...' don't double up to '/api/api/...'
// Service files construct their own full URLs using VITE_API_URL directly.
// In dev, leave baseURL unset so Vite's proxy handles /api requests.
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
