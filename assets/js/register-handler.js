// Register Page Handler
class RegisterHandler {
    constructor() {
        this.isRegistering = false;
        this.isRedirecting = false;
        this.init();
    }

    init() {
        console.log('🔐 Initializing Register Handler...');
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Current pathname:', window.location.pathname);

        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
            this.setupEventListeners();
            // Don't check auth state on register page to prevent auto-redirects
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
        // Google register
        document.getElementById('google-register').addEventListener('click', () => {
            this.signInWithGoogle();
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.registerWithEmail();
        });

        // Login button
        document.getElementById('login-btn').addEventListener('click', () => {
            window.location.href = '/login/';
        });

        // Password toggles
        document.getElementById('register-password-toggle').addEventListener('click', () => {
            this.togglePasswordVisibility('register-password', 'register-password-toggle');
        });

        document.getElementById('confirm-password-toggle').addEventListener('click', () => {
            this.togglePasswordVisibility('confirm-password', 'confirm-password-toggle');
        });

        // Real-time validation
        document.getElementById('register-email').addEventListener('input', () => {
            this.validateEmail();
        });

        document.getElementById('register-password').addEventListener('input', () => {
            this.validatePassword();
        });

        document.getElementById('confirm-password').addEventListener('input', () => {
            this.validateConfirmPassword();
        });

        document.getElementById('terms-checkbox').addEventListener('change', () => {
            this.validateTerms();
        });
    }


