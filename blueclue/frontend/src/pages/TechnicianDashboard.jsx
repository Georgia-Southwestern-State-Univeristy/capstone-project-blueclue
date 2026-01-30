function TechnicianDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Technician Dashboard</h1>
      <p className="text-gray-600 mb-6">
        View and manage all support tickets assigned to you.
      </p>

      {/* Placeholder stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-800">Open</h3>
          <p className="text-2xl font-bold text-yellow-600">--</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800">In Progress</h3>
          <p className="text-2xl font-bold text-blue-600">--</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800">Resolved</h3>
          <p className="text-2xl font-bold text-green-600">--</p>
        </div>
      </div>

      {/* Placeholder for ticket queue */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Ticket Queue</h2>
        <p className="text-gray-500 italic">Tickets will be displayed here...</p>
      </div>
    </div>
  )
}

export default TechnicianDashboard
