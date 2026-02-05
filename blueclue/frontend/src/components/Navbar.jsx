import { Link } from 'react-router-dom'
import logo from '../assets/EditedBlueClueLogo.png'

function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white p-4">
      <div className="flex gap-6 items-center">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <img src={logo} alt="BlueClue Logo" className="h-16" />
        </Link>
        <Link to="/customer" className="text-gray-300 hover:text-white transition-colors">Ticket Submission</Link>
        <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">Technician Dashboard</Link>
      </div>
    </nav>
  )
}

export default Navbar