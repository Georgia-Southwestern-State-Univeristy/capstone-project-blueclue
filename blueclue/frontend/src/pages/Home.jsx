function Home() {
  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-4">Welcome to BlueClue</h1>
      <p className="text-gray-400 mb-6">
        Your intelligent IT support ticket management system.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 p-6 rounded-lg border border-blue-800">
          <h2 className="text-xl font-semibold text-blue-400 mb-2">For Customers</h2>
          <p className="text-gray-400">Submit and track your support tickets easily.</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-blue-700">
          <h2 className="text-xl font-semibold text-blue-300 mb-2">For Technicians</h2>
          <p className="text-gray-400">Manage and resolve tickets efficiently.</p>
        </div>
      </div>
    </div>
  )
}

export default Home
