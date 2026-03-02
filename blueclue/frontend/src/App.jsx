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
import KnowledgeBaseManagement from './pages/KnowledgeBaseManagement'
import FAQ from './pages/FAQ'
import ArticlePublicView from './pages/ArticlePublicView'
import FAQSearch from './pages/FAQSearch'
import TemplateManager from './pages/TemplateManager'
import MLAdminDashboard from './pages/MLAdminDashboard'
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
        
        {/* Public FAQ Routes */}
        <Route path="/faq" element={<FAQ />} />
        <Route path="/faq/search" element={<FAQSearch />} />
        <Route path="/faq/article/:id" element={<ArticlePublicView />} />
        <Route path="/help" element={<FAQ />} />
        
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
        <Route path="/knowledge-base" element={
          <ProtectedRoute allowedRoles={['technician', 'senior_technician', 'management', 'admin']}>
            <KnowledgeBaseManagement />
          </ProtectedRoute>
        } />
        <Route path="/template-manager" element={
          <ProtectedRoute allowedRoles={['management', 'admin']}>
            <TemplateManager />
          </ProtectedRoute>
        } />
        <Route path="/ml-admin" element={
          <ProtectedRoute allowedRoles={['management', 'admin']}>
            <MLAdminDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
