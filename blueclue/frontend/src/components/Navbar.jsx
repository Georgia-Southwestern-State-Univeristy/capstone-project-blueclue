import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white p-4">
      <div className="flex gap-6 items-center">
        <Link to="/" className="font-bold text-blue-400 hover:text-blue-300 transition-colors">BlueClue</Link>
        <Link to="/customer" className="text-gray-300 hover:text-white transition-colors">Customer Portal</Link>
        <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">Technician Dashboard</Link>
      </div>
    </nav>
  )
}

export default Navbar