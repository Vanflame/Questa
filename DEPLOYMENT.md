# Deployment Guide for TaskEarn

This guide will help you deploy the TaskEarn application to Firebase Hosting.

## Prerequisites

1. **Node.js** installed on your system
2. **Firebase CLI** installed globally
3. **Firebase project** set up with all services enabled

## Step-by-Step Deployment

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### 3. Initialize Firebase Project

Navigate to your project directory and run:

```bash
firebase init hosting
```

When prompted:
- **Select your Firebase project** from the list
- **Public directory**: `.` (current directory)
- **Single-page app**: `No`
- **Overwrite index.html**: `No` (unless you want to start fresh)

### 4. Configure Firebase Hosting

A `firebase.json` file will be created. It should look like this:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 5. Update Firebase Configuration

Make sure your `firebase-config.js` file has the correct configuration for your project:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### 6. Set Up Firebase Services

#### Authentication
- Go to [Firebase Console](https://console.firebase.google.com)
- Navigate to **Authentication** → **Sign-in method**
- Enable **Google** and **Email/Password** providers
- Add your domain to authorized domains

#### Firestore Database
- Navigate to **Firestore Database**
- Create database in production mode
- Apply the security rules from the README

#### Storage
- Navigate to **Storage**
- Get started with default rules
- Apply the security rules from the README

### 7. Deploy to Firebase Hosting

```bash
firebase deploy
```

### 8. Verify Deployment

After deployment, you'll see a URL like:
```
https://your-project-id.web.app
```

Visit this URL to verify your application is working correctly.

## Environment-Specific Configuration

### Development Environment

For local development, you can use:

```bash
firebase serve
```

This will serve your app locally at `http://localhost:5000`

### Production Environment

Make sure to:

1. **Update authorized domains** in Firebase Authentication
2. **Set proper security rules** for Firestore and Storage
3. **Configure custom domain** (optional) in Firebase Hosting settings
4. **Enable HTTPS** (automatically enabled by Firebase)

## Post-Deployment Setup

### 1. Create Admin User

1. Register a user account through your deployed app
2. Go to Firebase Console → Firestore Database
3. Find the user document in the `users` collection
4. Set `isAdmin: true` in the user document

### 2. Add Sample Data (Optional)

Open browser console on your deployed site and run:

```javascript
addSampleTasks(); // Adds sample tasks
```

### 3. Test All Features

- User registration/login
- Task creation and management
- Verification process
- Withdrawal system
- Admin panel functionality

## Troubleshooting

### Common Issues

1. **Authentication not working**
   - Check if providers are enabled in Firebase Console
   - Verify authorized domains include your hosting URL

2. **Database permission denied**
   - Review Firestore security rules
   - Ensure rules match your authentication setup

3. **Image uploads failing**
   - Check Storage security rules
   - Verify file size limits and allowed file types

4. **Admin panel not showing**
   - Verify user has `isAdmin: true` in Firestore
   - Check if user is properly authenticated

### Debug Mode

For debugging in production:

1. Open browser developer tools
2. Check console for errors
3. Review Firebase Console logs
4. Verify network requests in Network tab

## Security Considerations

1. **Never commit sensitive data** to version control
2. **Use environment variables** for sensitive configuration
3. **Regularly review security rules**
4. **Monitor Firebase usage** and set up billing alerts
5. **Enable Firebase App Check** for additional security

## Monitoring and Maintenance

1. **Monitor Firebase usage** in the console
2. **Set up billing alerts** to avoid unexpected charges
3. **Regularly backup Firestore data**
4. **Monitor application performance** and user feedback
5. **Keep Firebase CLI updated**

## Custom Domain Setup (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the DNS configuration instructions
4. Wait for SSL certificate provisioning
5. Update authorized domains in Authentication

## Scaling Considerations

As your application grows:

1. **Implement caching strategies**
2. **Use Firebase Functions** for server-side logic
3. **Set up monitoring and analytics**
4. **Consider CDN for static assets**
5. **Implement rate limiting** for API calls

---

Your TaskEarn application should now be successfully deployed and ready for users!
