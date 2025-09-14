// Authentication Module - Simplified for separate HTML files
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.init();
    }

    init() {
        console.log('🔐 Initializing AuthManager...');

        // Listen for auth state changes
        auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? user.email : 'No user');
            if (user) {
                this.currentUser = user;
                console.log('User logged in, checking admin status...');
                await this.checkAdminStatus();
                console.log('Admin status:', this.isAdmin);

                // Redirect based on admin status
                this.redirectBasedOnStatus();
            } else {
                console.log('No user, redirecting to login...');
                this.currentUser = null;
                this.isAdmin = false;
                this.redirectToLogin();
            }
        });
    }

    async checkAdminStatus() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                this.isAdmin = userDoc.data().isAdmin || false;
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
        }
    }

    redirectBasedOnStatus() {
        // Check if we're already on the correct page
        const currentPage = window.location.pathname;

        // Don't redirect if we're on login or register pages
        if (currentPage.includes('/login/') || currentPage.includes('/register/')) {
            console.log('🔐 On login/register page, not redirecting');
            return;
        }

        if (this.isAdmin && !currentPage.includes('/admin/')) {
            console.log('👑 Redirecting to admin panel...');
            window.location.href = '/admin/';
        } else if (!this.isAdmin && !currentPage.includes('/dashboard/')) {
            console.log('👤 Redirecting to dashboard...');
            window.location.href = '/dashboard/';
        }
    }

    redirectToLogin() {
        const currentPage = window.location.pathname;
        if (!currentPage.includes('/login/') && !currentPage.includes('/register/')) {
            console.log('🔐 Redirecting to login...');
            window.location.href = '/login/';
        }
    }

    async createUserDocument(user) {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Create new user document
            await userRef.set({
                email: user.email,
                walletBalance: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            });
        } else {
            // Update existing user document if needed
            await userRef.update({
                email: user.email,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    signOut() {
        auth.signOut().then(() => {
            console.log('Successfully signed out!');
            window.location.href = '/login/';
        }).catch((error) => {
            console.error('Sign-out error:', error);
        });
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isUserAdmin() {
        return this.isAdmin;
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Initializing AuthManager...');
    window.authManager = new AuthManager();
    console.log('✅ AuthManager initialized');
});