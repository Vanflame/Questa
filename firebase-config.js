// Firebase Configuration
// Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDUh9tOOzjU96_YWJN9rXP_RxlV_HszG_A",
    authDomain: "ts-earn-42a77.firebaseapp.com",
    projectId: "ts-earn-42a77",
    storageBucket: "ts-earn-42a77.firebasestorage.app",
    messagingSenderId: "140875654654",
    appId: "1:140875654654:web:917d60947f8e32c8394caf",
    measurementId: "G-4G2RS8K6TP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other files
window.auth = auth;
window.db = db;

console.log('Firebase initialized successfully');
