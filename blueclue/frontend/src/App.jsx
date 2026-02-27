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
import TemplateManager from './pages/TemplateManager'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

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
        <Route path="/client-dashboard" element={
          <ProtectedRoute allowedRoles={['customer', 'guest']}>
            <ClientDashboard />
          </ProtectedRoute>
        } />
        <Route path="/technician" element={
          <ProtectedRoute allowedRoles={['technician', 'senior_technician', 'management', 'admin']}>
            <TechnicianDashboard />
          </ProtectedRoute>
        } />
        <Route path="/management-dashboard" element={
          <ProtectedRoute allowedRoles={['management', 'admin']}>
            <ManagementDashboard />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute allowedRoles={['technician', 'senior_technician', 'management', 'admin']}>
            <AnalyticsDashboard />
          </ProtectedRoute>
        } />
        <Route path="/my-tickets" element={
          <ProtectedRoute allowedRoles={['technician', 'senior_technician', 'management', 'admin']}>
            <MyAssignedTickets />
          </ProtectedRoute>
        } />
        <Route path="/template-manager" element={
          <ProtectedRoute allowedRoles={['management', 'admin']}>
            <TemplateManager />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
