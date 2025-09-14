# TaskEarn - Mobile Game Rewards Platform

A full-stack web application for a Task Verification & Reward System where users complete mobile game quests to earn money.

## 🚀 Features

### Authentication
- **Google OAuth** and **Email/Password** authentication
- Secure user registration and login
- Automatic user profile creation

### User Dashboard
- **Profile Overview**: View user details, wallet balance, and status
- **Tasks**: Browse available tasks with reward amounts and status indicators
- **Wallet**: View balance, transaction history, and request withdrawals
- **Activity**: Track all submissions and withdrawal requests

### Task System
- **Android Version Check**: Ensures users have Android 14+ before starting tasks
- **Two-Phase Verification**:
  - **Phase 1**: Initial verification with Game ID and profile screenshot
  - **Phase 2**: Final verification with stage completion screenshot
- **Real-time Status Updates**: Locked → Pending → Complete

### Wallet & Payments
- **Balance Tracking**: Real-time wallet balance updates
- **Withdrawal System**: Support for GCash, Bank Transfer, and PayPal
- **Transaction History**: Complete audit trail of all transactions

### Admin Panel
- **Task Management**: Create, edit, delete, and manage tasks
- **Verification Review**: Approve or reject user submissions
- **Withdrawal Processing**: Process and manage withdrawal requests
- **Real-time Updates**: Live status updates across the platform

## 🛠️ Tech Stack

- **Frontend**: HTML5, TailwindCSS, Vanilla JavaScript
- **Backend**: Firebase Firestore, Firebase Auth, Firebase Storage
- **Hosting**: Firebase Hosting (recommended)

## 📋 Prerequisites

1. **Firebase Project**: Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. **Enable Services**:
   - Authentication (Google + Email/Password)
   - Firestore Database
   - Storage
3. **Node.js**: For local development (optional)

## 🔧 Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing one
3. Enable the following services:

#### Authentication
- Go to Authentication → Sign-in method
- Enable **Google** and **Email/Password** providers
- Add your domain to authorized domains

#### Firestore Database
- Go to Firestore Database
- Create database in production mode
- Set up security rules (see below)

#### Storage
- Go to Storage
- Get started with default rules
- Update security rules (see below)

### 2. Update Configuration

1. Go to Project Settings → General
2. Copy your Firebase config
3. Update `firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

### 3. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Anyone can read tasks
    match /tasks/{taskId} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can create verifications, admins can read/write all
    match /verifications/{verificationId} {
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
      );
    }
    
    // Users can create withdrawals, admins can read/write all
    match /withdrawals/{withdrawalId} {
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
      );
    }
  }
}
```

### 4. Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 5. Set Up Admin User

1. Create a user account through the app
2. Go to Firestore Console
3. Find the user document in the `users` collection
4. Set `isAdmin: true` in the user document

## 🚀 Deployment

### Option 1: Firebase Hosting (Recommended)

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase project:
```bash
firebase init hosting
```

4. Deploy:
```bash
firebase deploy
```

### Option 2: Any Web Host

Simply upload all files to your web server. The app works with any static hosting service.

## 📱 Usage

### For Users

1. **Register/Login**: Use Google or email/password
2. **Browse Tasks**: View available tasks and their rewards
3. **Start Task**: Click on a task card to begin
4. **Android Check**: Confirm Android version (14+ required)
5. **Initial Verification**: Submit Game ID and profile screenshot
6. **Wait for Approval**: Admin reviews your submission
7. **Complete Task**: Follow instructions after approval
8. **Final Verification**: Submit stage completion screenshot
9. **Earn Reward**: Wallet is credited after final approval
10. **Withdraw**: Request withdrawal via GCash, Bank, or PayPal

### For Admins

1. **Login**: Use admin account to access admin panel
2. **Manage Tasks**: Create, edit, or delete tasks
3. **Review Verifications**: Approve or reject user submissions
4. **Process Withdrawals**: Mark withdrawals as paid or rejected
5. **Monitor Activity**: View all user activities and transactions

## 🗂️ Database Structure

### Users Collection
```javascript
{
  id: "uid123",
  email: "user@example.com",
  walletBalance: 150,
  isAdmin: false,
  createdAt: "2025-01-13T12:00:00Z"
}
```

### Tasks Collection
```javascript
{
  id: "task_battle_of_soul",
  title: "Battle of Soul Stage 0-18",
  reward: 50,
  banner: "https://example.com/banner.jpg",
  description: "Complete stages 0-18 in Battle of Soul",
  status: "active",
  createdAt: "2025-01-13T12:00:00Z"
}
```

### Verifications Collection
```javascript
{
  id: "verif123",
  userId: "uid123",
  taskId: "task_battle_of_soul",
  phase: "initial", // or "final"
  gameId: "123456789",
  androidVersion: 14,
  profileScreenshot: "https://storage.url/profile.jpg",
  stageScreenshot: "https://storage.url/stage.jpg",
  status: "pending", // or "approved", "rejected"
  createdAt: "2025-01-13T12:00:00Z"
}
```

### Withdrawals Collection
```javascript
{
  id: "wd123",
  userId: "uid123",
  amount: 100,
  method: "gcash", // or "bank", "paypal"
  account: "09123456789",
  status: "pending", // or "paid", "rejected"
  createdAt: "2025-01-13T12:00:00Z"
}
```

## 🎨 Customization

### Styling
- All styles use TailwindCSS classes
- Custom styles in `styles.css`
- Mobile-first responsive design
- Easy to customize colors and layout

### Features
- Modular JavaScript architecture
- Easy to add new task types
- Extensible verification system
- Customizable reward amounts

## 🔒 Security Features

- **Authentication**: Firebase Auth with Google OAuth
- **Authorization**: Role-based access control
- **Data Validation**: Client and server-side validation
- **Secure Storage**: Firebase Storage with proper rules
- **Real-time Security**: Firestore security rules

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Config Error**: Ensure all config values are correct
2. **Permission Denied**: Check Firestore security rules
3. **Image Upload Fails**: Verify Storage rules and file size limits
4. **Admin Panel Not Showing**: Set `isAdmin: true` in user document

### Debug Mode
- Open browser console for detailed error messages
- Check Firebase Console for authentication and database logs

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Firebase Console logs
3. Verify security rules are properly configured

## 📄 License

This project is open source and available under the MIT License.

---

**Note**: This application is designed for educational and development purposes. Ensure compliance with all applicable laws and regulations when deploying for production use.
