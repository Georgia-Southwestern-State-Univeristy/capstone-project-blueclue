import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ChangePassword from './pages/ChangePassword'
import Welcome from './pages/Welcome'
import ClientDashboard from './pages/ClientDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'
import ManagementDashboard from './pages/ManagementDashboard'
import MyAssignedTickets from './pages/MyAssignedTickets'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/technician" element={<TechnicianDashboard />} />
        <Route path="/management-dashboard" element={<ManagementDashboard />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/my-tickets" element={<MyAssignedTickets />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
