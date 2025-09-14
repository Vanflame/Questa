# Questa Platform - Complete Documentation

## Overview
Questa is a comprehensive task management and earning platform built with Firebase, Supabase, and modern web technologies. Users can complete tasks, earn rewards, and withdraw funds through a secure admin-reviewed system.

## Architecture

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: Firebase Authentication (Google Sign-in)
- **Database**: Firebase Firestore
- **File Storage**: Supabase Storage
- **Styling**: Custom CSS with Tailwind-inspired classes
- **Icons**: Font Awesome 6.0.0

### Core Components
1. **Authentication System** (`auth.js`)
2. **Database Management** (`firestore.js`)
3. **File Storage** (`supabase-storage.js`)
4. **User Dashboard** (`dashboard-handler.js`)
5. **Admin Panel** (`admin-handler.js`)
6. **Task Management System**
7. **Immutable Link Validation System**

## File Structure

```
Questa Platform/
├── index.html                 # Landing page
├── login.html                 # Login page
├── register.html              # Registration page
├── dashboard.html             # User dashboard
├── admin.html                 # Admin panel
├── styles.css                 # Main stylesheet
├── auth.js                    # Authentication logic
├── firebase-config.js         # Firebase configuration
├── supabase-config.js         # Supabase configuration
├── supabase-storage.js        # File upload handling
├── firestore.js               # Database operations
├── dashboard-handler.js       # User dashboard logic
├── admin-handler.js           # Admin panel logic
├── login-handler.js           # Login page logic
├── register-handler.js        # Registration logic
├── storage.js                 # Storage utilities
├── app.js                     # Main app initialization
├── app-init.js                # App initialization
├── quick-setup.js             # Quick setup utilities
├── sample-data.js             # Sample data for testing
├── debug.js                   # Debug utilities
└── logo.png                   # Platform logo
```

## Database Schema

### Collections

#### Users Collection (`users`)
```javascript
{
  uid: string,                    // Firebase Auth UID
  email: string,                  // User email
  walletBalance: number,           // Current balance (₱)
  createdAt: timestamp,           // Account creation date
  isAdmin: boolean,               // Admin status
  status: string                  // 'active' | 'disabled'
}
```

#### Tasks Collection (`tasks`)
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

