import { useState } from 'react';
import { getPreferences, savePreferences } from '../services/preferencesService';

/**
 * NotificationPreferences Component
 * Allows users to customize notification settings
 */
function NotificationPreferences() {
  const [preferences, setPreferences] = useState(getPreferences());
  const [isSaved, setIsSaved] = useState(false);

  const handleBrowserNotificationToggle = (e) => {
    const updated = {
      ...preferences,
      browserNotifications: e.target.checked,
    };
    setPreferences(updated);
  };

  const handleEmailNotificationToggle = (e) => {
    const updated = {
      ...preferences,
      emailNotifications: e.target.checked,
    };
    setPreferences(updated);
  };

  const handleTypeToggle = (type) => {
    const updated = {
      ...preferences,
      types: {
        ...preferences.types,
        [type]: !preferences.types[type],
      },
    };
    setPreferences(updated);
  };

  const handleSave = () => {
    savePreferences(preferences);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const notificationTypeLabels = {
    assignment: 'Ticket Assignments',
    overdue: 'Overdue Alerts',
    update_request: 'Update Requests',
    mention: 'Mentions',
  };

  const notificationTypeDescriptions = {
    assignment: 'When you are assigned to a ticket',
    overdue: 'When a ticket becomes overdue',
    update_request: 'When someone requests an update on your ticket',
    mention: 'When someone mentions you in a comment',
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Notification Preferences</h2>

      {/* Browser Notifications Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Browser Notifications
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Receive desktop notifications for important events
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.browserNotifications}
            onChange={handleBrowserNotificationToggle}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 checked:bg-blue-600 cursor-pointer"
          />
          <span className="text-gray-200">
            {preferences.browserNotifications ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Email Notifications Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Email Notifications
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Receive email notifications for important updates
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.emailNotifications}
            onChange={handleEmailNotificationToggle}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 checked:bg-blue-600 cursor-pointer"
          />
          <span className="text-gray-200">
            {preferences.emailNotifications ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Notification Types Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          Notification Types
        </h3>
        <p className="text-gray-400 text-sm mb-4">Choose which types of notifications to receive</p>

        <div className="space-y-3">
          {Object.entries(preferences.types).map(([type, enabled]) => (
            <label key={type} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-700/30 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => handleTypeToggle(type)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 checked:bg-blue-600 cursor-pointer mt-1"
              />
              <div className="flex-1">
                <div className="text-gray-200 font-medium">{notificationTypeLabels[type]}</div>
                <div className="text-gray-500 text-sm">{notificationTypeDescriptions[type]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Save Preferences
        </button>
        {isSaved && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved successfully!
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-gray-700/30 border border-gray-700 rounded-lg">
        <p className="text-gray-400 text-sm">
          <strong>Note:</strong> Your notification preferences are saved locally. Browser notifications require permission
          from your browser.
        </p>
      </div>
    </div>
  );
}

export default NotificationPreferences;