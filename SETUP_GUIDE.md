# Questa Platform Setup Guide

## Prerequisites

Before setting up the Questa platform, ensure you have:

- A Google account for Firebase
- A GitHub account for Supabase (optional)
- A web hosting service (Firebase Hosting, Netlify, Vercel, etc.)
- Basic knowledge of web development

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: "Questa Platform"
4. Enable Google Analytics (optional)
5. Click "Create project"

### 1.2 Configure Authentication
1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Google" provider
5. Add your project support email
6. Save configuration

### 1.3 Set Up Firestore Database
1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

### 1.4 Configure Security Rules
Replace the default Firestore rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read tasks
    match /tasks/{taskId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can read/write their own verifications
    match /verifications/{verificationId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can read/write their own task statuses
    match /taskStatuses/{statusId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can read/write their own withdrawals
    match /withdrawals/{withdrawalId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can read/write their own notifications
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

### 1.5 Add Web App
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" and select web (</>)
4. Register app name: "Questa Web App"
5. Copy the Firebase configuration object

## Step 2: Supabase Setup

### 2.1 Create Supabase Project
1. Go to [Supabase](https://supabase.com/)
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New project"
5. Enter project name: "Questa Storage"
6. Enter database password
7. Select region closest to your users
8. Click "Create new project"

### 2.2 Configure Storage
1. In Supabase Dashboard, go to "Storage"
2. Click "Create a new bucket"
3. Name: "questa-uploads"
4. Make it public: Yes
5. Click "Create bucket"

### 2.3 Set Up RLS Policies
1. Go to "Authentication" > "Policies"
2. Create policy for storage bucket:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (true);
```

### 2.4 Get API Keys
1. Go to "Settings" > "API"
2. Copy the Project URL
3. Copy the anon public key

## Step 3: Platform Configuration

### 3.1 Update Firebase Configuration
Replace the configuration in `firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 3.2 Update Supabase Configuration
Replace the configuration in `supabase-config.js`:

```javascript
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key-here';
```

## Step 4: Admin Setup

### 4.1 Create Admin User
1. Deploy your platform to a hosting service
2. Access the login page
3. Sign in with your Google account
4. Go to Firebase Console > Firestore Database
5. Find your user document in the `users` collection
6. Edit the document and set `isAdmin: true`
7. Save the changes

### 4.2 Access Admin Panel
1. Go to `/admin.html` on your platform
2. You should now have access to the admin panel
3. Create sample tasks using the admin interface

## Step 5: Testing

### 5.1 Test User Flow
1. Create a test user account
2. Complete the registration process
3. Submit a verification (Phase 1)
4. Test the DNS configuration flow
5. Submit an Immutable link
6. Test the withdrawal process

### 5.2 Test Admin Functions
1. Approve/reject verifications
2. Review Immutable links
3. Process withdrawals
4. Manage user balances
5. Create new tasks

## Step 6: Deployment

### 6.1 Firebase Hosting (Recommended)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

### 6.2 Alternative Hosting
- **Netlify**: Drag and drop your files
- **Vercel**: Connect your GitHub repository
- **GitHub Pages**: Push to GitHub repository

## Step 7: Production Configuration

### 7.1 Update Security Rules
For production, update Firestore rules to be more restrictive:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // More restrictive rules for production
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /tasks/{taskId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Add more specific rules as needed
  }
}
```

### 7.2 Environment Variables
Set up environment variables for:
- Firebase configuration
- Supabase credentials
- Admin email addresses
- Support contact information

### 7.3 Monitoring
- Set up Firebase Analytics
- Configure error reporting
- Monitor performance metrics
- Set up alerts for critical issues

## Troubleshooting

### Common Issues

**Authentication Not Working:**
- Check Firebase configuration
- Verify Google OAuth is enabled
- Ensure domain is authorized

**File Uploads Failing:**
- Check Supabase configuration
- Verify RLS policies
- Check file size limits

**Admin Access Denied:**
- Verify `isAdmin: true` in user document
- Check Firestore security rules
- Clear browser cache

**Database Errors:**
- Check Firestore security rules
- Verify collection names
- Check field names and types

### Support
- Check Firebase documentation
- Review Supabase documentation
- Check browser console for errors
- Verify network connectivity

## Maintenance

### Regular Tasks
- Monitor user registrations
- Review admin actions
- Check system performance
- Update security rules as needed
- Backup important data

### Updates
- Keep Firebase SDK updated
- Update Supabase client
- Monitor for security updates
- Test new features thoroughly

This setup guide will help you deploy and configure the Questa platform successfully.

