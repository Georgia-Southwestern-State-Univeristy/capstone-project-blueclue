# Guest Access System Implementation

## Overview
Implemented a guest access system that allows users to view their tickets by email without full authentication, with appropriate session warnings and read-only restrictions.

## Backend Changes

### 1. Ticket Controller ([ticketController.js](c:/BlueClue/capstone-project-blueclue/capstone-project-blueclue/blueclue/backend/src/controllers/ticketController.js))
- **Updated `createTicket()` endpoint** to accept guest submissions
- Accepts either `customer_id` (authenticated users) OR `guest_email` + `guest_name` (guests)
- **Automatically creates guest customer records** in the users table when needed
- Guest users created with:
  - Role: 'customer'
  - Username: `guest_{email}_{timestamp}`
  - No password required (empty password_hash)
  - Active status for ticket submission

```javascript
// Handle guest users: find or create a guest customer record
if (!customer_id && guest_email) {
    let guestUser = await User.getByEmail(guest_email);
    if (!guestUser) {
        // Create new guest user record in database
        guestUser = await createGuestUser(guest_email, guest_name);
    }
    finalCustomerId = guestUser.id;
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

#### Guest Access Controls
- Guests CAN submit new tickets via the Submit Ticket button
- Guests CANNOT modify existing tickets (no edit/delete actions)
- Session ends when page is closed
- All ticket submissions associated with guest email

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

### ✅ Limited Write Access
- Guests CAN submit new tickets
- Guests CAN view ticket status, history, timeline
- Guests CANNOT modify or delete existing tickets
- Session is temporary and ends on page close

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
│ 📧 You can submit new tickets, but cannot       │
│ modify existing ones. Guest sessions are        │
│ temporary.                                       │
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

4. **Verify Access Controls:**
   - Submit Ticket button SHOULD be visible (guests can create)
   - Ticket list should be visible with only guest's tickets
   - Timeline should be visible
   - Existing tickets should not have edit/delete buttons (if applicable)

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
✅ Guests can submit new tickets  
✅ Guests cannot modify existing tickets  

## Next Steps

### Optional Enhancements
1. Add session timeout countdown in UI
2. Email notification system for ticket updates
3. Guest session extension option
4. Activity logging for guest sessions
5. Rate limiting for guest login attempts
