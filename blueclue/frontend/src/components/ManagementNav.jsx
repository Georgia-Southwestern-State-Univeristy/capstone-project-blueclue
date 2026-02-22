/**
 * Management Navigation Tabs
 * Navigation component for management dashboard sections
 */
function ManagementNav({ activeTab, onTabChange, tabs }) {
  return (
    <div className="border-b border-gray-700 overflow-x-auto sticky top-16 bg-gray-950 z-10">
      <div className="flex gap-1 min-w-max px-4 md:px-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
            }`}
            title={tab.label}
          >
            <span className="mr-2 text-lg">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ManagementNav
