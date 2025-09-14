# AI Prompt to Recreate Questa Platform

## Complete AI Prompt

```
Create a comprehensive task management and earning platform called "Questa" with the following specifications:

## Core Requirements

### Technology Stack
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Authentication: Firebase Authentication (Google Sign-in only)
- Database: Firebase Firestore
- File Storage: Supabase Storage
- Styling: Custom CSS with Tailwind-inspired utility classes
- Icons: Font Awesome 6.0.0

### Platform Overview
Questa is a task management platform where users complete gaming-related tasks to earn rewards. The platform features a two-phase verification system with admin review for Immutable links.

## File Structure
Create the following files:
- index.html (landing page)
- login.html (login page)
- register.html (registration page)
- dashboard.html (user dashboard)
- admin.html (admin panel)
- styles.css (main stylesheet)
- auth.js (authentication logic)
- firebase-config.js (Firebase configuration)
- supabase-config.js (Supabase configuration)
- supabase-storage.js (file upload handling)
- firestore.js (database operations)
- dashboard-handler.js (user dashboard logic)
- admin-handler.js (admin panel logic)
- login-handler.js (login page logic)
- register-handler.js (registration logic)
- storage.js (storage utilities)
- app.js (main app initialization)
- app-init.js (app initialization)
- quick-setup.js (quick setup utilities)
- sample-data.js (sample data for testing)
- debug.js (debug utilities)
- logo.png (platform logo)

## Database Schema

### Users Collection
```javascript
{
  uid: string,                    // Firebase Auth UID
  email: string,                  // User email
  walletBalance: number,          // Current balance (₱)
  createdAt: timestamp,           // Account creation date
  isAdmin: boolean,               // Admin status
  status: string                  // 'active' | 'disabled'
}
```

### Tasks Collection
```javascript
{
  id: string,                     // Auto-generated ID
  title: string,                  // Task title
  description: string,            // Task description
  reward: number,                 // Reward amount (₱)
  difficulty: string,             // 'easy' | 'medium' | 'hard'
  deadline: timestamp,            // Task deadline
  requirements: string,           // Task requirements
  dnsConfig: {                    // DNS configuration
    immutableApp: {
      name: string,               // App name (e.g., "Battle of Souls")
      connectText: string,        // Connect button text
      linkPattern: string         // Link validation pattern
    }
  },
  status: string,                 // 'active' | 'inactive'
  createdAt: timestamp
}
```

### Verifications Collection
```javascript
{
  id: string,                     // Auto-generated ID
  userId: string,                 // User UID
  taskId: string,                 // Task ID
  phase: string,                  // 'initial' | 'final'
  gameId: string,                 // User's gaming ID
  screenshot: string,             // Screenshot URL
  notes: string,                  // Additional notes
  status: string,                 // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp,
  approvedAt: timestamp,          // Approval timestamp
  rejectedAt: timestamp          // Rejection timestamp
}
```

### Task Statuses Collection
```javascript
{
  id: string,                     // Format: `${userId}_${taskId}`
  userId: string,                 // User UID
  taskId: string,                 // Task ID
  status: string,                 // Task status
  immutableLink: string,          // Immutable link (if applicable)
  adminReviewStatus: string,      // 'pending' | 'approved' | 'rejected'
  submittedAt: timestamp,         // Submission timestamp
  approvedAt: timestamp,          // Approval timestamp
  rejectedAt: timestamp,         // Rejection timestamp
  rejectionReason: string,        // Rejection reason
  updatedAt: timestamp
}
```

### Withdrawals Collection
```javascript
{
  id: string,                     // Auto-generated ID
  userId: string,                 // User UID
  amount: number,                 // Withdrawal amount (₱)
  method: string,                // 'gcash' | 'paypal' | 'bank'
  accountDetails: string,         // Account information
  status: string,                // 'pending' | 'paid' | 'rejected'
  createdAt: timestamp,
  paidAt: timestamp,             // Payment timestamp
  rejectedAt: timestamp,          // Rejection timestamp
  rejectionReason: string         // Rejection reason
}
```

### Notifications Collection
```javascript
{
  id: string,                     // Auto-generated ID
  userId: string,                 // User UID
  type: string,                  // Notification type
  title: string,                  // Notification title
  message: string,                // Notification message
  data: object,                   // Additional data
  isRead: boolean,                // Read status
  createdAt: timestamp,
  readAt: timestamp               // Read timestamp
}
```

## Key Features to Implement

### 1. Authentication System
- Google Sign-in integration with Firebase Auth
- Automatic user creation in Firestore on first login
- Admin role management (set isAdmin: true in user document)
- Session persistence and auth state management

### 2. Task Management System
Implement a two-phase verification system:

**Phase 1 - Initial Verification:**
- User submits Gaming ID and profile screenshot
- Admin reviews and approves/rejects
- If approved, task status becomes 'unlocked'

**DNS Configuration Phase:**
- User configures DNS settings to block auto-redirects
- Task status becomes 'dns_setup'

**Immutable Link Capture Phase:**
- User returns to gaming app
- Taps connect button (DNS blocks redirect)
- Copies Immutable link from app
- Submits link for admin review
- Admin reviews and approves/rejects
- If approved, status becomes 'ready_for_phase2'

**Phase 2 - Final Verification:**
- User completes game stages
- Submits final verification with game results
- Admin reviews and approves/rejects
- If approved, user receives reward and status becomes 'complete'

### 3. Immutable Link Validation Flow
Create a sophisticated admin review system:
1. User completes tutorial and gets Gaming ID
2. User submits Gaming ID and profile screenshot
3. User configures DNS settings to block auto-redirects
4. User returns to app and taps connect button
5. DNS blocks redirect, link appears in app
6. User copies and submits Immutable link
7. Admin reviews link in admin panel
8. Admin approves/rejects with reason
9. User receives notification of decision
10. If approved, user proceeds to game stages

### 4. Admin Panel Features
Create a comprehensive admin dashboard with:
- **Overview Tab**: Statistics cards, recent activity, quick actions
- **Tasks Tab**: Create, edit, delete tasks
- **Verifications Tab**: Review and approve/reject user submissions
- **Immutable Links Tab**: Review submitted Immutable links with approve/reject functionality
- **Withdrawals Tab**: Process withdrawal requests
- **Users Tab**: View user activities, manage balances
- **Settings Tab**: System configuration

### 5. Notification System
Implement real-time notifications:
- Toast messages for immediate feedback
- Notification badge with unread count
- Admin action notifications
- Email-style notification list
- Mark as read functionality

### 6. Withdrawal System
Create secure withdrawal process:
- Multiple payment methods (GCash, PayPal, Bank)
- Admin approval workflow
- 5-second cooldown between requests
- Automatic balance refund on rejection
- Withdrawal history tracking

## UI/UX Requirements

### Design System
- Modern, clean interface with professional styling
- Responsive design for desktop and mobile
- Consistent color scheme: Primary blue (#3B82F6), Success green (#10B981), Warning yellow (#F59E0B), Danger red (#EF4444)
- Card-based layout for content organization
- Smooth animations and transitions

### User Dashboard
- Task cards with status indicators
- Progress tracking for multi-phase tasks
- Wallet balance display
- Notification center
- Withdrawal interface
- Profile management

### Admin Panel
- Clean, professional admin interface
- Statistics dashboard
- Tabbed navigation
- Modal dialogs for actions
- Data tables with filtering
- Action buttons with confirmation

## CSS Classes to Implement

### Layout Classes
```css
.container, .grid, .flex, .hidden, .modal, .modal-overlay, .modal-container
```

### Component Classes
```css
.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger
.form-input, .form-textarea, .form-select, .form-label, .form-group
```

### Status Classes
```css
.status-pending, .status-approved, .status-rejected, .status-complete
.status-badge, .status-indicator
```

### Admin Classes
```css
.admin-navbar, .admin-tabs, .admin-card, .stat-card, .admin-action-btn
```

## Security Requirements

### Authentication Security
- Firebase Authentication with Google OAuth
- Admin role verification on every admin action
- Secure session management
- Automatic logout on token expiry

### Data Security
- Input validation and sanitization
- File upload restrictions (image types only)
- Admin-only operations protection
- Secure API key management

### Business Logic Security
- Immutable link validation with pattern matching
- Admin review requirements for all submissions
- Withdrawal cooldown enforcement
- Balance validation and transaction integrity

## Configuration Requirements

### Firebase Setup
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### Supabase Setup
```javascript
const supabaseUrl = 'your-supabase-url';
const supabaseKey = 'your-supabase-anon-key';
```

## Implementation Details

### Core Classes to Create

**FirestoreManager Class:**
- User management (create, update, get, getAll)
- Task management (create, update, delete, get, getAll)
- Verification management (create, update, get by user/task)
- Task status management (update, get for user)
- Immutable link management (store, approve, reject, get pending)
- Withdrawal management (create, update, get by user, getAll)
- Notification management (create, get by user, mark as read)
- Wallet balance management with transactions

**DashboardHandler Class:**
- Task loading and rendering
- Task status management
- Verification submission (Phase 1 and Phase 2)
- DNS configuration modal
- Immutable link capture modal
- Withdrawal submission
- Notification management
- Real-time updates

**AdminHandler Class:**
- Admin data loading (tasks, verifications, withdrawals, users, immutable links)
- Verification approval/rejection
- Immutable link approval/rejection
- Withdrawal processing
- User balance management
- Statistics calculation
- Real-time data updates

### Key Methods to Implement

**Authentication:**
- `signInWithGoogle()`
- `signOut()`
- `checkAuthState()`
- `checkAdminStatus()`

**Task Management:**
- `loadTasks()`
- `renderTasks()`
- `createTaskCard()`
- `getTaskStatusConfig()`
- `startTask()`
- `submitVerification()`

**Immutable Link System:**
- `showImmutableLinkModal()`
- `submitImmutableLink()`
- `storeImmutableLink()`
- `approveImmutableLink()`
- `rejectImmutableLink()`
- `getPendingImmutableLinks()`

**Admin Operations:**
- `loadAdminData()`
- `approveVerification()`
- `rejectVerification()`
- `approveWithdrawal()`
- `rejectWithdrawal()`
- `updateUserBalance()`

## Error Handling
- Try-catch blocks for all async operations
- User-friendly error messages
- Console logging for debugging
- Graceful fallbacks for failed operations
- Loading states for all operations

## Performance Optimization
- Debounced API calls
- Efficient DOM manipulation
- Lazy loading of components
- Real-time listeners management
- Batch operations where possible

## Testing Requirements
- Create sample data for testing
- Debug utilities for development
- Error logging and monitoring
- Performance tracking

## Deployment Notes
- Configure Firebase project with Authentication and Firestore
- Set up Supabase project with storage bucket
- Configure security rules for Firestore
- Set up RLS policies for Supabase
- Add environment variables for configuration

## Additional Requirements
- Mobile-responsive design
- Accessibility considerations
- Cross-browser compatibility
- SEO optimization for landing page
- Progressive Web App features
- Offline functionality where possible

Create this platform with clean, maintainable code, comprehensive error handling, and a professional user interface. Ensure all features work seamlessly together and provide a smooth user experience for both regular users and administrators.
```

## Usage Instructions

1. **Copy the prompt above** and provide it to an AI assistant (ChatGPT, Claude, etc.)
2. **Provide your Firebase and Supabase credentials** when the AI asks for configuration
3. **Test the platform** with the sample data provided
4. **Customize** the styling and features as needed
5. **Deploy** to your hosting platform

## Configuration Steps After Recreation

1. **Firebase Setup:**
   - Create a new Firebase project
   - Enable Authentication (Google provider)
   - Create Firestore database
   - Add your web app to the project
   - Copy configuration to `firebase-config.js`

2. **Supabase Setup:**
   - Create a new Supabase project
   - Create a storage bucket for file uploads
   - Configure RLS policies
   - Copy URL and keys to `supabase-config.js`

3. **Admin Setup:**
   - Create your admin user account
   - Set `isAdmin: true` in the user document in Firestore
   - Access the admin panel at `/admin.html`

4. **Testing:**
   - Use the sample data provided in `sample-data.js`
   - Test all user flows and admin functions
   - Verify file uploads work correctly

This prompt will recreate the complete Questa platform with all features, security measures, and functionality intact.

