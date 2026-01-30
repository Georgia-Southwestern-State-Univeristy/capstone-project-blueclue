function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to BlueClue</h1>
      <p className="text-gray-600 mb-6">
        Your intelligent IT support ticket management system.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-800 mb-2">For Customers</h2>
          <p className="text-gray-600">Submit and track your support tickets easily.</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h2 className="text-xl font-semibold text-green-800 mb-2">For Technicians</h2>
          <p className="text-gray-600">Manage and resolve tickets efficiently.</p>
        </div>
      </div>
    </div>
  )
}

export default Home
