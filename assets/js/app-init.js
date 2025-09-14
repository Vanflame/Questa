// Application Initialization Module
// This ensures all modules are properly loaded and initialized

class AppInitializer {
    constructor() {
        this.modules = {
            firebase: false,
            auth: false,
            firestore: false,
            storage: false,
            authManager: false,
            app: false,
            adminManager: false
        };
        this.init();
    }

    init() {
        console.log('🚀 AppInitializer starting...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeModules();
            });
        } else {
            this.initializeModules();
        }
    }

    async initializeModules() {
        console.log('📦 Initializing modules...');

        try {
            // Check Firebase
            await this.checkFirebase();

            // Check Auth Manager
            await this.checkAuthManager();

            // Check App
            await this.checkApp();

            // Check Admin Manager
            await this.checkAdminManager();

            console.log('✅ All modules initialized successfully');
            this.onAllModulesReady();

        } catch (error) {
            console.error('❌ Module initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    async checkFirebase() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' &&
                    typeof window.auth !== 'undefined' &&
                    typeof window.db !== 'undefined' &&
                    typeof window.storage !== 'undefined') {

                    this.modules.firebase = true;
                    console.log('✅ Firebase modules loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Firebase modules failed to load'));
            }, 10000);
        });
    }

    async checkAuthManager() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof window.authManager !== 'undefined') {
                    this.modules.authManager = true;
                    console.log('✅ AuthManager loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('AuthManager failed to load'));
            }, 5000);
        });
    }

    async checkApp() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof window.app !== 'undefined') {
                    this.modules.app = true;
                    console.log('✅ App loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('App failed to load'));
            }, 5000);
        });
    }

    async checkAdminManager() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof window.adminManager !== 'undefined') {
                    this.modules.adminManager = true;
                    console.log('✅ AdminManager loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('AdminManager failed to load'));
            }, 5000);
        });
    }

    onAllModulesReady() {
        console.log('🎉 All modules ready! Setting up application...');

        // Force check authentication state
        if (window.authManager) {
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                console.log('👤 User already logged in:', currentUser.email);
                // Force dashboard display
                setTimeout(() => {
                    this.forceDashboardDisplay();
                }, 500);
            }
        }
    }

    handleInitializationError(error) {
        console.error('💥 Initialization error:', error);

        // Show error message to user
        this.showErrorToast('Application failed to initialize properly. Please refresh the page.');

        // Try to show dashboard anyway
        setTimeout(() => {
            this.forceDashboardDisplay();
        }, 1000);
    }

    forceDashboardDisplay() {
        console.log('🔧 Force displaying dashboard...');

        const loginPage = document.getElementById('login-page');
        const dashboard = document.getElementById('dashboard');
        const adminPanel = document.getElementById('admin-panel');

        if (!loginPage || !dashboard) {
            console.error('❌ Required elements not found');
            return;
        }

        // Check if user is logged in
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.log('👤 No user logged in, showing login page');
            loginPage.style.display = 'block';
            loginPage.classList.remove('hidden');
            dashboard.style.display = 'none';
            dashboard.classList.add('hidden');
            if (adminPanel) {
                adminPanel.style.display = 'none';
                adminPanel.classList.add('hidden');
            }
            return;
        }

        console.log('👤 User logged in, showing dashboard');

        // Hide login page
        loginPage.style.display = 'none';
        loginPage.classList.add('hidden');

        // Show dashboard
        dashboard.style.display = 'block';
        dashboard.classList.remove('hidden');

        // Hide admin panel initially
        if (adminPanel) {
            adminPanel.style.display = 'none';
            adminPanel.classList.add('hidden');
        }

        // Show profile tab
        const profileTab = document.getElementById('profile-tab');
        if (profileTab) {
            profileTab.style.display = 'block';
            profileTab.classList.remove('hidden');
        }

        // Hide other tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id !== 'profile-tab') {
                tab.style.display = 'none';
                tab.classList.add('hidden');
            }
        });

        // Update navigation
        this.updateNavigation();

        // Load user data
        this.loadUserData(currentUser);

        console.log('✅ Dashboard force displayed');
    }

    updateNavigation() {
        const navButtons = document.getElementById('nav-buttons');
        if (!navButtons) return;

        navButtons.innerHTML = `
            <button id="logout-btn" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
        `;

        // Add logout event listener
        document.getElementById('logout-btn').addEventListener('click', () => {
            firebase.auth().signOut();
        });
    }

    async loadUserData(user) {
        try {
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                return;
            }

            const userDoc = await window.firestoreManager.getUser(user.uid);
            if (userDoc) {
                // Update UI with user data
                const userEmail = document.getElementById('user-email');
                const userUid = document.getElementById('user-uid');
                const walletBalance = document.getElementById('wallet-balance');
                const walletBalanceDisplay = document.getElementById('wallet-balance-display');

                if (userEmail) userEmail.textContent = userDoc.email;
                if (userUid) userUid.textContent = user.uid;
                if (walletBalance) walletBalance.textContent = `₱${userDoc.walletBalance || 0}`;
                if (walletBalanceDisplay) walletBalanceDisplay.textContent = `₱${userDoc.walletBalance || 0}`;

                console.log('✅ User data loaded');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    showErrorToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 1rem;
            background-color: #ef4444;
            color: white;
            border-radius: 0.375rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            font-weight: 500;
            max-width: 20rem;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize the app initializer
window.appInitializer = new AppInitializer();

// Export for debugging
window.AppInitializer = AppInitializer;
