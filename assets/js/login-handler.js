// Login Page Handler
class LoginHandler {
    constructor() {
        this.isSigningIn = false;
        this.init();
    }

    init() {
        console.log('🔐 Initializing Login Handler...');

        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
            this.setupEventListeners();
            this.checkAuthState();
        });
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
    }

    async signInWithGoogle() {
        let loadingModal = null;

        try {
            this.isSigningIn = true;
            loadingModal = this.showLoadingModal('Signing In', 'Please wait while we sign you in with Google...');

            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);

            // Create or update user document
            await this.createUserDocument(result.user);

            this.showToast('Successfully signed in with Google!', 'success');
            this.redirectToDashboard();
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showToast('Failed to sign in with Google: ' + error.message, 'error');
        } finally {
            this.isSigningIn = false;
            this.hideLoadingModal(loadingModal);
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
