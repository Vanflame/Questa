# Questa - Setup Instructions

## Overview
Questa is a modern task management platform that allows users to complete tasks and earn rewards. This version has been refactored to remove hardcoded configurations and use a clean, flexible task flow.

## Features
- **User Flow**: Login/Register → Dashboard → Task Details → Submit Proof → Admin Review
- **Admin Flow**: Task Management → Submission Review → Withdrawal Management
- **Image Upload**: Uses ImgBB API for image storage
- **Modern UI**: Card-based design with responsive layout
- **Real-time Updates**: Firebase Firestore for data synchronization

## Setup Instructions

### 1. Firebase Configuration
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password and Google)
3. Create a Firestore database
4. Update `assets/js/firebase-config.js` with your Firebase config

### 2. ImgBB API Setup
1. Go to https://api.imgbb.com/
2. Create an account and get your API key
3. Update `assets/js/config.js` with your ImgBB API key:
   ```javascript
   IMGBB_API_KEY: 'your_actual_api_key_here'
   ```

### 3. Database Collections
The following Firestore collections will be created automatically:
- `users` - User accounts and balances
- `tasks` - Available tasks
- `task_submissions` - User task submissions
- `withdrawals` - Withdrawal requests
- `notifications` - User notifications

### 4. Admin Setup
1. Create a user account
2. In Firestore, set the user's `isAdmin` field to `true`
3. Access the admin panel at `/admin/`

### 5. Task Flow
1. **User starts task**: Creates a `task_submission` with status `in_progress`
2. **User submits proof**: Updates submission with proof image and status `pending_review`
3. **Admin reviews**: Approves/rejects submission
4. **If approved**: User balance is credited and status becomes `completed`

### 6. File Structure
```
Questa/
├── admin/
│   └── index.html          # Admin panel
├── dashboard/
│   └── index.html          # User dashboard
├── assets/
│   ├── css/
│   │   └── styles.css      # Main stylesheet
│   └── js/
│       ├── config.js       # Configuration file
│       ├── firebase-config.js
│       ├── auth.js         # Authentication
│       ├── firestore.js    # Database operations
│       ├── storage.js      # Image upload (ImgBB)
│       ├── app.js          # Main app logic
│       ├── admin-handler-simple.js  # Admin panel logic
│       └── dashboard-handler.js     # Dashboard logic
├── index.html              # Redirect to login
├── login.html              # Login page
└── register.html           # Registration page
```

## Configuration Options

### Task Configuration
- `requires_referrer_email`: Whether task requires referrer email
- `max_restarts`: Maximum number of restarts allowed
- `reward`: Reward amount in PHP

### Withdrawal Configuration
- `WITHDRAWAL_COOLDOWN`: Time between withdrawal requests (seconds)
- `MAX_WITHDRAWAL_AMOUNT`: Maximum withdrawal amount

### File Upload Configuration
- `MAX_FILE_SIZE`: Maximum file size (bytes)
- `ALLOWED_FILE_TYPES`: Allowed image types

## Usage

### For Users
1. Register/Login
2. View available tasks on dashboard
3. Click task to see details and start
4. Submit proof when completed
5. Wait for admin approval
6. Withdraw earnings when approved

### For Admins
1. Access admin panel
2. Create/edit/delete tasks
3. Review task submissions
4. Approve/reject submissions
5. Manage withdrawal requests
6. View user statistics

## Troubleshooting

### Common Issues
1. **ImgBB API Error**: Check API key in config.js
2. **Firebase Auth Error**: Verify Firebase configuration
3. **Image Upload Fails**: Check file size and type restrictions
4. **Admin Access Denied**: Ensure user has `isAdmin: true` in Firestore

### Support
For issues or questions, check the browser console for error messages and ensure all configuration files are properly set up.

## Changelog

### Version 2.0.0
- Removed hardcoded DNS/game configurations
- Implemented clean task submission flow
- Replaced Supabase with ImgBB for image uploads
- Simplified admin panel
- Added configuration file for easy setup
- Improved UI/UX with modern design
