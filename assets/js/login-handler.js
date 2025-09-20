// Login Page Handler
class LoginHandler {
    constructor() {
        this.isSigningIn = false;
        this.init();
    }

    init() {
        console.log('🔐 Initializing Login Handler...');

        // Clear any existing loading modals on page load
        this.hideAllLoadingModals();

        // Suppress COOP warnings (they're not critical for functionality)
        this.suppressCOOPWarnings();

        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
            this.setupEventListeners();
            this.checkAuthState();
        });
    }

    suppressCOOPWarnings() {
        // Override console.warn to filter out only specific Firebase COOP warnings
        const originalWarn = console.warn;
        console.warn = function (...args) {
            const message = args.join(' ');
            // Only suppress specific Firebase COOP warnings, not all warnings
            if (message.includes('Cross-Origin-Opener-Policy policy would block the window.closed call') ||
                (message.includes('Cross-Origin-Opener-Policy') && message.includes('popup.ts')) ||
                (message.includes('Cross-Origin-Opener-Policy') && message.includes('Firebase'))) {
                // Suppress only Firebase COOP warnings as they don't affect functionality
                return;
            }
            originalWarn.apply(console, args);
        };
    }

    async waitForFirebase() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' &&
                    typeof window.auth !== 'undefined' &&
                    typeof window.db !== 'undefined') {
                    console.log('✅ Firebase ready');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    setupEventListeners() {
        // Google login
        document.getElementById('google-login').addEventListener('click', () => {
            this.signInWithGoogle();
        });

        // Add right-click context menu for Google login (alternative method)
        document.getElementById('google-login').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.signInWithGoogleRedirect();
        });

        // Email login/register
        document.getElementById('email-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.signInWithEmail();
        });

        // Register button now redirects to register page (handled in HTML onclick)

        // Password toggle
        document.getElementById('password-toggle').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // Real-time validation
        document.getElementById('email').addEventListener('input', () => {
            this.validateEmail();
        });

        document.getElementById('password').addEventListener('input', () => {
            this.validatePassword();
        });
    }

    checkAuthState() {
        // Check if user is already logged in - but don't auto-redirect
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 User already logged in on login page');
                // Don't auto-redirect, let user choose to login or register
            }
        });

        // Handle redirect result for Google OAuth
        this.handleRedirectResult();
    }

    async handleRedirectResult() {
        try {
            const result = await auth.getRedirectResult();
            if (result.credential) {
                console.log('✅ Google sign-in successful via redirect');

                // Hide any existing loading modals
                this.hideAllLoadingModals();

                this.showToast('Successfully signed in with Google!', 'success');

                // Create or update user document
                await this.createUserDocument(result.user);

                // Redirect to dashboard
                this.redirectToDashboard();
            }
        } catch (error) {
            console.error('Error handling redirect result:', error);
            // Hide any existing loading modals on error
            this.hideAllLoadingModals();
            // Don't show error toast here as it might be confusing
        }
    }

    async signInWithGoogle() {
        let loadingModal = null;

        try {
            this.isSigningIn = true;
            loadingModal = this.showLoadingModal('Signing In', 'Please wait while we sign you in with Google...');

            // Debug: Check if Firebase auth is properly initialized
            if (!auth) {
                throw new Error('Firebase Auth is not initialized');
            }

            const provider = new firebase.auth.GoogleAuthProvider();

            // Add additional scopes if needed
            provider.addScope('email');
            provider.addScope('profile');

            // Set custom parameters
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            console.log('🔐 Attempting Google sign-in...');
            console.log('🔍 Provider config:', {
                providerId: provider.providerId,
                scopes: provider.scopes,
                customParameters: provider.customParameters
            });

            // Try popup first, fallback to redirect if popup is blocked
            let result;
            try {
                result = await auth.signInWithPopup(provider);
                console.log('✅ Google sign-in successful via popup');
            } catch (popupError) {
                console.warn('⚠️ Popup error, checking if we should try redirect:', popupError);

                // Check for popup-related errors or COOP issues
                if (popupError.code === 'auth/popup-blocked' ||
                    popupError.code === 'auth/popup-closed-by-user' ||
                    popupError.message.includes('popup') ||
                    popupError.message.includes('Cross-Origin-Opener-Policy') ||
                    popupError.message.includes('COOP') ||
                    popupError.message.includes('window.closed')) {

                    this.hideLoadingModal(loadingModal);
                    this.showToast('Popup blocked by browser. Redirecting to Google sign-in...', 'info');

                    // Use redirect method - no loading modal needed as page will reload
                    await auth.signInWithRedirect(provider);
                    return; // The page will reload after redirect
                } else {
                    throw popupError; // Re-throw if it's not a popup-related error
                }
            }

            // Create or update user document
            await this.createUserDocument(result.user);

            this.showToast('Successfully signed in with Google!', 'success');
            this.redirectToDashboard();
        } catch (error) {
            console.error('Google sign-in error:', error);
            let errorMessage = 'Failed to sign in with Google';

            // Handle specific OAuth errors
            switch (error.code) {
                case 'auth/popup-blocked':
                    errorMessage = 'Popup blocked by browser. Please allow popups for this site and try again, or right-click the Google button and select "Open in new tab".';
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Sign-in cancelled. Please try again.';
                    break;
                case 'auth/account-exists-with-different-credential':
                    errorMessage = 'An account already exists with this email using a different sign-in method.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Google sign-in is not enabled. Please contact support.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = 'This domain is not authorized for Google sign-in.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection and try again.';
                    break;
                default:
                    errorMessage = `Failed to sign in with Google: ${error.message}`;
            }

            this.showToast(errorMessage, 'error');
        } finally {
            this.isSigningIn = false;
            this.hideLoadingModal(loadingModal);
        }
    }

    async signInWithGoogleRedirect() {
        try {
            console.log('🔐 Attempting Google sign-in via redirect...');

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            this.showToast('Redirecting to Google sign-in...', 'info');

            // Use redirect method
            await auth.signInWithRedirect(provider);
        } catch (error) {
            console.error('Google redirect sign-in error:', error);
            this.showToast('Failed to redirect to Google sign-in: ' + error.message, 'error');
        }
    }

    async signInWithEmail() {
        let loadingModal = null;

        try {
            // Validate form before submission
            if (!this.validateForm()) {
                return;
            }

            this.isSigningIn = true;
            loadingModal = this.showLoadingModal('Signing In', 'Please wait while we sign you in...');

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            const result = await auth.signInWithEmailAndPassword(email, password);
            await this.createUserDocument(result.user);

            this.showToast('Successfully signed in!', 'success');
            this.redirectToDashboard();
        } catch (error) {
            console.error('Email sign-in error:', error);
            this.handleAuthError(error);
        } finally {
            this.isSigningIn = false;
            this.hideLoadingModal(loadingModal);
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

    redirectToDashboard() {
        // Check if user is admin
        const currentUser = auth.currentUser;
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).get().then((doc) => {
                if (doc.exists && doc.data().isAdmin) {
                    if (!window.location.pathname.includes('/admin/')) {
                        window.location.href = '/admin/';
                    }
                } else {
                    if (!window.location.pathname.includes('/dashboard/')) {
                        window.location.href = '/dashboard/';
                    }
                }
            }).catch(() => {
                // Default to dashboard if admin check fails
                if (!window.location.pathname.includes('/dashboard/')) {
                    window.location.href = '/dashboard/';
                }
            });
        }
    }

    // Modern loading modal functions (same as dashboard)
    showLoadingModal(title = 'Loading...', message = 'Please wait while we process your request') {
        // Remove existing loading modal if any
        const existingModal = document.querySelector('.loading-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create loading modal
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.innerHTML = `
            <div class="loading-modal-content">
                <div class="loading-spinner"></div>
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;

        document.body.appendChild(modal);

        // Trigger animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        return modal;
    }

    hideLoadingModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    hideAllLoadingModals() {
        // Hide all loading modals on the page
        const loadingModals = document.querySelectorAll('.loading-modal');
        loadingModals.forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        });
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Validation Methods
    validateForm() {
        const emailValid = this.validateEmail();
        const passwordValid = this.validatePassword();

        return emailValid && passwordValid;
    }

    validateEmail() {
        const emailInput = document.getElementById('email');
        const emailError = document.getElementById('email-error');
        const email = emailInput.value.trim();

        // Clear previous error
        emailInput.classList.remove('error');
        emailError.textContent = '';

        if (!email) {
            emailInput.classList.add('error');
            emailError.textContent = 'Email is required';
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            emailInput.classList.add('error');
            emailError.textContent = 'Please enter a valid email address';
            return false;
        }

        return true;
    }

    validatePassword() {
        const passwordInput = document.getElementById('password');
        const passwordError = document.getElementById('password-error');
        const password = passwordInput.value;

        // Clear previous error
        passwordInput.classList.remove('error');
        passwordError.textContent = '';

        if (!password) {
            passwordInput.classList.add('error');
            passwordError.textContent = 'Password is required';
            return false;
        }

        return true;
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('password-toggle');
        const icon = toggleBtn.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    handleAuthError(error) {
        let errorMessage = 'An error occurred. Please try again.';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later';
                break;
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please choose a stronger password';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'This sign-in method is not enabled';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection';
                break;
            default:
                errorMessage = error.message || errorMessage;
        }

        this.showToast(errorMessage, 'error');
    }
}

// Initialize login handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.loginHandler = new LoginHandler();
});