#### Verifications Collection (`verifications`)
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
  rejectedAt: timestamp           // Rejection timestamp
}
```

#### Task Statuses Collection (`taskStatuses`)
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

#### Withdrawals Collection (`withdrawals`)
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

#### Notifications Collection (`notifications`)
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

## Key Features

### 1. User Authentication
- Google Sign-in integration
- Automatic user creation in Firestore
- Admin role management
- Session persistence

### 2. Task Management System
- **Phase 1**: Initial verification (Gaming ID + Screenshot)
- **DNS Configuration**: Custom DNS setup for Immutable links
- **Immutable Link Capture**: Admin-reviewed link validation
- **Phase 2**: Final verification (Game completion)
- **Reward Distribution**: Automatic wallet crediting

### 3. Immutable Link Validation Flow
1. User completes tutorial and gets Gaming ID
2. User submits Gaming ID and profile screenshot
3. User configures DNS settings to block auto-redirects
4. User returns to app and taps connect button
5. DNS blocks redirect, link appears in app
6. User copies and submits Immutable link
7. Admin reviews and approves/rejects link
8. User receives notification of decision
9. If approved, user proceeds to game stages

### 4. Admin Panel Features
- **Dashboard**: Overview with statistics
- **Task Management**: Create, edit, delete tasks
- **Verification Review**: Approve/reject user submissions
- **Immutable Links Review**: Admin validation system
- **Withdrawal Processing**: Approve/reject withdrawal requests
- **User Management**: View user activities and manage balances
- **Settings**: System configuration

### 5. Notification System
- Real-time notifications for users
- Admin action notifications
- Toast messages for immediate feedback
- Notification badge with unread count

### 6. Withdrawal System
- Multiple payment methods (GCash, PayPal, Bank)
- Admin approval workflow
- Cooldown period between requests
- Automatic balance refund on rejection

## CSS Classes and Styling

### Layout Classes
- `.container`: Main container with max-width
- `.grid`: CSS Grid layout
- `.flex`: Flexbox layout
- `.hidden`: Hide elements
- `.modal`: Modal overlay and container

### Component Classes
- `.btn-primary`: Primary button styling
- `.btn-secondary`: Secondary button styling
- `.btn-success`: Success button styling
- `.btn-warning`: Warning button styling
- `.btn-danger`: Danger button styling
- `.form-input`: Input field styling
- `.form-textarea`: Textarea styling
- `.form-select`: Select dropdown styling

### Status Classes
- `.status-pending`: Pending status styling
- `.status-approved`: Approved status styling
- `.status-rejected`: Rejected status styling
- `.status-complete`: Complete status styling

### Admin Classes
- `.admin-navbar`: Admin navigation bar
- `.admin-tabs`: Admin tab navigation
- `.admin-card`: Admin card components
- `.stat-card`: Statistics card styling

## Configuration Files

### Firebase Configuration (`firebase-config.js`)
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

### Supabase Configuration (`supabase-config.js`)
```javascript
const supabaseUrl = 'your-supabase-url';
const supabaseKey = 'your-supabase-anon-key';
```

## Security Features

### Authentication Security
- Firebase Authentication with Google OAuth
- Admin role verification
- Session management

### Data Security
- Firestore security rules
- Input validation and sanitization
- File upload restrictions
- Admin-only operations protection

### Business Logic Security
- Immutable link validation
- Admin review requirements
- Withdrawal cooldown periods
- Balance validation

## Deployment Requirements

### Firebase Setup
1. Create Firebase project
2. Enable Authentication (Google provider)
3. Create Firestore database
4. Configure security rules
5. Add web app to project

### Supabase Setup
1. Create Supabase project
2. Configure storage bucket
3. Set up RLS policies
4. Generate API keys

### Environment Variables
- Firebase configuration
- Supabase URL and keys
- Admin email addresses

## API Endpoints (Firebase Functions)

### User Management
- `createUser(userData)`: Create new user
- `updateUser(uid, data)`: Update user data
- `getUser(uid)`: Get user information
- `updateWalletBalance(uid, amount)`: Update wallet balance

### Task Management
- `createTask(taskData)`: Create new task
- `getTasks()`: Get active tasks
- `getTask(taskId)`: Get specific task
- `updateTaskStatus(taskId, status)`: Update task status

### Verification System
- `createVerification(verificationData)`: Create verification
- `updateVerification(verificationId, data)`: Update verification
- `getVerificationsByUser(userId)`: Get user verifications

### Immutable Link System
- `storeImmutableLink(taskId, immutableLink)`: Store Immutable link
- `approveImmutableLink(userId, taskId)`: Approve link
- `rejectImmutableLink(userId, taskId, reason)`: Reject link
- `getPendingImmutableLinks()`: Get pending links

### Withdrawal System
- `createWithdrawal(withdrawalData)`: Create withdrawal request
- `updateWithdrawal(withdrawalId, data)`: Update withdrawal
- `getWithdrawalsByUser(userId)`: Get user withdrawals

### Notification System
- `createAdminNotification(userId, notificationData)`: Create notification
- `getUserNotifications(userId)`: Get user notifications
- `markNotificationAsRead(notificationId)`: Mark as read

## Testing and Debugging

### Debug Utilities (`debug.js`)
- Console logging functions
- Error tracking
- Performance monitoring

### Sample Data (`sample-data.js`)
- Test tasks
- Sample users
- Mock data for development

## Maintenance and Updates

### Regular Maintenance
- Database cleanup
- Log monitoring
- Performance optimization
- Security updates

### Feature Updates
- New task types
- Additional payment methods
- Enhanced admin features
- User experience improvements

## Troubleshooting

### Common Issues
1. **Firebase Connection**: Check configuration and network
2. **Authentication**: Verify Google OAuth setup
3. **File Uploads**: Check Supabase storage configuration
4. **Admin Access**: Verify user admin status in database
5. **Immutable Links**: Check DNS configuration and link format

### Error Handling
- Try-catch blocks for all async operations
- User-friendly error messages
- Console logging for debugging
- Graceful fallbacks for failed operations

## Performance Optimization

### Frontend Optimization
- Lazy loading of components
- Debounced API calls
- Efficient DOM manipulation
- CSS optimization

### Backend Optimization
- Firestore query optimization
- Caching strategies
- Batch operations
- Real-time listeners management

## Future Enhancements

### Planned Features
- Mobile app development
- Advanced analytics dashboard
- Multi-language support
- Enhanced security features
- Automated task verification
- Integration with more gaming platforms

### Scalability Considerations
- Database sharding
- CDN implementation
- Load balancing
- Microservices architecture
- Caching layers

---

This documentation provides a comprehensive overview of the Questa platform architecture, features, and implementation details. It serves as a complete guide for understanding, maintaining, and extending the platform.

