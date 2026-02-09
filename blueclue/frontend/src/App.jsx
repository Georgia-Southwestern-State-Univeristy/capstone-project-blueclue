import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ClientDashboard from './pages/ClientDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/technician" element={<TechnicianDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
