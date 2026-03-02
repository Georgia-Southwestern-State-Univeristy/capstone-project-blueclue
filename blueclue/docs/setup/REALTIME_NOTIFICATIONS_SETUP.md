# Real-Time Notification System - Setup Guide

## Installation

### Backend Dependencies
```bash
cd blueclue/backend
npm install
```

This will install `socket.io@^4.8.1` along with other dependencies.

### Frontend Dependencies
Frontend already has `socket.io-client@^4.8.3` installed. No additional installation needed.

## Configuration

### Environment Variables
Ensure your `.env` file in the backend has:
```env
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:5173
PORT=3000
```

### Frontend Environment
Ensure your `.env` in the frontend has:
```env
VITE_API_URL=http://localhost:3000/api
```

## Starting the Services

### 1. Start Backend (with WebSocket server)
```bash
cd blueclue/backend
npm run dev
```

The server will start on `http://localhost:3000` with WebSocket support.

### 2. Start Frontend
```bash
cd blueclue/frontend
npm run dev
```

The frontend will start on `http://localhost:5173`.

## Features Implemented

### Real-Time Updates via WebSocket
- ✅ Socket.io server integration on backend
- ✅ WebSocket authentication using JWT
- ✅ Real-time notification delivery to connected users
- ✅ Automatic reconnection handling
- ✅ Unread count updates in real-time

### Backend WebSocket Events
- `connected` - Sent when user successfully connects
- `new_notification` - Sent when a new notification is created for the user
- `unread_count_update` - Sent when unread count changes

### Frontend Features
- ✅ Custom `useNotificationSocket` hook for WebSocket management
- ✅ Real-time bell icon updates with animations
- ✅ Visual indicators (pulse, bounce, color change) for new notifications
- ✅ Polling fallback (60s interval) if WebSocket disconnects
- ✅ Browser Notification API integration (optional)

### Browser Notifications
Users can enable native browser notifications to receive alerts even when the tab is in the background.

**To enable:**
1. Browser will request permission when first notification arrives (if preference is set)
2. Use the utility functions in `utils/browserNotifications.js`:
   - `requestNotificationPermission()` - Request permission
   - `setBrowserNotificationPreference(true)` - Enable browser notifications
   - `showNotificationAlert(notification)` - Show a notification

## Testing

### Test WebSocket Connection
1. Log in to the application
2. Open browser console
3. Look for messages:
   - "Connecting to WebSocket server..."
   - "WebSocket connected"
   - "WebSocket connection confirmed"

### Test Real-Time Notifications
1. Have two user accounts logged in on different browsers
2. Create a notification for one user via the API or trigger an event (e.g., ticket assignment)
3. The notification should appear instantly with bell animation

### Test Browser Notifications
1. Enable browser notifications preference
2. Receive a notification while the tab is in the background
3. Native OS notification should appear

## API Endpoints

All notification endpoints automatically emit WebSocket events:

- `POST /api/notifications` - Creates notification + emits to user
- `PATCH /api/notifications/:id/read` - Marks as read + updates count
- `DELETE /api/notifications/:id` - Deletes + updates count
- `PATCH /api/notifications/read-all` - Marks all read + sets count to 0
- `DELETE /api/notifications/read` - Deletes read notifications + updates count

## Architecture

```
Backend (Express + Socket.io)
├── app.js - HTTP + WebSocket server setup
├── services/socketService.js - WebSocket event handlers
└── controllers/notificationController.js - Emits events on CRUD operations

Frontend (React + Socket.io-client)
├── hooks/useNotificationSocket.js - WebSocket connection hook
├── components/NotificationBell.jsx - Real-time updates
├── components/NotificationDropdown.jsx - Notification list
└── utils/browserNotifications.js - Browser Notification API
```

## Troubleshooting

### WebSocket not connecting
- Check that backend is running
- Verify JWT token is valid in localStorage
- Check browser console for connection errors
- Ensure CORS is configured correctly

### Notifications not appearing in real-time
- Check WebSocket connection status in console
- Verify user is logged in with valid token
- Check that notification is being created for the correct user ID
- Inspect Network tab for WebSocket frames

### Browser notifications not showing
- Check that permission is granted: `Notification.permission === 'granted'`
- Verify preference is enabled: `getBrowserNotificationPreference()`
- Some browsers block notifications in incognito mode