    async signInWithGoogle() {
        try {
            this.isRegistering = true;
            this.showLoading(true);
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);

            // Create or update user document
            await this.createUserDocument(result.user);

            this.showToast('Account created successfully with Google!', 'success');
            this.redirectToDashboard();
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showToast('Failed to create account with Google: ' + error.message, 'error');
        } finally {
            this.isRegistering = false;
            this.showLoading(false);
        }
    }

    async registerWithEmail() {
        try {
            // Validate form before submission
            console.log('🔍 Validating form...');
            if (!this.validateForm()) {
                console.log('❌ Form validation failed');
                this.showToast('Please fix the errors above before submitting', 'error');
                return;
            }
            console.log('✅ Form validation passed');

            console.log('🔄 Starting email registration...');
            this.isRegistering = true;
            this.showLoading(true);
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;

            const result = await auth.createUserWithEmailAndPassword(email, password);
            console.log('✅ User created:', result.user.email);
            await this.createUserDocument(result.user);

            this.showToast('Account created successfully!', 'success');
            console.log('🔄 Redirecting to dashboard...');
            this.redirectToDashboard();
        } catch (error) {
            console.error('Registration error:', error);
            this.handleAuthError(error);
        } finally {
            this.isRegistering = false;
            this.showLoading(false);
        }
    }

    async createUserDocument(user) {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Create new user document
            await userRef.set({
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                walletBalance: 0,
                status: 'active',
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
        // Prevent multiple redirects
        if (this.isRedirecting) {
            console.log('⚠️ Already redirecting, skipping...');
            return;
        }

        this.isRedirecting = true;

        // Check if user is admin
        const currentUser = auth.currentUser;
        console.log('🔄 Redirecting user:', currentUser?.email);

        if (currentUser) {
            db.collection('users').doc(currentUser.uid).get().then((doc) => {
                const userData = doc.data();
                console.log('👤 User data:', userData);

                if (doc.exists && userData.isAdmin) {
                    console.log('👑 Admin user, redirecting to admin panel');
                    if (!window.location.pathname.includes('/admin/')) {
                        setTimeout(() => {
                            window.location.href = '/admin/';
                        }, 1000);
                    }
                } else {
                    console.log('👤 Regular user, redirecting to dashboard');
                    if (!window.location.pathname.includes('/dashboard/')) {
                        setTimeout(() => {
                            window.location.href = '/dashboard/';
                        }, 1000);
                    }
                }
            }).catch((error) => {
                console.error('❌ Error checking user data:', error);
                // Default to dashboard if admin check fails
                if (!window.location.pathname.includes('/dashboard/')) {
                    setTimeout(() => {
                        window.location.href = '/dashboard/';
                    }, 1000);
                }
            });
        }
    }

    showLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
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
        console.log('🔍 Running form validation...');
        const emailValid = this.validateEmail();
        const passwordValid = this.validatePassword();
        const confirmPasswordValid = this.validateConfirmPassword();
        const termsValid = this.validateTerms();

        console.log('📊 Validation results:', {
            email: emailValid,
            password: passwordValid,
            confirmPassword: confirmPasswordValid,
            terms: termsValid
        });

        return emailValid && passwordValid && confirmPasswordValid && termsValid;
    }

    validateEmail() {
        const emailInput = document.getElementById('register-email');
        const emailError = document.getElementById('register-email-error');
        const email = emailInput.value.trim();

        console.log('🔍 Validating email:', email);

        // Clear previous error
        emailInput.classList.remove('error');
        emailError.textContent = '';

        if (!email) {
            console.log('❌ Email is empty');
            emailInput.classList.add('error');
            emailError.textContent = 'Email is required';
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Email format invalid');
            emailInput.classList.add('error');
            emailError.textContent = 'Please enter a valid email address';
            return false;
        }

        console.log('✅ Email validation passed');
        return true;
    }

    validatePassword() {
        const passwordInput = document.getElementById('register-password');
        const passwordError = document.getElementById('register-password-error');
        const password = passwordInput.value;

        console.log('🔍 Validating password (length:', password.length, ')');

        // Clear previous error
        passwordInput.classList.remove('error');
        passwordError.textContent = '';

        if (!password) {
            console.log('❌ Password is empty');
            passwordInput.classList.add('error');
            passwordError.textContent = 'Password is required';
            return false;
        }

        if (password.length < 6) {
            console.log('❌ Password too short');
            passwordInput.classList.add('error');
            passwordError.textContent = 'Password must be at least 6 characters long';
            return false;
        }

        // Check for at least one letter and one number
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);

        if (!hasLetter || !hasNumber) {
            console.log('❌ Password missing letter or number');
            passwordInput.classList.add('error');
            passwordError.textContent = 'Password must contain at least one letter and one number';
            return false;
        }

        // Re-validate confirm password if it has a value
        const confirmPassword = document.getElementById('confirm-password').value;
        if (confirmPassword) {
            this.validateConfirmPassword();
        }

        console.log('✅ Password validation passed');
        return true;
    }

    validateConfirmPassword() {
        const confirmPasswordInput = document.getElementById('confirm-password');
        const confirmPasswordError = document.getElementById('confirm-password-error');
        const confirmPassword = confirmPasswordInput.value;
        const password = document.getElementById('register-password').value;

        console.log('🔍 Validating confirm password');

        // Clear previous error
        confirmPasswordInput.classList.remove('error');
        confirmPasswordError.textContent = '';

        if (!confirmPassword) {
            console.log('❌ Confirm password is empty');
            confirmPasswordInput.classList.add('error');
            confirmPasswordError.textContent = 'Please confirm your password';
            return false;
        }

        if (confirmPassword !== password) {
            console.log('❌ Passwords do not match');
            confirmPasswordInput.classList.add('error');
            confirmPasswordError.textContent = 'Passwords do not match';
            return false;
        }

        console.log('✅ Confirm password validation passed');
        return true;
    }

    validateTerms() {
        const termsCheckbox = document.getElementById('terms-checkbox');
        const termsError = document.getElementById('terms-error');
        const checkboxContainer = termsCheckbox.closest('.modern-checkbox-container');

        console.log('🔍 Validating terms checkbox:', termsCheckbox.checked);

        // Clear previous error
        if (termsError) {
            termsError.textContent = '';
        }

        if (checkboxContainer) {
            checkboxContainer.classList.remove('error');
        }

        if (!termsCheckbox.checked) {
            console.log('❌ Terms not agreed to');
            if (termsError) {
                termsError.textContent = 'You must agree to the terms and conditions';
            }
            if (checkboxContainer) {
                checkboxContainer.classList.add('error');
            }
            return false;
        }

        console.log('✅ Terms validation passed');
        return true;
    }

    togglePasswordVisibility(inputId, toggleId) {
        const passwordInput = document.getElementById(inputId);
        const toggleBtn = document.getElementById(toggleId);
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
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
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

// Initialize register handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.registerHandler = new RegisterHandler();
});
