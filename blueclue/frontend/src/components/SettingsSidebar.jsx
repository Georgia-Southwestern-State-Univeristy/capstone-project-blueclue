import { useState, useEffect, useCallback } from 'react';
import NotificationPreferences from './NotificationPreferences';
import { getUser } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import useTheme from '../hooks/useTheme';

/**
 * Chevron that points right by default, flips to point left when expanded.
 * Uses a single right-arrow path and rotates via CSS for a smooth flip.
 */
function SectionChevron({ expanded }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-300 ease-in-out ${
        expanded ? 'rotate-180' : 'rotate-0'
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/* ── Sub-panel content per section ───────────────────────────────────── */

function AccountPanelContent({ onNavigate, onLogout }) {
  const user = getUser();
  return (
    <div className="space-y-4">
      {/* User info card */}
      <div className="bg-gray-800/60 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">
              {user?.firstName || user?.fullName || user?.username || 'User'}
            </p>
            <p className="text-gray-500 text-sm capitalize">{user?.role || 'User'}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1">
        <button
          onClick={onNavigate}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Change Password
        </button>

        <hr className="border-gray-700 my-2" />

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-950 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

function AppearancePanelContent() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Theme selector */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Theme</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Dark option */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative rounded-xl p-4 border-2 transition-all duration-200 ${
              theme === 'dark'
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {/* Dark mode preview */}
            <div className="rounded-lg overflow-hidden mb-3 border border-gray-700">
              <div className="bg-gray-950 p-2">
                <div className="h-2 w-12 bg-gray-700 rounded mb-1.5" />
                <div className="flex gap-1">
                  <div className="h-1.5 w-8 bg-gray-800 rounded" />
                  <div className="h-1.5 w-6 bg-gray-800 rounded" />
                </div>
              </div>
              <div className="bg-gray-900 p-2 space-y-1">
                <div className="h-1.5 w-full bg-gray-800 rounded" />
                <div className="h-1.5 w-3/4 bg-gray-800 rounded" />
                <div className="h-1.5 w-1/2 bg-gray-800 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Dark</span>
            </div>
            {theme === 'dark' && (
              <div className="absolute top-2 right-2">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* Light option */}
          <button
            onClick={() => setTheme('light')}
            className={`relative rounded-xl p-4 border-2 transition-all duration-200 ${
              theme === 'light'
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {/* Light mode preview */}
            <div className="rounded-lg overflow-hidden mb-3 border border-gray-300">
              <div className="bg-white p-2">
                <div className="h-2 w-12 bg-gray-200 rounded mb-1.5" />
                <div className="flex gap-1">
                  <div className="h-1.5 w-8 bg-gray-100 rounded" />
                  <div className="h-1.5 w-6 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="bg-gray-50 p-2 space-y-1">
                <div className="h-1.5 w-full bg-gray-200 rounded" />
                <div className="h-1.5 w-3/4 bg-gray-200 rounded" />
                <div className="h-1.5 w-1/2 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Light</span>
            </div>
            {theme === 'light' && (
              <div className="absolute top-2 right-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-dimmed)' }}>
        Your theme preference is saved locally.
      </p>
    </div>
  );
}

function AboutPanelContent() {
  return (
    <div className="bg-gray-800/40 rounded-lg p-5 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">Version</span>
        <span className="text-white text-sm font-mono">2.3.0</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">Build</span>
        <span className="text-white text-sm font-mono">Development</span>
      </div>
      <hr className="border-gray-700" />
      <p className="text-gray-500 text-xs text-center">
        BlueClue Support Ticket System
      </p>
    </div>
  );
}

/* ── Section definitions ─────────────────────────────────────────────── */

const SECTIONS = [
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Manage alerts & email preferences',
    iconBg: 'bg-blue-600/20',
    iconColor: 'text-blue-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    ),
  },
  {
    key: 'account',
    label: 'Account',
    description: 'Profile & security settings',
    iconBg: 'bg-purple-600/20',
    iconColor: 'text-purple-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
  },
  {
    key: 'appearance',
    label: 'Appearance',
    description: 'Theme & display options',
    iconBg: 'bg-amber-600/20',
    iconColor: 'text-amber-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    ),
  },
  {
    key: 'about',
    label: 'About',
    description: 'App version & info',
    iconBg: 'bg-green-600/20',
    iconColor: 'text-green-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
];

/* ── Main component ──────────────────────────────────────────────────── */

/**
 * SettingsSidebar Component
 * Right-side overlay sidebar. Each section expands as a sub-panel to the left.
 * Only one section can be open at a time.
 */
function SettingsSidebar({ isOpen, onClose, onLogout }) {
  const [activePanel, setActivePanel] = useState(null); // key of open sub-panel
  const navigate = useNavigate();

  // Handle full close — reset everything
  const handleClose = useCallback(() => {
    setActivePanel(null);
    onClose();
  }, [onClose]);

  // Escape: close sub-panel first, then sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activePanel) {
          setActivePanel(null);
        } else {
          handleClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activePanel, handleClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const togglePanel = (key) => {
    setActivePanel(activePanel === key ? null : key);
  };

  // Resolve the sub-panel title from the active key
  const activeSectionMeta = SECTIONS.find((s) => s.key === activePanel);

  // Render the correct content inside the sub-panel
  const renderPanelContent = () => {
    switch (activePanel) {
      case 'notifications':
        return <NotificationPreferences />;
      case 'account':
        return (
          <AccountPanelContent
            onNavigate={() => { navigate('/change-password'); handleClose(); }}
            onLogout={onLogout}
          />
        );
      case 'appearance':
        return <AppearancePanelContent />;
      case 'about':
        return <AboutPanelContent />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-[60] ${
          isOpen ? 'bg-opacity-50 pointer-events-auto' : 'bg-opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          if (activePanel) {
            setActivePanel(null);
          } else {
            handleClose();
          }
        }}
      />

      {/* ── Sub-Panel (slides left from behind the sidebar) ── */}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] border-l border-gray-700 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen && activePanel ? 'translate-x-[-340px]' : 'translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--bg-sub-panel)' }}
      >
        {/* Sub-panel header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePanel(null)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Back to settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white">
              {activeSectionMeta?.label || ''}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-panel body */}
        <div className="p-5 overflow-y-auto h-[calc(100%-65px)]">
          {renderPanelContent()}
        </div>
      </div>

      {/* ── Main Settings Sidebar ── */}
      <div
        className={`fixed top-0 right-0 h-full w-[340px] bg-gray-900 border-l border-gray-700 shadow-2xl z-[80] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Settings</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section list */}
        <div className="overflow-y-auto h-[calc(100%-65px)]">
          {SECTIONS.map((section) => (
            <div key={section.key} className="border-b border-gray-800">
              <button
                onClick={() => togglePanel(section.key)}
                className="w-full flex items-center p-5 hover:bg-gray-800/50 transition-colors text-left gap-3"
              >
                <SectionChevron expanded={activePanel === section.key} />
                <div className={`w-9 h-9 rounded-lg ${section.iconBg} flex items-center justify-center shrink-0`}>
                  <svg className={`w-5 h-5 ${section.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {section.icon}
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium">{section.label}</p>
                  <p className="text-gray-500 text-sm">{section.description}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default SettingsSidebar;
