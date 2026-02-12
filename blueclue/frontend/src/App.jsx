import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ChangePassword from './pages/ChangePassword'
import Welcome from './pages/Welcome'
import ClientDashboard from './pages/ClientDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'
import MyAssignedTickets from './pages/MyAssignedTickets'
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
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/technician" element={<TechnicianDashboard />} />
        <Route path="/my-tickets" element={<MyAssignedTickets />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
