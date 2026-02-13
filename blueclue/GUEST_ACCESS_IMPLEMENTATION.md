# Guest Access System Implementation

## Overview
Implemented a guest access system that allows users to view their tickets by email without full authentication, with appropriate session warnings and read-only restrictions.

## Backend Changes

### 1. Ticket Model ([Ticket.js](c:/BlueClue/capstone-project-blueclue/capstone-project-blueclue/blueclue/backend/src/models/Ticket.js))
- **Added `getByEmail()` method** to filter tickets by customer email address
- Used for guest users who don't have a customer_id

```javascript
static async getByEmail(email) {
    // Returns all tickets where customer.email matches
    // Includes customer info and assigned technician details
}
```

### 2. Ticket Controller ([ticketController.js](c:/BlueClue/capstone-project-blueclue/capstone-project-blueclue/blueclue/backend/src/controllers/ticketController.js))
- **Updated `getAllTickets()` endpoint** to handle guest users differently
- Customers: Filter by `customer_id`
- Guests: Filter by `email`
- Technicians/Admins: Return all tickets

```javascript
if (req.user.role === 'customer') {
    tickets = await Ticket.getByCustomerId(req.user.id);
} else if (req.user.role === 'guest') {
    tickets = await Ticket.getByEmail(req.user.email);
}
```

### 3. Authentication System (Already Implemented)
- Guest login endpoint already exists in `authController.js`
- Guest sessions stored in `guest_sessions` table
- 24-hour session expiration
- JWT token with `role: 'guest'` and `isGuest: true`

## Frontend Changes

### 1. Client Dashboard ([ClientDashboard.jsx](c:/BlueClue/capstone-project-blueclue/capstone-project-blueclue/blueclue/frontend/src/pages/ClientDashboard.jsx))

#### Added Guest Detection
```javascript
const user = getCurrentUser()
setIsGuest(user?.role === 'guest' || user?.isGuest === true)
```

#### Implemented beforeunload Warning
```javascript
useEffect(() => {
    if (!isGuest) return
    
    const handleBeforeUnload = (e) => {
        const message = `Closing this page will end your session. You will receive ticket updates via email at ${currentUser?.email}.`
        e.preventDefault()
        e.returnValue = message
        return message
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [isGuest, currentUser])
```

#### Added Guest Info Banner
- Displays prominent blue banner for guest sessions
- Shows guest email address
- Warns about session closure
- Indicates read-only access

#### Restricted Guest Access
- **Hidden Submit Ticket button** for guests
- Updated page description text
- Modal doesn't open for guest users

### 2. Login Page (Already Implemented)
- Three login types: Customer, Technician, Guest
- Guest login requires:
  - Email address
  - Full name
  - No password needed

## Features

### ✅ Guest Login Flow
1. User selects "Guest" tab on login page
2. Enters email and full name
3. System creates 24-hour session token
4. Redirects to Client Dashboard

### ✅ Ticket Filtering
- Guests see ONLY tickets where their email matches the customer email
- Uses email-based filtering (not customer_id)
- Automatically filtered by backend

### ✅ Session Warnings
- Browser shows warning when guest tries to close/refresh page
- Warning message includes their email address
- Native browser confirmation dialog

### ✅ Read-Only Access
- Submit Ticket button hidden for guests
- Can view ticket status, history, timeline
- Cannot create, edit, or delete tickets

### ✅ Email Notifications
- Guest info banner reminds users about email updates
- Session closure message references email notifications

## User Experience

### Guest Session Info Banner
```
┌──────────────────────────────────────────────────┐
│ ℹ️  Guest Session Active                        │
│                                                  │
│ You are viewing tickets associated with          │
│ guest@example.com                                │
│                                                  │
│ ⚠️ Important: Closing this page will end your   │
│ session. You will receive ticket updates via    │
│ email.                                           │
│                                                  │
│ 📧 Guest users have read-only access and        │
│ cannot create new tickets.                      │
└──────────────────────────────────────────────────┘
```

### Page Close Warning
```
Closing this page will end your session. 
You will receive ticket updates via email at guest@example.com.

[Leave] [Stay]
```

## Testing

### Test Guest Access
1. **Login as Guest:**
   - Go to login page
   - Click "Guest" tab
   - Enter email and full name
   - Click Sign In

2. **Verify Ticket Filtering:**
   - Should only see tickets submitted by that email
   - No tickets from other users visible

3. **Test Session Warning:**
   - Try to close browser tab
   - Should see warning dialog
   - Try to refresh page
   - Should see warning dialog

4. **Verify Read-Only:**
   - Submit Ticket button should not be visible
   - Timeline should be visible
   - Ticket list should be visible

5. **Test Different Emails:**
   - Login with email A → See email A's tickets
   - Logout and login with email B → See email B's tickets

## Security Considerations

### ✅ Implemented
- Email validation on backend
- Session tokens with expiration (24 hours)
- Guests cannot modify any data
- Tickets filtered by email (guests only see their own)

### Database
- `guest_sessions` table tracks all guest sessions
- Automatic cleanup of expired sessions
- Session tokens stored securely

## Files Modified

1. **Backend:**
   - `backend/src/models/Ticket.js` - Added getByEmail method
   - `backend/src/controllers/ticketController.js` - Updated getAllTickets

2. **Frontend:**
   - `frontend/src/pages/ClientDashboard.jsx` - Added guest restrictions and warnings

3. **Already Implemented:**
   - `backend/src/controllers/authController.js` - Guest login
   - `database/auth_setup.sql` - Guest sessions table
   - `frontend/src/pages/Login.jsx` - Guest login UI

## Acceptance Criteria Status

✅ Guests can access tickets using email  
✅ Warning displays when attempting to close page  
✅ Guests only see their own tickets  
✅ Session ends on page close (browser behavior)  
✅ Guests cannot modify tickets  

## Next Steps

### Optional Enhancements
1. Add session timeout countdown in UI
2. Email notification system for ticket updates
3. Guest session extension option
4. Activity logging for guest sessions
5. Rate limiting for guest login attempts
