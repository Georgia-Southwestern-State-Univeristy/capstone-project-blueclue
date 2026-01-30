import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="flex gap-4">
        <Link to="/" className="hover:underline">Home</Link>
        <Link to="/customer" className="hover:underline">Customer Portal</Link>
        <Link to="/technician" className="hover:underline">Technician Dashboard</Link>
      </div>
    </nav>
  )
}

export default Navbar