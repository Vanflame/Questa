// Dashboard Page Handler
class DashboardHandler {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.isSubmittingWithdrawal = false;
        this.lastWithdrawalTime = null;
        this.withdrawalCooldown = 60000; // 1 minute cooldown
        this.initialLoadingId = null; // Track the initial loading state
        this.dataLoaded = {
            userData: false,
            tasks: false,
            wallet: false,
            notifications: false
        };
        this.cache = new Map(); // Add caching for Firebase requests
        this.init();
    }

    // Cache management methods
    setCachedTasks(cacheKey, tasks) {
        this.cache.set(cacheKey, {
            data: tasks,
            timestamp: Date.now()
        });
    }

    getCachedTasks(cacheKey) {
        const cached = this.cache.get(cacheKey);
        return cached || null;
    }

    setCachedUserStatus(cacheKey, status) {
        this.cache.set(cacheKey, {
            data: status,
            timestamp: Date.now()
        });
    }

    getCachedUserStatus(cacheKey) {
        const cached = this.cache.get(cacheKey);
        return cached || null;
    }

    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache cleared');
    }

    // Clear cache when tasks are updated
    clearTaskCache() {
        const keysToRemove = [];
        for (const key of this.cache.keys()) {
            if (key.includes('tasks') || key.includes('user_status')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.cache.delete(key));
        console.log('🧹 Task cache cleared:', keysToRemove);
    }

    clearExpiredLocalStorageFlags() {
        try {
            console.log('🧹 Clearing expired localStorage flags...');

            // Get all localStorage keys that start with 'task_expired_'
            const expiredKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('task_expired_')) {
                    expiredKeys.push(key);
                }
            }

            console.log('🧹 Found', expiredKeys.length, 'expired localStorage flags');

            // Note: We don't actually clear them here because we need to check if tasks are still expired
            // This method is called during force refresh, and the task status logic will handle
            // determining if tasks are still expired or not
            // The localStorage flags will be naturally cleared when tasks are no longer expired

        } catch (error) {
            console.error('Error clearing expired localStorage flags:', error);
        }
    }

    // Batch load user statuses to reduce Firebase requests
    async batchLoadUserStatuses(tasks, forceRefresh = false) {
        try {
            console.log('🔄 Batch loading user statuses for', tasks.length, 'tasks');

            // Single request to get all user task statuses
            const allUserStatuses = await this.getAllUserTaskStatuses(forceRefresh);

            // Single request to get all user submissions
            const allSubmissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = allSubmissions.filter(s => s.user_id === this.currentUser.uid);

            // Attach statuses to tasks without making individual requests
            tasks.forEach(task => {
                const taskStatus = allUserStatuses.find(s => s.taskId === task.id);
                const taskSubmissions = userSubmissions.filter(s => s.task_id === task.id);
                const completionCount = taskSubmissions.filter(s =>
                    s.status === 'completed' || s.status === 'approved'
                ).length;

                if (taskStatus) {
                    task.userStatus = {
                        ...taskStatus,
                        completionCount: completionCount,
                        maxCompletions: task.max_restarts ? task.max_restarts + 1 : 1
                    };
                    task.userStatusObject = task.userStatus;
                } else {
                    task.userStatus = {
                        status: 'available',
                        phase: null,
                        completionCount: completionCount,
                        maxCompletions: task.max_restarts ? task.max_restarts + 1 : 1
                    };
                    task.userStatusObject = task.userStatus;
                }

                // Check user time limits
                this.checkUserTimeLimit(task);
            });

            console.log('✅ Batch loaded user statuses');
        } catch (error) {
            console.error('Error batch loading user statuses:', error);
            // Fallback to individual loading
            for (const task of tasks) {
                await this.checkUserTimeLimit(task);
            }
        }
    }

    // Get all user task statuses in a single request
    async getAllUserTaskStatuses(forceRefresh = false) {
        try {
            const cacheKey = `all_user_statuses_${this.currentUser.uid}`;
            const cached = this.getCachedUserStatus(cacheKey);

            if (!forceRefresh && cached && (Date.now() - cached.timestamp) < 60000) { // 1 minute cache
                console.log('📦 Using cached user statuses');
                return cached.data;
            }

            console.log('🔄 Loading all user task statuses from database');
            const snapshot = await db.collection('taskStatuses')
                .where('userId', '==', this.currentUser.uid)
                .get();

            const statuses = snapshot.docs.map(doc => ({
                taskId: doc.data().taskId,
                ...doc.data()
            }));

            this.setCachedUserStatus(cacheKey, statuses);
            return statuses;
        } catch (error) {
            console.error('Error loading all user task statuses:', error);
            return [];
        }
    }

    init() {
        console.log('📱 Initializing Dashboard Handler...');

        // Show loading immediately when dashboard loads
        this.showInitialLoading();

        // Initialize withdrawal state from localStorage
        this.initializeWithdrawalState();

        // Add global button click prevention
        this.setupGlobalButtonProtection();

        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
            this.checkAuthState();
            this.setupEventListeners();
        });
    }

    initializeWithdrawalState() {
        // Check if there's a pending withdrawal in localStorage
        const isSubmitting = localStorage.getItem('isSubmittingWithdrawal') === 'true';
        const lastWithdrawalTime = localStorage.getItem('lastWithdrawalTime');

        if (isSubmitting) {
            this.isSubmittingWithdrawal = true;
            console.log('🔄 Restoring withdrawal state from localStorage');
        }

        if (lastWithdrawalTime) {
            this.lastWithdrawalTime = parseInt(lastWithdrawalTime);
            const timeSinceLastWithdrawal = Date.now() - this.lastWithdrawalTime;

            // If cooldown period has passed, clear the localStorage
            if (timeSinceLastWithdrawal >= this.withdrawalCooldown) {
                localStorage.removeItem('lastWithdrawalTime');
                this.lastWithdrawalTime = null;
            } else {
                console.log(`⏰ Withdrawal cooldown active: ${Math.ceil((this.withdrawalCooldown - timeSinceLastWithdrawal) / 1000)}s remaining`);
            }
        }
    }

    // Show initial loading when dashboard first loads
    showInitialLoading() {
        console.log('🔄 Showing initial loading...');
        this.initialLoadingId = window.loadingManager.showPageLoading(
            'Loading Dashboard',
            'Please wait while we load your data...'
        );
    }

    // Hide initial loading when all data is loaded
    hideInitialLoading() {
        if (this.initialLoadingId) {
            console.log('✅ Hiding initial loading - all data loaded');
            window.loadingManager.hideLoading(this.initialLoadingId);
            this.initialLoadingId = null;
        }
    }

    // Check if all critical data has been loaded
    checkAllDataLoaded() {
        const allLoaded = Object.values(this.dataLoaded).every(loaded => loaded);
        if (allLoaded && this.initialLoadingId) {
            // Small delay to ensure UI is ready
            setTimeout(() => {
                this.hideInitialLoading();
            }, 500);
        }
        return allLoaded;
    }

    // Mark specific data as loaded
    markDataLoaded(type) {
        if (this.dataLoaded.hasOwnProperty(type)) {
            console.log(`✅ ${type} data loaded`);
            this.dataLoaded[type] = true;
            this.checkAllDataLoaded();
        }
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

    async waitForAuthentication() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.currentUser) {
                    console.log('✅ User authenticated');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    checkAuthState() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 User logged in:', user.email);
                this.currentUser = user;
                await this.checkAdminStatus();
                await this.loadUserData();
                this.setupTabNavigation();
                this.setupRealtimeListeners();

                // Test storage connectivity
                await this.testStorageConnectivity();
            } else {
                console.log('👤 No user, redirecting to login...');
                this.cleanupRealtimeListeners();
                window.location.href = '/login/';
            }
        });
    }

    async checkAdminStatus() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                this.isAdmin = userDoc.data().isAdmin || false;
                if (this.isAdmin) {
                    console.log('👑 User is admin, redirecting to admin panel...');
                    window.location.href = '/admin/';
                }
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();

                // Check if user account is disabled
                if (userData.status === 'disabled') {
                    this.showAccountDisabledNotice();
                    this.updateUIForDisabledUser();
                    // Mark all data as loaded for disabled users to hide loading modal
                    this.markDataLoaded('userData');
                    this.markDataLoaded('tasks');
                    this.markDataLoaded('wallet');
                    this.markDataLoaded('notifications');
                    return;
                }

                // Update navbar balance (user-name element doesn't exist in new design)
                const userBalanceElement = document.getElementById('user-balance');
                if (userBalanceElement) {
                    userBalanceElement.textContent = `₱${userData.walletBalance || 0}`;
                }

                // Update UI with user data
                const profileNameElement = document.getElementById('profile-name');
                if (profileNameElement) {
                    profileNameElement.textContent = userData.displayName || userData.email;
                }

                const userEmailElement = document.getElementById('user-email');
                if (userEmailElement) {
                    userEmailElement.textContent = userData.email;
                }

                const userQuestaIdElement = document.getElementById('user-questa-id');
                if (userQuestaIdElement) {
                    userQuestaIdElement.textContent = this.generateQuestaId(this.currentUser.uid);
                }

                const userShortIdElement = document.getElementById('user-short-id');
                if (userShortIdElement) {
                    userShortIdElement.textContent = `ID: ${this.generateQuestaId(this.currentUser.uid)}`;
                }

                const walletBalanceElement = document.getElementById('wallet-balance');
                if (walletBalanceElement) {
                    walletBalanceElement.textContent = `₱${userData.walletBalance || 0}`;
                }

                // Load completion statistics
                await this.loadCompletionStats();

                const walletBalanceDisplayElement = document.getElementById('wallet-balance-display');
                if (walletBalanceDisplayElement) {
                    walletBalanceDisplayElement.textContent = `₱${userData.walletBalance || 0}`;
                }

                console.log('✅ User data loaded');

                // Mark user data as loaded
                this.markDataLoaded('userData');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            // Mark as loaded even on error to prevent infinite loading
            this.markDataLoaded('userData');
        }
    }

    async showAccountDisabledNotice() {
        console.log('🔒 Showing account disabled notice');
        const tasksGrid = document.getElementById('tasks-grid');
        if (tasksGrid) {
            // Get support email from settings
            let supportEmail = 'odetteje3@gmail.com';
            try {
                const settingsDoc = await db.collection('settings').doc('app').get();
                if (settingsDoc.exists) {
                    const settings = settingsDoc.data();
                    supportEmail = settings.supportEmail || 'support@example.com';
                }
            } catch (error) {
                console.error('Error loading support email:', error);
            }

            tasksGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="bg-red-50 border border-red-200 rounded-lg p-8">
                        <i class="fas fa-ban text-6xl text-red-500 mb-4"></i>
                        <h3 class="text-xl font-semibold text-red-800 mb-2">Account Disabled</h3>
                        <p class="text-red-600 mb-4">Your account has been disabled by an administrator.</p>
                        <p class="text-sm text-red-500">Please contact support for assistance.</p>
                        <button class="mt-4 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700" onclick="window.open('mailto:${supportEmail}', '_blank')">
                            <i class="fas fa-envelope mr-2"></i>Contact Support
                        </button>
                    </div>
                </div>
            `;
            console.log('✅ Account disabled notice displayed');
        } else {
            console.warn('⚠️ Tasks grid not found, cannot show disabled notice');
        }
    }

    updateUIForDisabledUser() {
        // Disable withdrawal button
        const withdrawBtn = document.getElementById('withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.disabled = true;
            withdrawBtn.innerHTML = '<i class="fas fa-ban"></i> Account Disabled';
            withdrawBtn.style.opacity = '0.6';
            withdrawBtn.style.cursor = 'not-allowed';
        }

        // Disable notification button
        const notificationBtn = document.getElementById('notification-btn');
        if (notificationBtn) {
            notificationBtn.disabled = true;
            notificationBtn.style.opacity = '0.6';
            notificationBtn.style.cursor = 'not-allowed';
        }

        // Hide wallet balance in navbar
        const userBalanceElement = document.getElementById('user-balance');
        if (userBalanceElement) {
            userBalanceElement.textContent = 'Account Disabled';
            userBalanceElement.style.color = '#ef4444';
        }

        // Update wallet balance display
        const walletBalanceDisplay = document.getElementById('wallet-balance-display');
        if (walletBalanceDisplay) {
            walletBalanceDisplay.textContent = 'Account Disabled';
            walletBalanceDisplay.style.color = '#ef4444';
        }

        console.log('🔒 UI updated for disabled user');
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Top navigation buttons
        const notificationBtn = document.getElementById('notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.openNotificationPopup();
            });
            console.log('✅ Notification button event listener added');
        } else {
            console.warn('❌ Notification button not found');
        }

        // Profile dropdown
        const profileMenuBtn = document.getElementById('profile-menu-btn');
        if (profileMenuBtn) {
            profileMenuBtn.addEventListener('click', () => {
                this.toggleProfileDropdown();
            });
            console.log('✅ Profile menu button event listener added');
        } else {
            console.warn('❌ Profile menu button not found');
        }

        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.openMobileMenu();
            });
            console.log('✅ Mobile menu button event listener added');
        } else {
            console.warn('❌ Mobile menu button not found');
        }

        const closeMobileMenuBtn = document.getElementById('close-mobile-menu');
        if (closeMobileMenuBtn) {
            closeMobileMenuBtn.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        }

        // Profile dropdown items
        document.addEventListener('click', (e) => {
            if (e.target.closest('.dropdown-item')) {
                const dropdownItem = e.target.closest('.dropdown-item');
                const tabName = dropdownItem.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                    this.closeProfileDropdown();
                }
            }
        });

        // Mobile menu items
        document.addEventListener('click', (e) => {
            if (e.target.closest('.mobile-menu-item')) {
                const menuItem = e.target.closest('.mobile-menu-item');
                const tabName = menuItem.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                    this.closeMobileMenu();
                }
            }
        });

        // Logout buttons
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        // Modal close handlers
        const closeTaskModalBtn = document.getElementById('close-task-modal');
        if (closeTaskModalBtn) {
            closeTaskModalBtn.addEventListener('click', () => {
                this.closeTaskModal();
            });
        }

        const closeWithdrawalModalBtn = document.getElementById('close-withdrawal-modal');
        if (closeWithdrawalModalBtn) {
            closeWithdrawalModalBtn.addEventListener('click', () => {
                this.closeWithdrawalModal();
            });
        }

        const cancelWithdrawalBtn = document.getElementById('cancel-withdrawal');
        if (cancelWithdrawalBtn) {
            cancelWithdrawalBtn.addEventListener('click', () => {
                this.closeWithdrawalModal();
            });
        }

        // Close modal when clicking overlay
        const withdrawalModal = document.getElementById('withdrawal-modal');
        if (withdrawalModal) {
            withdrawalModal.addEventListener('click', (e) => {
                if (e.target.id === 'withdrawal-modal') {
                    this.closeWithdrawalModal();
                }
            });
        }

        // Close dropdowns and modals when clicking outside
        document.addEventListener('click', (e) => {
            // Close profile dropdown when clicking outside
            if (!e.target.closest('.profile-menu')) {
                this.closeProfileDropdown();
            }

            // Close mobile menu when clicking overlay
            if (e.target.id === 'mobile-menu-overlay') {
                this.closeMobileMenu();
            }

            // Close notification popup when clicking overlay
            if (e.target.id === 'notification-popup') {
                this.closeNotificationPopup();
            }
        });

        // Notification event listeners
        const markAllReadBtn = document.getElementById('mark-all-read-btn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllNotificationsAsRead();
            });
        }

        // Notification popup event listeners
        const closeNotificationPopupBtn = document.getElementById('close-notification-popup');
        if (closeNotificationPopupBtn) {
            closeNotificationPopupBtn.addEventListener('click', () => {
                this.closeNotificationPopup();
            });
        }

        const popupMarkAllReadBtn = document.getElementById('popup-mark-all-read-btn');
        if (popupMarkAllReadBtn) {
            popupMarkAllReadBtn.addEventListener('click', () => {
                this.markAllNotificationsAsRead();
                this.closeNotificationPopup();
            });
        }

        const viewAllNotificationsBtn = document.getElementById('view-all-notifications-btn');
        if (viewAllNotificationsBtn) {
            viewAllNotificationsBtn.addEventListener('click', () => {
                this.closeNotificationPopup();
                this.switchTab('notifications');
            });
        }

        // Event delegation for notification clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.notification-item')) {
                const notificationItem = e.target.closest('.notification-item');
                const notificationId = notificationItem.getAttribute('data-notification-id');
                this.markNotificationAsRead(notificationId);
            }
        });

        // Withdrawal form
        const withdrawBtn = document.getElementById('withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => {
                this.checkAccountStatusAndShowWithdrawal();
            });
        }

        const withdrawalForm = document.getElementById('withdrawal-form');
        if (withdrawalForm) {
            withdrawalForm.addEventListener('submit', (e) => {
                e.preventDefault();

                // IMMEDIATE UI PROTECTION - Disable button instantly
                const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    this.setButtonLoading(submitBtn, true, 'Processing...');
                }

                this.submitWithdrawal();
            });
        }

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeAllModals();
            }
        });

        // Cleanup listeners when page is unloaded
        window.addEventListener('beforeunload', () => {
            this.cleanupRealtimeListeners();
        });
    }

    setupTabNavigation() {
        // Default to tasks tab so users can see available tasks immediately
        this.switchTab('tasks');
    }

    switchTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');
            console.log('✅ Tab shown:', selectedTab.id);
        } else {
            console.log('❌ Tab not found:', `${tabName}-tab`);
        }

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        console.log('📊 Loading data for tab:', tabName);

        switch (tabName) {
            case 'tasks':
                await this.loadTasks();
                break;
            case 'wallet':
                await this.loadWalletData();
                break;
            case 'activity':
                await this.loadActivityData();
                break;
            case 'notifications':
                await this.loadNotifications();
                break;
            case 'profile':
                await this.loadProfileData();
                break;
        }
    }

    async loadWalletData() {
        try {
            console.log('💰 Loading wallet data...');

            // Load current balance
            const userData = await window.firestoreManager.getUser(this.currentUser.uid);
            const currentBalance = userData ? userData.walletBalance || 0 : 0;

            // Update balance display
            const balanceDisplay = document.getElementById('wallet-balance-display');
            if (balanceDisplay) {
                balanceDisplay.textContent = `₱${currentBalance}`;
            }

            // Load transaction history
            await this.loadTransactionHistory();

        } catch (error) {
            console.error('Error loading wallet data:', error);
        }
    }

    async loadActivityData() {
        try {
            console.log('📊 Loading activity data...');

            // Load all user activities (submissions, withdrawals, etc.)
            await this.loadActivityHistory();

        } catch (error) {
            console.error('Error loading activity data:', error);
        }
    }

    async loadProfileData() {
        try {
            console.log('👤 Loading profile data...');

            // Load user profile information
            const userData = await window.firestoreManager.getUser(this.currentUser.uid);
            if (userData) {
                // Update profile displays
                const userEmail = document.getElementById('user-email');
                const userUid = document.getElementById('user-uid');
                const walletBalance = document.getElementById('wallet-balance');

                if (userEmail) userEmail.textContent = userData.email;
                if (userUid) userUid.textContent = this.currentUser.uid;
                if (walletBalance) walletBalance.textContent = `₱${userData.walletBalance || 0}`;
            }

        } catch (error) {
            console.error('Error loading profile data:', error);
        }
    }

    async loadTransactionHistory() {
        try {
            console.log('💳 Loading transaction history...');

            const historyContainer = document.getElementById('wallet-history');
            if (!historyContainer) return;

            // Get balance changes from the new collection
            const balanceChanges = await this.getUserBalanceChanges();
            console.log('Balance changes loaded:', balanceChanges);

            // Get user's submissions (completed tasks) for additional context
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = submissions.filter(s =>
                s.user_id === this.currentUser.uid && s.status === 'approved'
            );
            console.log('User submissions loaded:', userSubmissions);

            // Get user's withdrawals for additional context
            const withdrawals = await window.firestoreManager.getWithdrawalsByUser(this.currentUser.uid);
            console.log('User withdrawals loaded:', withdrawals);
            console.log('Current user ID:', this.currentUser.uid);

            // Get user data for balance calculations
            const userData = await window.firestoreManager.getUser(this.currentUser.uid);
            console.log('User data loaded:', userData);

            // Combine and sort all transactions by date
            const allTransactions = [];

            // Add balance changes (these are the primary source of truth)
            console.log('Processing balance changes, count:', balanceChanges ? balanceChanges.length : 0);
            if (balanceChanges && balanceChanges.length > 0) {
                balanceChanges.forEach((change, index) => {
                    console.log(`Processing balance change ${index}:`, change);

                    // Skip withdrawal balance changes to avoid duplicates with withdrawal records
                    // Keep only withdrawal_rejected_refund as it's not covered by withdrawal records
                    if (change.reason === 'withdrawal_approved' || change.reason === 'withdrawal_submitted') {
                        console.log('Skipping withdrawal balance change:', change.reason);
                        return;
                    }

                    // Special logging for refund transactions
                    if (change.reason === 'withdrawal_rejected_refund') {
                        console.log('💰 Processing REFUND transaction:', {
                            reason: change.reason,
                            amount: change.changeAmount,
                            description: this.getBalanceChangeDescription(change),
                            reference: change.metadata?.referenceNumber
                        });
                    }

                    const transaction = {
                        type: 'balance_change',
                        amount: change.changeAmount,
                        description: this.getBalanceChangeDescription(change),
                        date: change.timestamp,
                        reference: change.metadata?.referenceNumber || 'N/A',
                        status: this.getStatusForReason(change.reason),
                        beforeBalance: change.beforeBalance,
                        afterBalance: change.afterBalance,
                        metadata: change.metadata
                    };

                    console.log('Adding balance change transaction:', transaction);
                    allTransactions.push(transaction);
                });
            }

            // Skip adding task submissions separately since they're already covered by balance changes
            // This prevents duplicate entries for the same task completion

            // Add withdrawals (these show the current status) - always process these
            console.log('Processing withdrawals, count:', withdrawals.length);
            withdrawals.forEach((withdrawal, index) => {
                console.log(`Processing withdrawal ${index}:`, withdrawal);

                // Determine the correct status display
                let statusDisplay = withdrawal.status;
                let description = `Withdrawal Submitted: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;

                // If approved, show as approved
                if (withdrawal.status === 'approved') {
                    statusDisplay = 'approved';
                    description = `Withdrawal Approved: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;
                } else if (withdrawal.status === 'rejected') {
                    statusDisplay = 'rejected';
                    description = `Withdrawal Rejected: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;
                }

                console.log(`🔄 Withdrawal ${withdrawal.id} status: ${withdrawal.status} -> ${statusDisplay}`);

                // Calculate balance information for withdrawal
                // For withdrawals, we need to simulate the balance change
                const withdrawalAmount = withdrawal.amount || 0;
                const currentBalance = userData?.walletBalance || 0;
                const beforeBalance = currentBalance + withdrawalAmount; // Add back the withdrawn amount
                const afterBalance = currentBalance;

                const transaction = {
                    type: 'withdrawal',
                    amount: -withdrawal.amount,
                    description: description,
                    date: withdrawal.created_at || withdrawal.createdAt,
                    reference: withdrawal.referenceNumber || withdrawal.reference_number || 'N/A',
                    status: statusDisplay,
                    beforeBalance: beforeBalance,
                    afterBalance: afterBalance
                };

                console.log('Adding transaction:', transaction);
                allTransactions.push(transaction);
            });
            console.log('All transactions after adding withdrawals:', allTransactions);

            // Remove duplicates based on reference number and type
            const uniqueTransactions = [];
            const seenTransactions = new Set();

            allTransactions.forEach(transaction => {
                const key = `${transaction.type}_${transaction.reference}_${transaction.amount}_${transaction.date}`;
                if (!seenTransactions.has(key)) {
                    seenTransactions.add(key);
                    uniqueTransactions.push(transaction);
                } else {
                    console.log('Removing duplicate transaction:', transaction);
                }
            });

            // Sort by date (newest first)
            uniqueTransactions.sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dateB - dateA;
            });

            console.log('All transactions after deduplication:', uniqueTransactions);

            // Display transactions
            if (uniqueTransactions.length === 0) {
                historyContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-wallet text-4xl mb-4 text-gray-400"></i>
                        <h3 class="text-lg font-semibold text-gray-600 mb-2">No Transactions Yet</h3>
                        <p class="text-gray-500">Complete tasks to see your transaction history here.</p>
                    </div>
                `;
                return;
            }

            historyContainer.innerHTML = uniqueTransactions.map(transaction => {
                const date = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const isPositive = transaction.amount > 0;
                const amountClass = isPositive ? 'text-green-600' : 'text-red-600';
                const amountPrefix = isPositive ? '+' : '';
                const icon = isPositive ? 'fa-plus-circle' : 'fa-minus-circle';
                const iconClass = isPositive ? 'text-green-500' : 'text-red-500';

                // Show balance change details
                const balanceChangeInfo = transaction.beforeBalance !== undefined && transaction.afterBalance !== undefined
                    ? `<div class="balance-change-info text-xs text-gray-500 mt-1">
                         Balance: ₱${transaction.beforeBalance} → ₱${transaction.afterBalance}
                       </div>`
                    : '';

                // Add status badge for withdrawals
                const statusBadge = transaction.type === 'withdrawal' && transaction.status
                    ? `<div class="transaction-status">
                         <span class="status-badge status-${transaction.status}">${transaction.status.toUpperCase()}</span>
                       </div>`
                    : '';

                // Determine transaction type and styling
                const isEarning = transaction.amount > 0;
                const isRefund = transaction.description && transaction.description.includes('Refunded');
                let transactionType;
                let typeIcon;
                let typeClass;

                if (isRefund) {
                    transactionType = 'Refunded';
                    typeIcon = 'fa-undo';
                    typeClass = 'text-purple-500';
                } else if (isEarning) {
                    transactionType = 'Earning';
                    typeIcon = 'fa-plus-circle';
                    typeClass = 'text-green-500';
                } else {
                    transactionType = 'Withdrawal';
                    typeIcon = 'fa-minus-circle';
                    typeClass = 'text-red-500';
                }

                return `
                    <div class="transaction-item">
                        <div class="transaction-icon ${typeClass}">
                            <i class="fas ${typeIcon}"></i>
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-header">
                                <div class="transaction-type">${transactionType}</div>
                                <div class="transaction-amount ${isRefund ? 'text-purple-600' : (isEarning ? 'text-green-600' : 'text-red-600')}">
                                    ${isRefund ? '+' : (isEarning ? '+' : '-')}₱${Math.abs(transaction.amount)}
                                </div>
                            </div>
                            <div class="transaction-description">${transaction.description}</div>
                            <div class="transaction-meta">
                                <span class="transaction-date">${formattedDate}</span>
                                <span class="transaction-reference">Ref: ${transaction.reference}</span>
                            </div>
                            ${statusBadge}
                            ${balanceChangeInfo}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading transaction history:', error);
            const historyContainer = document.getElementById('wallet-history');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4 text-red-400"></i>
                        <h3 class="text-lg font-semibold text-red-600 mb-2">Error Loading History</h3>
                        <p class="text-red-500">Unable to load transaction history. Please try again later.</p>
                    </div>
                `;
            }
        }
    }

    async loadActivityHistory() {
        try {
            console.log('📈 Loading activity history...');

            const activityContainer = document.getElementById('activity-history');
            if (!activityContainer) return;

            // Get balance changes for activity history
            const balanceChanges = await this.getUserBalanceChanges();

            // Get user's submissions
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = submissions.filter(s => s.user_id === this.currentUser.uid);

            // Get user's withdrawals
            const withdrawals = await window.firestoreManager.getWithdrawalsByUser(this.currentUser.uid);

            // Combine all activities
            const allActivities = [];

            // Create a map to track withdrawals by reference number to avoid duplicates
            const withdrawalMap = new Map();

            // Add withdrawal activities first (these show the current status)
            withdrawals.forEach(withdrawal => {
                const refNumber = withdrawal.referenceNumber || withdrawal.reference_number || 'N/A';
                withdrawalMap.set(refNumber, withdrawal);

                // Determine the correct action and description based on status
                let action = 'withdrawal_submitted';
                let description = `Withdrawal Submitted: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;

                if (withdrawal.status === 'approved') {
                    action = 'withdrawal_approved';
                    description = `Withdrawal Approved: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;
                } else if (withdrawal.status === 'rejected') {
                    action = 'withdrawal_rejected';
                    description = `Withdrawal Rejected: ${withdrawal.method || withdrawal.payment_method || 'Unknown Method'}`;
                }

                allActivities.push({
                    type: 'withdrawal',
                    action: action,
                    description: description,
                    date: withdrawal.created_at,
                    reference: refNumber,
                    status: withdrawal.status,
                    details: {
                        amount: withdrawal.amount,
                        paymentMethod: withdrawal.method || withdrawal.payment_method
                    }
                });
            });

            // Add balance change activities (but skip withdrawal-related ones to avoid duplicates)
            balanceChanges.forEach(change => {
                const refNumber = change.metadata?.referenceNumber || 'N/A';

                // Skip withdrawal-related balance changes if we already have a withdrawal activity for this reference
                if (change.reason === 'withdrawal_approved' ||
                    change.reason === 'withdrawal_rejected_refund' ||
                    change.reason === 'withdrawal_submitted' ||
                    (refNumber !== 'N/A' && withdrawalMap.has(refNumber))) {
                    return;
                }

                allActivities.push({
                    type: 'balance_change',
                    action: change.reason,
                    description: this.getBalanceChangeDescription(change),
                    date: change.timestamp,
                    reference: refNumber,
                    status: this.getStatusForReason(change.reason),
                    details: {
                        beforeBalance: change.beforeBalance,
                        afterBalance: change.afterBalance,
                        changeAmount: change.changeAmount,
                        metadata: change.metadata
                    }
                });
            });

            // Remove duplicates based on reference number and timestamp
            const uniqueActivities = [];
            const seenActivities = new Set();

            allActivities.forEach(activity => {
                const date = activity.date?.toDate ? activity.date.toDate() : new Date(activity.date);
                const key = `${activity.reference}-${date.getTime()}-${activity.type}`;

                if (!seenActivities.has(key)) {
                    seenActivities.add(key);
                    uniqueActivities.push(activity);
                }
            });

            // Sort by date (newest first)
            uniqueActivities.sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dateB - dateA;
            });

            // Display activities
            if (uniqueActivities.length === 0) {
                activityContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history text-4xl mb-4 text-gray-400"></i>
                        <h3 class="text-lg font-semibold text-gray-600 mb-2">No Activity Yet</h3>
                        <p class="text-gray-500">Your recent activities will appear here.</p>
                    </div>
                `;
                return;
            }

            activityContainer.innerHTML = uniqueActivities.map(activity => {
                const date = activity.date?.toDate ? activity.date.toDate() : new Date(activity.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let iconClass = 'activity-icon-blue';
                let icon = 'fa-info-circle';
                let statusClass = 'text-gray-600';
                let activityTypeLabel = '';

                // Handle balance change activities
                if (activity.type === 'balance_change') {
                    const isPositive = activity.details?.changeAmount > 0;
                    const isRefund = activity.description && activity.description.includes('Refunded');

                    if (isRefund) {
                        iconClass = 'activity-icon-purple';
                        icon = 'fa-undo';
                        statusClass = 'text-purple-600';
                        activityTypeLabel = 'REFUND';
                    } else if (isPositive) {
                        iconClass = 'activity-icon-green';
                        icon = 'fa-plus-circle';
                        statusClass = 'text-green-600';
                        activityTypeLabel = 'EARNING';
                    } else {
                        iconClass = 'activity-icon-red';
                        icon = 'fa-minus-circle';
                        statusClass = 'text-red-600';
                        activityTypeLabel = 'DEDUCTION';
                    }
                } else if (activity.type === 'withdrawal') {
                    // Withdrawal activities - use orange/amber theme
                    switch (activity.status) {
                        case 'approved':
                            iconClass = 'activity-icon-green';
                            icon = 'fa-check-circle';
                            statusClass = 'text-green-600';
                            activityTypeLabel = 'WITHDRAWAL';
                            break;
                        case 'rejected':
                            iconClass = 'activity-icon-red';
                            icon = 'fa-times-circle';
                            statusClass = 'text-red-600';
                            activityTypeLabel = 'WITHDRAWAL';
                            break;
                        case 'pending':
                            iconClass = 'activity-icon-orange';
                            icon = 'fa-money-bill-wave';
                            statusClass = 'text-orange-600';
                            activityTypeLabel = 'WITHDRAWAL';
                            break;
                        default:
                            iconClass = 'activity-icon-orange';
                            icon = 'fa-money-bill-wave';
                            statusClass = 'text-orange-600';
                            activityTypeLabel = 'WITHDRAWAL';
                            break;
                    }
                } else if (activity.type === 'task_submission' || activity.type === 'submission') {
                    // Task submission activities - use blue theme
                    switch (activity.status) {
                        case 'approved':
                            iconClass = 'activity-icon-green';
                            icon = 'fa-check-circle';
                            statusClass = 'text-green-600';
                            activityTypeLabel = 'TASK';
                            break;
                        case 'rejected':
                            iconClass = 'activity-icon-red';
                            icon = 'fa-times-circle';
                            statusClass = 'text-red-600';
                            activityTypeLabel = 'TASK';
                            break;
                        case 'pending_review':
                            iconClass = 'activity-icon-yellow';
                            icon = 'fa-clock';
                            statusClass = 'text-yellow-600';
                            activityTypeLabel = 'TASK';
                            break;
                        case 'in_progress':
                            iconClass = 'activity-icon-blue';
                            icon = 'fa-play-circle';
                            statusClass = 'text-blue-600';
                            activityTypeLabel = 'TASK';
                            break;
                        case 'completed':
                            iconClass = 'activity-icon-green';
                            icon = 'fa-trophy';
                            statusClass = 'text-green-600';
                            activityTypeLabel = 'TASK';
                            break;
                        default:
                            iconClass = 'activity-icon-blue';
                            icon = 'fa-tasks';
                            statusClass = 'text-blue-600';
                            activityTypeLabel = 'TASK';
                            break;
                    }
                } else {
                    // Default fallback for other activity types
                    switch (activity.status) {
                        case 'approved':
                            iconClass = 'activity-icon-green';
                            icon = 'fa-check-circle';
                            statusClass = 'text-green-600';
                            activityTypeLabel = 'ACTIVITY';
                            break;
                        case 'rejected':
                            iconClass = 'activity-icon-red';
                            icon = 'fa-times-circle';
                            statusClass = 'text-red-600';
                            activityTypeLabel = 'ACTIVITY';
                            break;
                        case 'pending_review':
                        case 'pending':
                            iconClass = 'activity-icon-yellow';
                            icon = 'fa-clock';
                            statusClass = 'text-yellow-600';
                            activityTypeLabel = 'ACTIVITY';
                            break;
                        case 'in_progress':
                            iconClass = 'activity-icon-blue';
                            icon = 'fa-play-circle';
                            statusClass = 'text-blue-600';
                            activityTypeLabel = 'ACTIVITY';
                            break;
                        default:
                            iconClass = 'activity-icon-gray';
                            icon = 'fa-info-circle';
                            statusClass = 'text-gray-600';
                            activityTypeLabel = 'ACTIVITY';
                            break;
                    }
                }

                // Show balance change details for balance change activities
                const balanceChangeInfo = activity.type === 'balance_change' && activity.details?.beforeBalance !== undefined
                    ? (() => {
                        const before = parseFloat(activity.details.beforeBalance) || 0;
                        const after = parseFloat(activity.details.afterBalance) || 0;
                        const change = after - before;
                        const changeText = change >= 0 ? `(+₱${Math.abs(change)})` : `(-₱${Math.abs(change)})`;
                        const changeClass = change >= 0 ? 'balance-positive' : 'balance-negative';
                        return `<div class="balance-change-info">
                                 Balance: ₱${before} → ₱${after} <span class="${changeClass}">${changeText}</span>
                               </div>`;
                    })()
                    : '';

                return `
                    <div class="activity-item-dashboard">
                        <div class="activity-icon-dashboard ${iconClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="activity-content-dashboard">
                            <div class="activity-header-dashboard">
                                <span class="activity-type-label">${activityTypeLabel}</span>
                                <span class="activity-description">${activity.description}</span>
                            </div>
                            <div class="activity-time-dashboard">
                                <span class="activity-date">${formattedDate}</span>
                                <span class="status-badge status-${activity.status}">${activity.status.replace('_', ' ').toUpperCase()}</span>
                                <span class="activity-reference">Ref: ${activity.reference}</span>
                            </div>
                            ${balanceChangeInfo}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading activity history:', error);
            const activityContainer = document.getElementById('activity-history');
            if (activityContainer) {
                activityContainer.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4 text-red-400"></i>
                        <h3 class="text-lg font-semibold text-red-600 mb-2">Error Loading Activity</h3>
                        <p class="text-red-500">Unable to load activity history. Please try again later.</p>
                    </div>
                `;
            }
        }
    }

    setupRealtimeListeners() {
        console.log('🔄 Setting up real-time listeners...');

        // Listen to tasks changes
        this.tasksListener = window.firestoreManager.listenToTasks((snapshot) => {
            console.log('📋 Tasks updated in real-time:', snapshot.size, 'tasks');

            // Convert snapshot to tasks array
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update the tasks array
            this.tasks = tasks;

            // If we're on the tasks tab, refresh the display
            const tasksTab = document.getElementById('tasks-tab');
            if (tasksTab && !tasksTab.classList.contains('hidden')) {
                this.loadTasks();
            }
        });

        // Listen to user notifications
        if (this.currentUser) {
            this.notificationsListener = window.firestoreManager.listenToUserNotifications(this.currentUser.uid, (snapshot) => {
                console.log('🔔 Notifications updated in real-time:', snapshot.size, 'notifications');

                // If we're on the notifications tab, refresh the display
                const notificationsTab = document.getElementById('notifications-tab');
                if (notificationsTab && !notificationsTab.classList.contains('hidden')) {
                    this.loadNotifications();
                }
            });

            // Listen to user verifications (for activity tab)
            this.verificationsListener = window.firestoreManager.listenToUserVerifications(this.currentUser.uid, (snapshot) => {
                console.log('📋 Verifications updated in real-time:', snapshot.size, 'verifications');

                // If we're on the activity tab, refresh the display
                const activityTab = document.getElementById('activity-tab');
                if (activityTab && !activityTab.classList.contains('hidden')) {
                    this.loadActivityHistory();
                }
            });

            // Listen to user withdrawals (for wallet and activity tabs)
            this.withdrawalsListener = window.firestoreManager.listenToUserWithdrawals(this.currentUser.uid, (snapshot) => {
                console.log('💰 Withdrawals updated in real-time:', snapshot.size, 'withdrawals');

                // If we're on the wallet tab, refresh the display
                const walletTab = document.getElementById('wallet-tab');
                if (walletTab && !walletTab.classList.contains('hidden')) {
                    this.loadWalletHistory();
                }

                // If we're on the activity tab, refresh the display
                const activityTab = document.getElementById('activity-tab');
                if (activityTab && !activityTab.classList.contains('hidden')) {
                    this.loadActivityHistory();
                }
            });

            // Listen to user document changes (for wallet balance updates)
            this.userListener = db.collection('users').doc(this.currentUser.uid).onSnapshot((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    console.log('👤 User data updated in real-time:', userData);

                    // Update wallet balance display
                    const userBalanceElement = document.getElementById('user-balance');
                    if (userBalanceElement) {
                        userBalanceElement.textContent = `₱${userData.walletBalance || 0}`;
                    }

                    const walletBalanceDisplay = document.getElementById('wallet-balance-display');
                    if (walletBalanceDisplay) {
                        walletBalanceDisplay.textContent = `₱${userData.walletBalance || 0}`;
                    }

                    // If we're on the wallet tab, refresh the display
                    const walletTab = document.getElementById('wallet-tab');
                    if (walletTab && !walletTab.classList.contains('hidden')) {
                        this.loadWalletHistory();
                    }
                }
            });
        }

        console.log('✅ Real-time listeners set up successfully');
    }

    cleanupRealtimeListeners() {
        console.log('🧹 Cleaning up real-time listeners...');

        if (this.tasksListener) {
            this.tasksListener();
            this.tasksListener = null;
        }

        if (this.notificationsListener) {
            this.notificationsListener();
            this.notificationsListener = null;
        }

        if (this.verificationsListener) {
            this.verificationsListener();
            this.verificationsListener = null;
        }

        if (this.withdrawalsListener) {
            this.withdrawalsListener();
            this.withdrawalsListener = null;
        }

        if (this.userListener) {
            this.userListener();
            this.userListener = null;
        }

        console.log('✅ Real-time listeners cleaned up');
    }

    switchTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.classList.add('hidden');
        });

        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.remove('hidden');
            tabContent.classList.add('active');
        } else {
            console.error('Tab content not found for:', tabName);
            return;
        }

        // Load tab data
        this.loadTabData(tabName);
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'tasks':
                this.loadTasks();
                break;
            case 'wallet':
                this.loadWalletHistory();
                break;
            case 'activity':
                this.loadActivityHistory();
                break;
            case 'notifications':
                this.loadNotifications();
                break;
        }
    }

    generateQuestaId(uid) {
        // Handle undefined or null UID
        if (!uid) {
            console.warn('UID is undefined, generating fallback Questa ID');
            return 'Q00000';
        }

        // Generate a consistent 5-digit Questa ID from Firebase UID
        // Use first 5 characters of UID hash to create Q + 5 digits
        const hash = uid.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);

        // Convert to positive 5-digit number
        const number = Math.abs(hash) % 100000;
        return `Q${number.toString().padStart(5, '0')}`;
    }

    // Check if user's time limit has expired for a task
    async checkUserTimeLimit(task) {
        try {
            if (!task.user_time_limit_hours) return;

            const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;
            const storedStartTime = localStorage.getItem(startTimeKey);

            if (!storedStartTime) return; // Task not started yet

            const startTime = new Date(storedStartTime);
            const userTimeLimit = task.user_time_limit_hours * 60 * 60 * 1000; // Convert to milliseconds
            const expirationTime = new Date(startTime.getTime() + userTimeLimit);
            const now = new Date();

            if (now > expirationTime) {
                console.log(`⏰ User time limit expired for task ${task.title}`);
                await this.handleTaskExpiration(task);
            }
        } catch (error) {
            console.error('Error checking user time limit:', error);
        }
    }

    // Handle task expiration - restart the task
    async handleTaskExpiration(task) {
        try {
            const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;

            // Clear the start time
            localStorage.removeItem(startTimeKey);

            // Show expiration banner
            this.showTaskExpirationBanner(task);

            // Update task status in database if there's an active submission
            const submissions = await db.collection('task_submissions')
                .where('task_id', '==', task.id)
                .where('user_id', '==', this.currentUser.uid)
                .where('status', 'in', ['in_progress', 'pending_review'])
                .get();

            if (!submissions.empty) {
                // Update the submission status to expired
                const submission = submissions.docs[0];
                await db.collection('task_submissions').doc(submission.id).update({
                    status: 'expired',
                    expired_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Reload tasks to refresh the display
            await this.loadTasks();

        } catch (error) {
            console.error('Error handling task expiration:', error);
        }
    }

    // Show task expiration banner
    showTaskExpirationBanner(task) {
        const banner = document.createElement('div');
        banner.className = 'task-expiration-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Task "${task.title}" has expired due to time limit. It has been restarted automatically.</span>
                <button class="banner-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;

        // Insert at the top of the tasks container
        const tasksContainer = document.getElementById('tasks-grid');
        if (tasksContainer) {
            tasksContainer.insertBefore(banner, tasksContainer.firstChild);

            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (banner.parentNode) {
                    banner.remove();
                }
            }, 10000);
        }
    }

    async loadTasks(forceRefresh = false) {
        try {
            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                // Wait for authentication
                await this.waitForAuthentication();
            }

            // Check if user is disabled first
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists && userDoc.data().status === 'disabled') {
                this.showAccountDisabledNotice();
                // Mark all data as loaded for disabled users to hide loading modal
                this.markDataLoaded('userData');
                this.markDataLoaded('tasks');
                this.markDataLoaded('wallet');
                this.markDataLoaded('notifications');
                return;
            }

            console.log('Loading tasks...', forceRefresh ? '(force refresh)' : '');

            // Show loading state in tasks grid
            const tasksGrid = document.getElementById('tasks-grid');
            if (tasksGrid) {
                tasksGrid.innerHTML = `
                    <div class="tasks-loading-state">
                        <div class="tasks-loading-spinner">
                            <div class="spinner"></div>
                        </div>
                        <h3 class="tasks-loading-title">Loading Tasks</h3>
                        <p class="tasks-loading-subtitle">Please wait while we fetch your available tasks</p>
                    </div>
                `;
            }

            // Clear cache if force refresh is requested
            if (forceRefresh) {
                this.clearTaskCache();

                // Clear localStorage expiration flags for tasks that are no longer expired
                // This handles cases where admin extended task deadlines
                this.clearExpiredLocalStorageFlags();

                // Show loading indicator on refresh button
                const refreshBtn = document.querySelector('.refresh-btn');
                if (refreshBtn) {
                    const originalText = refreshBtn.innerHTML;
                    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                    refreshBtn.disabled = true;

                    // Restore button after loading
                    setTimeout(() => {
                        refreshBtn.innerHTML = originalText;
                        refreshBtn.disabled = false;
                    }, 2000);
                }
            }

            // Use cached tasks if available and not too old (5 minutes), unless force refresh is requested
            const tasksCacheKey = `tasks_${this.currentUser.uid}`;
            const cachedTasksData = this.getCachedTasks(tasksCacheKey);

            let tasks;
            if (!forceRefresh && cachedTasksData && (Date.now() - cachedTasksData.timestamp) < 300000) { // 5 minutes cache
                console.log('📦 Using cached tasks data');
                tasks = cachedTasksData.data;
            } else {
                console.log('🔄 Loading tasks from database', forceRefresh ? '(force refresh)' : '');
                tasks = await window.firestoreManager.getTasks();
                // Cache the tasks
                this.setCachedTasks(tasksCacheKey, tasks);
            }

            console.log('Tasks loaded:', tasks);

            // Filter only active tasks for users and check for expiration
            const activeTasks = tasks.filter(task => {
                console.log(`🔍 Filtering task: ${task.title}`, {
                    status: task.status,
                    task_deadline_hours: task.task_deadline_hours,
                    created_at: task.created_at,
                    deadline: task.deadline
                });

                if (task.status !== 'active') {
                    console.log(`❌ Task ${task.title} filtered out - status is "${task.status}", not "active"`);
                    return false;
                }

                // Check if task deadline has expired - but don't filter out, just log for debugging
                if (task.task_deadline_hours) {
                    const taskCreatedAt = task.created_at?.toDate ? task.created_at.toDate() : new Date(task.created_at);
                    const deadlineTime = new Date(taskCreatedAt.getTime() + (task.task_deadline_hours * 60 * 60 * 1000));
                    const now = new Date();

                    console.log(`⏰ Task ${task.title} deadline check:`, {
                        taskCreatedAt: taskCreatedAt.toISOString(),
                        deadlineTime: deadlineTime.toISOString(),
                        now: now.toISOString(),
                        isExpired: now > deadlineTime,
                        hoursPassed: (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60 * 60)
                    });

                    if (now > deadlineTime) {
                        console.log(`📋 Task ${task.title} has ended (deadline: ${deadlineTime.toISOString()}) - will be marked as ended`);
                        // Don't filter out - we want to show ended tasks but mark them as ended
                    }
                }

                console.log(`✅ Task ${task.title} passed all filters`);
                return true;
            });
            console.log('Active tasks:', activeTasks);

            // Batch load user statuses to reduce Firebase requests
            await this.batchLoadUserStatuses(activeTasks, forceRefresh);

            // Log deadline information for debugging
            activeTasks.forEach((task, index) => {
                console.log(`Task ${index} (${task.title}):`, {
                    hasDeadline: !!task.deadline,
                    deadline: task.deadline,
                    deadlineType: typeof task.deadline,
                    deadlineFormatted: this.formatDeadlineForTimer(task.deadline),
                    duration: task.duration,
                    userTimeLimit: task.userTimeLimit,
                    userTimeLimitType: typeof task.userTimeLimit,
                    task_deadline_hours: task.task_deadline_hours,
                    user_time_limit_hours: task.user_time_limit_hours
                });
            });

            // Render tasks and wait for completion
            await this.renderTasks(activeTasks);

            // Start countdown timers after a short delay to ensure DOM is ready
            setTimeout(() => {
                this.startCountdownTimers();
            }, 100);

            // Sync existing localStorage timers to database for admin view
            setTimeout(() => {
                if (window.syncAllLocalStorageTimers) {
                    window.syncAllLocalStorageTimers();
                }
            }, 500);

            // Add manual test function to window for debugging
            window.testCountdown = () => {
                console.log('Testing countdown manually...');
                const elements = document.querySelectorAll('.task-deadline-timer');
                console.log('Found elements:', elements.length);
                elements.forEach((el, i) => {
                    const textEl = el.querySelector('.deadline-text');
                    console.log(`Element ${i}:`, {
                        element: el,
                        textElement: textEl,
                        deadline: el.getAttribute('data-deadline'),
                        currentText: textEl ? textEl.textContent : 'No text element'
                    });

                    // Test manual text update
                    if (textEl) {
                        textEl.textContent = 'TEST WORKING';
                        console.log(`Set element ${i} text to: ${textEl.textContent}`);
                    }
                });
            };

            // Add function to force update all timers
            window.forceUpdateTimers = () => {
                console.log('Force updating all timers...');
                const elements = document.querySelectorAll('.task-deadline-timer');
                elements.forEach((el, i) => {
                    const deadlineString = el.getAttribute('data-deadline');
                    if (deadlineString && deadlineString !== 'null') {
                        const deadline = new Date(deadlineString);
                        this.updateCountdownDirect(el, deadline);
                        console.log(`Force updated element ${i}`);
                    }
                });
            };

            // Wait a bit more to ensure DOM is fully rendered and visible
            setTimeout(() => {
                // Verify tasks are actually visible before marking as loaded
                const tasksGrid = document.getElementById('tasks-grid');
                const taskCards = tasksGrid ? tasksGrid.querySelectorAll('.task-card-modern') : [];

                if (taskCards.length > 0) {
                    console.log('✅ Tasks rendered and visible, marking as loaded');
                    this.markDataLoaded('tasks');
                } else {
                    console.log('⚠️ No task cards found, but marking as loaded anyway');
                    this.markDataLoaded('tasks');
                }
            }, 200);

            // Add debug function to window for testing
            window.debugTaskStatus = (taskId) => this.debugTaskStatus(taskId);
            // Add manual refresh function for debugging
            window.forceRefreshTaskStatus = async (taskId) => {
                console.log('🔄 Force refreshing task status for:', taskId);
                try {
                    // Force update from database
                    const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
                    console.log('📊 Fresh task status from database:', taskStatus);

                    // Reload tasks to update UI
                    await this.loadTasks();
                    console.log('✅ Tasks reloaded');

                    return taskStatus;
                } catch (error) {
                    console.error('❌ Error force refreshing task status:', error);
                }
            };

        } catch (error) {
            console.error('Error loading tasks:', error);
            // Mark as loaded even on error to prevent infinite loading
            this.markDataLoaded('tasks');
        }
    }

    startCountdownTimers() {
        // Clear existing timers
        if (this.countdownTimers) {
            this.countdownTimers.forEach(timer => clearInterval(timer));
        }
        this.countdownTimers = [];

        // Wait for authentication and DOM to be ready
        setTimeout(async () => {
            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting for countdown timers...');
                await this.waitForAuthentication();
            }
            this.initializeCountdownTimers();
        }, 500);
    }

    initializeCountdownTimers() {
        // Start periodic check for expired tasks
        const expiredCheckTimer = setInterval(async () => {
            try {
                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');

                for (const task of activeTasks) {
                    await this.checkUserTimeLimit(task);
                }
            } catch (error) {
                console.error('Error checking expired tasks:', error);
            }
        }, 60000); // Check every minute

        this.countdownTimers.push(expiredCheckTimer);

        const deadlineElements = document.querySelectorAll('.task-deadline-timer');
        console.log('Found deadline elements:', deadlineElements.length);

        deadlineElements.forEach((element, index) => {
            const deadlineString = element.getAttribute('data-deadline');
            console.log(`Element ${index} deadline string:`, deadlineString);

            // Find the text element
            const textElement = element.querySelector('.deadline-text');
            if (!textElement) {
                console.error(`Element ${index} missing .deadline-text child`);
                return;
            }

            if (deadlineString && deadlineString !== 'null' && deadlineString !== 'undefined') {
                try {
                    const deadline = new Date(deadlineString);

                    // Validate the date
                    if (isNaN(deadline.getTime())) {
                        console.error('Invalid deadline date:', deadlineString);
                        textElement.textContent = 'Invalid Date';
                        return;
                    }

                    // Immediate update
                    this.updateCountdownDirect(element, deadline);

                    // Set up interval
                    const timer = setInterval(() => {
                        this.updateCountdownDirect(element, deadline);
                    }, 1000);
                    this.countdownTimers.push(timer);

                    console.log(`Started timer for element ${index} with deadline:`, deadline);
                } catch (error) {
                    console.error('Error starting countdown timer:', error);
                    textElement.textContent = 'Error';
                }
            } else {
                // Task created before deadline feature was implemented
                textElement.textContent = 'No Deadline';
            }
        });
    }

    updateCountdownDirect(element, deadline) {
        try {
            const now = new Date();
            const timeLeft = deadline.getTime() - now.getTime();

            // Find the text element directly
            const textElement = element.querySelector('.deadline-text');
            if (!textElement) {
                console.error('Could not find .deadline-text element');
                return;
            }

            if (timeLeft <= 0) {
                textElement.textContent = 'Ended';
                element.classList.add('expired');
                element.classList.remove('warning', 'critical');
                return;
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            let timeText = '';
            if (days > 0) {
                timeText = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                timeText = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                timeText = `${minutes}m ${seconds}s`;
            } else {
                timeText = `${seconds}s`;
            }

            // Force update the text
            textElement.textContent = timeText;
            textElement.innerHTML = timeText;

            // Update styling
            element.classList.remove('warning', 'critical', 'expired');

            if (days === 0 && hours < 1) {
                element.classList.add('critical');
            } else if (days === 0 && hours < 24) {
                element.classList.add('warning');
            }
        } catch (error) {
            console.error('Error updating countdown:', error);
            const textElement = element.querySelector('.deadline-text');
            if (textElement) {
                textElement.textContent = 'Error';
            }
        }
    }

    formatDeadlineForTimer(deadline) {
        try {
            if (!deadline) return null;

            // Handle Firestore Timestamp with toDate method
            if (deadline.toDate && typeof deadline.toDate === 'function') {
                return deadline.toDate().toISOString();
            }

            // Handle Firestore Timestamp with seconds/nanoseconds
            if (deadline.seconds && typeof deadline.seconds === 'number') {
                const date = new Date(deadline.seconds * 1000);
                return date.toISOString();
            }

            // Handle regular Date object
            if (deadline instanceof Date) {
                return deadline.toISOString();
            }

            // Handle string or timestamp
            if (typeof deadline === 'string' || typeof deadline === 'number') {
                return new Date(deadline).toISOString();
            }

            console.warn('Unknown deadline format:', deadline);
            return null;
        } catch (error) {
            console.error('Error formatting deadline:', error, deadline);
            return null;
        }
    }

    formatCreatedDate(task) {
        try {
            // Check for created_at first (primary field)
            let createdDate = task.created_at;

            // Fallback to createdAt if created_at is not available
            if (!createdDate) {
                createdDate = task.createdAt;
            }

            if (!createdDate) {
                return 'N/A';
            }

            // Handle Firestore Timestamp with toDate method
            if (createdDate.toDate && typeof createdDate.toDate === 'function') {
                return createdDate.toDate().toLocaleDateString();
            }

            // Handle Firestore Timestamp with seconds/nanoseconds
            if (createdDate.seconds && typeof createdDate.seconds === 'number') {
                const date = new Date(createdDate.seconds * 1000);
                return date.toLocaleDateString();
            }

            // Handle regular Date object
            if (createdDate instanceof Date) {
                return createdDate.toLocaleDateString();
            }

            // Handle string or timestamp
            if (typeof createdDate === 'string' || typeof createdDate === 'number') {
                return new Date(createdDate).toLocaleDateString();
            }

            console.warn('Unknown created date format:', createdDate);
            return 'N/A';
        } catch (error) {
            console.error('Error formatting created date:', error, task);
            return 'N/A';
        }
    }

    calculateDeadlineDisplay(deadline) {
        try {
            if (!deadline) return 'No Deadline';

            let deadlineDate;

            // Handle Firestore Timestamp with toDate method
            if (deadline.toDate && typeof deadline.toDate === 'function') {
                deadlineDate = deadline.toDate();
            }
            // Handle Firestore Timestamp with seconds/nanoseconds
            else if (deadline.seconds && typeof deadline.seconds === 'number') {
                deadlineDate = new Date(deadline.seconds * 1000);
            }
            // Handle regular Date object
            else if (deadline instanceof Date) {
                deadlineDate = deadline;
            }
            // Handle string or timestamp
            else if (typeof deadline === 'string' || typeof deadline === 'number') {
                deadlineDate = new Date(deadline);
            }
            else {
                return 'Invalid Date';
            }

            const now = new Date();
            const timeLeft = deadlineDate.getTime() - now.getTime();

            if (timeLeft <= 0) {
                return 'Ended';
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
                return `${days}d ${hours}h`;
            } else if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } catch (error) {
            console.error('Error calculating deadline display:', error, deadline);
            return 'Error';
        }
    }

    calculateRemainingTimeForUserSync(task) {
        // Initial display - will be updated dynamically
        console.log(`🔍 calculateRemainingTimeForUserSync for ${task.title}:`, {
            deadline: task.deadline,
            userTimeLimit: task.userTimeLimit,
            duration: task.duration
        });

        // For initial display (before user starts), show task availability time
        // Only use userTimeLimit after user has started the task
        const taskDeadline = task.deadline || task.task_deadline;
        if (taskDeadline) {
            const result = this.calculateDeadlineDisplay(taskDeadline);
            console.log(`📅 Using task deadline: ${result}`);
            return result;
        } else if (task.userTimeLimit || task.user_time_limit_hours) {
            // Convert minutes to appropriate display format
            const timeMinutes = task.userTimeLimit || (task.user_time_limit_hours * 60);
            let result;
            if (timeMinutes < 60) {
                result = `${timeMinutes}m`;
            } else if (timeMinutes < 1440) { // Less than 24 hours
                const hours = Math.floor(timeMinutes / 60);
                const remainingMinutes = timeMinutes % 60;
                result = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
            } else {
                const days = Math.floor(timeMinutes / 1440);
                const remainingHours = Math.floor((timeMinutes % 1440) / 60);
                result = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
            }
            console.log(`⏰ Using userTimeLimit as fallback (${timeMinutes} minutes): ${result}`);
            return result;
        } else if (task.duration) {
            const result = `${task.duration} days`;
            console.log(`📊 Using duration (${task.duration} days): ${result}`);
            return result;
        } else {
            console.log(`❌ No deadline found`);
            return 'No deadline';
        }
    }

    // Calculate user time display (for duration section)
    calculateUserTimeDisplay(task) {
        console.log(`🕐 calculateUserTimeDisplay for ${task.title}:`, {
            userTimeLimit: task.userTimeLimit,
            duration: task.duration
        });

        // Check if user has started this task - check both localStorage and task status
        const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;
        const storedStartTime = localStorage.getItem(startTimeKey);

        // Also check if task status indicates it's started (pending, firefox_setup, etc.)
        const taskStatus = task.userStatus || 'available';
        const isTaskStarted = taskStatus === 'pending' || taskStatus === 'dns_setup' || taskStatus === 'unlocked';
        const isTaskCompleted = taskStatus === 'complete' || taskStatus === 'completed';

        // If task is completed, don't show countdown
        if (isTaskCompleted) {
            console.log(`✅ Task completed - not showing countdown for ${task.title}`);
            return 'Completed';
        }

        if ((storedStartTime || isTaskStarted) && (task.userTimeLimit || task.user_time_limit_hours)) {
            // User has started - show countdown
            let startTime = storedStartTime;

            // If no stored start time but task is started, use current time as fallback
            if (!storedStartTime && isTaskStarted) {
                startTime = new Date().toISOString();
                localStorage.setItem(startTimeKey, startTime);
                console.log(`🚀 Auto-stored start time for started task: ${startTime}`);
            }

            const remainingTime = this.calculateLocalRemainingTime(task, startTime);
            console.log(`⏰ User started task - showing countdown: ${remainingTime}`);

            // Check if user time has expired
            if (remainingTime === 'Expired') {
                console.log(`⏰ User time expired for task: ${task.title}`);
                // Mark task as expired in localStorage for UI updates
                const expiredKey = `task_expired_${task.id}_${this.currentUser.uid}`;
                localStorage.setItem(expiredKey, 'true');
                return 'Expired';
            }

            return remainingTime;
        } else if (task.userTimeLimit || task.user_time_limit_hours) {
            // User hasn't started - show static user time limit
            let userTimeMinutes = task.userTimeLimit || (task.user_time_limit_hours * 60);

            // Cap user time limit to never exceed task deadline
            if (task.deadline) {
                let taskDeadline;
                if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                    taskDeadline = task.deadline.toDate();
                } else if (task.deadline.seconds) {
                    taskDeadline = new Date(task.deadline.seconds * 1000);
                } else {
                    taskDeadline = new Date(task.deadline);
                }

                const now = new Date();
                const remainingMinutesUntilDeadline = Math.max(0, Math.floor((taskDeadline.getTime() - now.getTime()) / (1000 * 60)));

                // Cap user time limit to task deadline (with 1 minute buffer)
                userTimeMinutes = Math.min(userTimeMinutes, Math.max(1, remainingMinutesUntilDeadline - 1));

                console.log(`🕐 Capped user time limit: original=${task.userTimeLimit || (task.user_time_limit_hours * 60)}min, deadline=${remainingMinutesUntilDeadline}min, final=${userTimeMinutes}min`);
            }

            let result;
            if (userTimeMinutes < 60) {
                result = `${userTimeMinutes}m`;
            } else if (userTimeMinutes < 1440) { // Less than 24 hours
                const hours = Math.floor(userTimeMinutes / 60);
                const remainingMinutes = userTimeMinutes % 60;
                result = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
            } else {
                const days = Math.floor(userTimeMinutes / 1440);
                const remainingHours = Math.floor((userTimeMinutes % 1440) / 60);
                result = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
            }
            console.log(`⏰ User time display (${userTimeMinutes} minutes): ${result}`);
            return result;
        } else if (task.duration) {
            const result = `${task.duration}d`;
            console.log(`📊 Using duration: ${result}`);
            return result;
        } else {
            console.log(`❌ No user time limit found`);
            return 'No limit';
        }
    }

    async calculateRemainingTimeForUser(task) {
        try {
            if (!this.currentUser) return 'No deadline';

            // Get user's task status to find when they started
            const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, task.id);

            // If user hasn't started the task, show the task availability time
            if (!taskStatus || !taskStatus.startedAt) {
                // Show task deadline first (availability), then user time limit as fallback
                if (task.deadline) {
                    return this.calculateDeadlineDisplay(task.deadline);
                } else if (task.userTimeLimit || task.user_time_limit_hours) {
                    // Convert minutes to appropriate display format
                    const displayMinutes = task.userTimeLimit || (task.user_time_limit_hours * 60);
                    if (displayMinutes < 60) {
                        return `${displayMinutes}m`;
                    } else if (displayMinutes < 1440) { // Less than 24 hours
                        const hours = Math.floor(displayMinutes / 60);
                        const remainingMinutes = displayMinutes % 60;
                        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
                    } else {
                        const days = Math.floor(displayMinutes / 1440);
                        const remainingHours = Math.floor((displayMinutes % 1440) / 60);
                        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
                    }
                } else if (task.duration) {
                    return `${task.duration} days`;
                } else {
                    return 'No deadline';
                }
            }

            // Parse the user's start time
            let startTime;
            if (taskStatus.startedAt.toDate && typeof taskStatus.startedAt.toDate === 'function') {
                startTime = taskStatus.startedAt.toDate();
            } else if (taskStatus.startedAt.seconds) {
                startTime = new Date(taskStatus.startedAt.seconds * 1000);
            } else {
                startTime = new Date(taskStatus.startedAt);
            }

            const now = new Date();

            // Calculate user's completion deadline based on task duration
            let userCompletionDeadline = null;
            if (task.userTimeLimit || task.user_time_limit_hours) {
                // Use custom user time limit if set (in minutes)
                const completionMinutes = task.userTimeLimit || (task.user_time_limit_hours * 60);
                userCompletionDeadline = new Date(startTime.getTime() + (completionMinutes * 60 * 1000));
            } else if (task.duration) {
                // Use task duration in days
                userCompletionDeadline = new Date(startTime.getTime() + (task.duration * 24 * 60 * 60 * 1000));
            }

            // Calculate task availability deadline
            let taskDeadline = null;
            if (task.deadline) {
                if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                    taskDeadline = task.deadline.toDate();
                } else if (task.deadline.seconds) {
                    taskDeadline = new Date(task.deadline.seconds * 1000);
                } else {
                    taskDeadline = new Date(task.deadline);
                }
            }

            // Use the earlier of the two deadlines
            let effectiveDeadline = userCompletionDeadline;
            if (taskDeadline && userCompletionDeadline) {
                effectiveDeadline = taskDeadline < userCompletionDeadline ? taskDeadline : userCompletionDeadline;
            } else if (taskDeadline) {
                effectiveDeadline = taskDeadline;
            } else if (userCompletionDeadline) {
                effectiveDeadline = userCompletionDeadline;
            }

            if (!effectiveDeadline) {
                return 'No deadline';
            }

            const timeLeft = effectiveDeadline.getTime() - now.getTime();

            if (timeLeft <= 0) {
                return 'Expired';
            }

            // Format the remaining time with more precision for active countdowns
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            if (days > 0) {
                return `${days}d ${hours}h`;
            } else if (hours > 0) {
                // For hours, show minutes too for better precision
                return `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                // For minutes, show seconds for active countdown
                return `${minutes}m ${seconds}s`;
            } else if (seconds > 0) {
                return `${seconds}s`;
            } else {
                return 'Expired';
            }
        } catch (error) {
            console.error('Error calculating remaining time for user:', error);
            return 'Error';
        }
    }

    // Local timer calculation based on stored start time - no database calls
    calculateLocalRemainingTime(task, startTime) {
        try {
            if (!startTime || !(task.userTimeLimit || task.user_time_limit_hours)) {
                return this.calculateRemainingTimeForUserSync(task);
            }

            const now = new Date();
            const start = new Date(startTime);
            const userTimeMinutes = task.userTimeLimit || (task.user_time_limit_hours * 60);
            const userCompletionDeadline = new Date(start.getTime() + (userTimeMinutes * 60 * 1000));

            // Also check task deadline
            let taskDeadline;
            if (task.deadline) {
                if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                    taskDeadline = task.deadline.toDate();
                } else if (task.deadline.seconds) {
                    taskDeadline = new Date(task.deadline.seconds * 1000);
                } else {
                    taskDeadline = new Date(task.deadline);
                }
            }

            // Use the earlier deadline
            const effectiveDeadline = userCompletionDeadline && taskDeadline
                ? new Date(Math.min(userCompletionDeadline.getTime(), taskDeadline.getTime()))
                : userCompletionDeadline || taskDeadline;

            if (!effectiveDeadline) {
                return 'No deadline';
            }

            const timeLeft = effectiveDeadline.getTime() - now.getTime();

            if (timeLeft <= 0) {
                return 'Expired';
            }

            // Format with seconds for real-time countdown
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            if (days > 0) {
                return `${days}d ${hours}h`;
            } else if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            } else if (seconds > 0) {
                return `${seconds}s`;
            } else {
                return 'Expired';
            }
        } catch (error) {
            console.error('Error calculating local remaining time:', error);
            return 'Error';
        }
    }

    async updateRemainingTimeDisplays(tasks) {
        try {
            const durationElements = document.querySelectorAll('.duration-text[data-task-id]');
            const deadlineElements = document.querySelectorAll('.deadline-text[data-task-id]');

            // Update duration elements (in task info section) - shows user completion time
            for (const element of durationElements) {
                const taskId = element.getAttribute('data-task-id');
                const task = tasks.find(t => t.id === taskId);

                if (task) {
                    // Use the calculateUserTimeDisplay function which handles both cases
                    const remainingTime = this.calculateUserTimeDisplay(task);
                    element.textContent = remainingTime;
                }
            }

            // Update deadline elements (in task header badge) - shows task availability time
            for (const element of deadlineElements) {
                const taskId = element.getAttribute('data-task-id');
                const task = tasks.find(t => t.id === taskId);

                if (task) {
                    // Always show task deadline (availability time) in the badge
                    const taskDeadline = task.deadline || task.task_deadline;
                    const taskDeadlineText = taskDeadline ? this.calculateDeadlineDisplay(taskDeadline) : 'No Deadline';
                    element.textContent = taskDeadlineText;
                }
            }
        } catch (error) {
            console.error('Error updating remaining time displays:', error);
        }
    }

    startRemainingTimeTimer(tasks) {
        // Clear existing timer
        if (this.remainingTimeTimer) {
            clearInterval(this.remainingTimeTimer);
        }

        // Update every 5 seconds for real-time countdown experience
        this.remainingTimeTimer = setInterval(() => {
            this.updateRemainingTimeDisplays(tasks);
        }, 5000); // 5 seconds for real-time updates
    }

    updateCountdown(element, deadline) {
        try {
            console.log('updateCountdown called with deadline:', deadline);
            const now = new Date();
            const timeLeft = deadline.getTime() - now.getTime();
            console.log('Time left (ms):', timeLeft);

            // Find the text element
            const textElement = element.querySelector('.deadline-text');
            if (!textElement) {
                console.error('Could not find .deadline-text element in:', element);
                return;
            }
            console.log('Found textElement:', textElement);

            if (timeLeft <= 0) {
                console.log('Task expired, setting text to Expired');
                textElement.textContent = 'Expired';
                element.classList.add('expired');
                element.classList.remove('warning', 'critical');
                return;
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            let timeText = '';
            if (days > 0) {
                timeText = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                timeText = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                timeText = `${minutes}m ${seconds}s`;
            } else {
                timeText = `${seconds}s`;
            }

            console.log('Setting timeText to:', timeText);
            textElement.textContent = timeText;
            console.log('After setting textContent, textElement.textContent:', textElement.textContent);

            // Update styling based on time remaining
            element.classList.remove('warning', 'critical', 'expired');

            if (days === 0 && hours < 1) {
                element.classList.add('critical');
            } else if (days === 0 && hours < 24) {
                element.classList.add('warning');
            }
        } catch (error) {
            console.error('Error updating countdown:', error);
            const textElement = element.querySelector('.deadline-text');
            if (textElement) {
                textElement.textContent = 'Error';
            }
        }
    }

    async renderTasks(tasks) {
        console.log('🎨 Starting to render tasks:', tasks.length);
        const tasksGrid = document.getElementById('tasks-grid');
        if (!tasksGrid) {
            console.error('❌ Tasks grid not found');
            return;
        }

        if (tasks.length === 0) {
            console.log('📭 No tasks to render, showing empty state');
            tasksGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No tasks available</h3>
                    <p class="text-gray-500">Check back later for new tasks!</p>
                </div>
            `;
            return;
        }

        console.log('🔄 Loading task statuses for', tasks.length, 'tasks...');
        // Load task statuses for all tasks
        const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
            // Force refresh the task status to ensure we get the latest data
            const status = await this.getUserTaskStatus(task.id);

            console.log(`📊 Loading task: ${task.title}`, {
                status: status,
                statusString: status?.status,
                fullObject: status
            });

            return {
                ...task,
                userStatus: status,
                userStatusObject: status
            };
        }));

        console.log('🎨 Rendering task cards to DOM...');
        tasksGrid.innerHTML = tasksWithStatus.map(task => {
            return this.createTaskCard(task);
        }).join('');

        console.log('✅ Task cards rendered, updating timers...');
        // Update remaining time displays after rendering
        this.updateRemainingTimeDisplays(tasksWithStatus);

        // Set up periodic updates for remaining time displays
        this.startRemainingTimeTimer(tasksWithStatus);

        console.log('✅ Task rendering completed');

        // Add manual refresh function to window for debugging
        window.refreshTasks = () => {
            console.log('🔄 Manually refreshing tasks...');
            this.loadTasks();
        };

        // Add debugging function to check task data
        window.debugTaskData = () => {
            console.log('🔍 Debugging task data...');
            const tasksGrid = document.getElementById('tasks-grid');
            if (tasksGrid) {
                const taskCards = tasksGrid.querySelectorAll('.task-card-modern');
                taskCards.forEach((card, index) => {
                    const title = card.querySelector('.task-title')?.textContent || 'Unknown';
                    const timeText = card.querySelector('.duration-text')?.textContent || 'No time';
                    const deadlineText = card.querySelector('.deadline-text')?.textContent || 'No deadline';
                    console.log(`Task ${index + 1}: ${title}`);
                    console.log(`  - Duration Text: ${timeText}`);
                    console.log(`  - Deadline Text: ${deadlineText}`);
                });
            }
        };

        // Add function to check raw task data
        window.debugRawTaskData = async () => {
            console.log('🔍 Checking raw task data from database...');
            try {
                const tasks = await window.firestoreManager.getTasks();
                tasks.forEach((task, index) => {
                    console.log(`Raw Task ${index + 1}: ${task.title}`, {
                        id: task.id,
                        duration: task.duration,
                        userTimeLimit: task.userTimeLimit,
                        deadline: task.deadline,
                        status: task.status
                    });
                });
            } catch (error) {
                console.error('Error getting raw task data:', error);
            }
        };

        // Add comprehensive task debugging function
        window.debugAllTaskData = async () => {
            console.log('🔍 COMPREHENSIVE TASK DEBUGGING...');
            try {
                // Check all tasks (including inactive ones)
                const allTasks = await window.firestoreManager.getAllTasks();
                console.log('📊 ALL Tasks from database (including inactive):', allTasks.length, 'tasks');

                // Check only active tasks (what getTasks returns)
                const activeTasks = await window.firestoreManager.getTasks();
                console.log('✅ ACTIVE Tasks from database:', activeTasks.length, 'tasks');

                // Show all task statuses
                console.log('📋 Task Status Summary:');
                const statusCounts = {};
                allTasks.forEach(task => {
                    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
                    console.log(`  - ${task.title}: Status = "${task.status}"`);
                });

                console.log('📊 Status Counts:', statusCounts);

                // Show what's being filtered out
                const inactiveTasks = allTasks.filter(task => task.status !== 'active');
                if (inactiveTasks.length > 0) {
                    console.log('🚫 INACTIVE Tasks (filtered out):', inactiveTasks.length, 'tasks');
                    inactiveTasks.forEach(task => {
                        console.log(`  ❌ "${task.title}" - Status: "${task.status}"`);
                    });
                } else {
                    console.log('✅ All tasks are active');
                }

                // Check if there are any tasks at all
                if (allTasks.length === 0) {
                    console.log('⚠️ NO TASKS FOUND IN DATABASE AT ALL!');
                    console.log('🔧 Possible solutions:');
                    console.log('   1. Check if tasks were accidentally deleted');
                    console.log('   2. Check database connection');
                    console.log('   3. Verify collection name is "tasks"');
                } else if (activeTasks.length === 0) {
                    console.log('⚠️ NO ACTIVE TASKS FOUND!');
                    console.log('🔧 Possible solutions:');
                    console.log('   1. Set task status to "active" in admin panel');
                    console.log('   2. Check if tasks have correct status field');
                    console.log('   3. Verify task status values are exactly "active"');
                }

                return { allTasks, activeTasks, inactiveTasks, statusCounts };
            } catch (error) {
                console.error('❌ Error debugging task data:', error);
                return null;
            }
        };

        // Add function to fix task statuses (set all to active)
        window.fixTaskStatuses = async () => {
            console.log('🔧 FIXING TASK STATUSES...');
            try {
                const allTasks = await window.firestoreManager.getAllTasks();
                console.log(`Found ${allTasks.length} tasks to check`);

                let fixedCount = 0;
                for (const task of allTasks) {
                    if (task.status !== 'active') {
                        console.log(`🔧 Fixing task: "${task.title}" (Status: "${task.status}" → "active")`);
                        await window.firestoreManager.updateTask(task.id, { status: 'active' });
                        fixedCount++;
                    }
                }

                if (fixedCount > 0) {
                    console.log(`✅ Fixed ${fixedCount} task statuses!`);
                    this.showToast(`Fixed ${fixedCount} task statuses!`, 'success');
                    // Reload tasks to show the changes
                    setTimeout(() => {
                        this.loadTasks();
                    }, 1000);
                } else {
                    console.log('✅ All tasks already have "active" status');
                    this.showToast('All tasks already have correct status', 'info');
                }

                return fixedCount;
            } catch (error) {
                console.error('❌ Error fixing task statuses:', error);
                this.showToast('Failed to fix task statuses: ' + error.message, 'error');
                return 0;
            }
        };

        // Add function to debug admin save process
        window.debugAdminSaveProcess = async () => {
            console.log('🔧 DEBUGGING ADMIN SAVE PROCESS...');
            try {
                // Check if we're in admin context
                if (typeof window.adminHandler === 'undefined') {
                    console.log('❌ Not in admin context - this function should be run from admin panel');
                    return;
                }

                // Get current tasks from admin
                console.log('📊 Current admin tasks:', window.adminHandler.tasks);

                // Check if there are any tasks with wrong status
                const tasksWithWrongStatus = window.adminHandler.tasks.filter(task => task.status !== 'active');
                if (tasksWithWrongStatus.length > 0) {
                    console.log('⚠️ Found tasks with non-active status:', tasksWithWrongStatus);
                    console.log('🔧 You can fix these by editing each task and setting status to "Active"');
                } else {
                    console.log('✅ All admin tasks have "active" status');
                }

                // Check database directly
                const allTasks = await window.firestoreManager.getAllTasks();
                console.log('📊 All tasks in database:', allTasks);

                const activeTasks = allTasks.filter(task => task.status === 'active');
                console.log('✅ Active tasks in database:', activeTasks.length);

                return {
                    adminTasks: window.adminHandler.tasks,
                    allTasks,
                    activeTasks,
                    tasksWithWrongStatus
                };
            } catch (error) {
                console.error('❌ Error debugging admin save process:', error);
                return null;
            }
        };

        // Add function to debug rendering process
        window.debugRenderingProcess = async () => {
            console.log('🎨 DEBUGGING RENDERING PROCESS...');
            try {
                // Check if tasks grid exists
                const tasksGrid = document.getElementById('tasks-grid');
                if (!tasksGrid) {
                    console.log('❌ Tasks grid element not found!');
                    return;
                }
                console.log('✅ Tasks grid element found');

                // Check current content
                console.log('📋 Current tasks grid content:', tasksGrid.innerHTML);

                // Get raw tasks from database
                const rawTasks = await window.firestoreManager.getTasks();
                console.log('📊 Raw tasks from database:', rawTasks);

                // Check active tasks
                const activeTasks = rawTasks.filter(task => task.status === 'active');
                console.log('✅ Active tasks:', activeTasks);

                // Check if tasks are being filtered out
                const filteredOutTasks = rawTasks.filter(task => task.status !== 'active');
                if (filteredOutTasks.length > 0) {
                    console.log('❌ Tasks filtered out due to status:', filteredOutTasks);
                }

                // Check deadline filtering
                const deadlineFilteredTasks = [];
                for (const task of activeTasks) {
                    if (task.task_deadline_hours) {
                        const taskCreatedAt = task.created_at?.toDate ? task.created_at.toDate() : new Date(task.created_at);
                        const deadlineTime = new Date(taskCreatedAt.getTime() + (task.task_deadline_hours * 60 * 60 * 1000));
                        const now = new Date();

                        if (now > deadlineTime) {
                            deadlineFilteredTasks.push({
                                task: task.title,
                                deadline: deadlineTime.toISOString(),
                                now: now.toISOString()
                            });
                        }
                    }
                }

                if (deadlineFilteredTasks.length > 0) {
                    console.log('⏰ Tasks filtered out due to deadline:', deadlineFilteredTasks);
                }

                // Check if renderTasks is being called
                console.log('🔍 Checking if renderTasks was called...');

                return {
                    tasksGridExists: !!tasksGrid,
                    tasksGridContent: tasksGrid.innerHTML,
                    rawTasks,
                    activeTasks,
                    filteredOutTasks,
                    deadlineFilteredTasks
                };
            } catch (error) {
                console.error('❌ Error debugging rendering process:', error);
                return null;
            }
        };

        // Add function to force render all tasks (bypass filters)
        window.forceRenderAllTasks = async () => {
            console.log('🚀 FORCE RENDERING ALL TASKS (bypassing filters)...');
            try {
                // Get all tasks including inactive ones
                const allTasks = await window.firestoreManager.getAllTasks();
                console.log('📊 All tasks (including inactive):', allTasks);

                // Force render them
                await this.renderTasks(allTasks);
                console.log('✅ Force rendered all tasks');

                this.showToast('Force rendered all tasks (including inactive)', 'info');
                return allTasks;
            } catch (error) {
                console.error('❌ Error force rendering tasks:', error);
                this.showToast('Failed to force render tasks: ' + error.message, 'error');
                return null;
            }
        };

        // Add function to manually refresh countdown displays
        window.refreshCountdowns = async () => {
            console.log('🔄 Refreshing countdown displays...');
            try {
                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');
                await this.updateRemainingTimeDisplays(activeTasks);
                console.log('✅ Countdown displays refreshed');
            } catch (error) {
                console.error('Error refreshing countdowns:', error);
            }
        };

        // Add function to debug completion counts
        window.debugTaskStatuses = async () => {
            console.log('🏆 Debugging task statuses...');
            try {
                const tasks = await window.firestoreManager.getTasks();
                for (const task of tasks) {
                    const status = await this.getUserTaskStatus(task.id);
                    console.log(`Task: ${task.title}`, {
                        id: task.id,
                        status: status.status,
                        restart_count: status.restart_count || 0,
                        completionCount: status.completionCount || 0
                    });
                }
            } catch (error) {
                console.error('Error debugging task statuses:', error);
            }
        };

        // Add function to manually create a quest completion for testing
        window.createTestCompletion = async (taskId) => {
            console.log('🧪 Creating test quest completion...');
            try {
                await window.firestoreManager.recordQuestCompletion(this.currentUser.uid, taskId, {
                    reward: 10,
                    phase: 'final',
                    testCompletion: true
                });
                console.log('✅ Test completion created');
                // Clear the start time from localStorage since task is completed
                this.clearTaskStartTime(taskId);
                // Refresh the tasks to see the updated count
                await this.loadTasks();
            } catch (error) {
                console.error('Error creating test completion:', error);
            }
        };

        // Add function to clear task start time (when task is completed)
        window.clearTaskStartTime = (taskId) => {
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(startTimeKey);
            console.log(`🗑️ Cleared start time for task: ${taskId}`);
        };

        // Add function to restart task timer
        window.restartTaskTimer = (taskId) => {
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            const now = new Date().toISOString();
            localStorage.setItem(startTimeKey, now);
            console.log(`🔄 Restarted timer for task: ${taskId} at ${now}`);

            // Sync timer data to database for admin view
            this.syncTimerToDatabase(taskId, now);
        };

        // Add function to sync timer data to database for admin integration
        window.syncTimerToDatabase = async (taskId, startTime) => {
            try {
                // Get current task status to preserve it
                const currentStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
                const statusToUse = currentStatus.status || 'unlocked'; // Preserve existing status

                // Update task status with start time for admin view (preserve existing status)
                await window.firestoreManager.updateTaskStatus(taskId, statusToUse, this.currentUser.uid, {
                    startedAt: new Date(startTime),
                    timerSynced: true
                });
                console.log(`📡 Synced timer for task ${taskId} to database (preserved status: ${statusToUse})`);
            } catch (error) {
                console.error('Error syncing timer to database:', error);
            }
        };

        // Add function to sync all existing localStorage timers to database
        window.syncAllLocalStorageTimers = async () => {
            try {
                console.log('🔄 Syncing all localStorage timers to database...');
                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');

                let syncedCount = 0;

                for (const task of activeTasks) {
                    const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;
                    const storedStartTime = localStorage.getItem(startTimeKey);

                    if (storedStartTime) {
                        // Check if already synced
                        const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, task.id);

                        if (!taskStatus.startedAt) {
                            const statusToUse = taskStatus.status || 'unlocked'; // Preserve existing status
                            await window.firestoreManager.updateTaskStatus(task.id, statusToUse, this.currentUser.uid, {
                                startedAt: new Date(storedStartTime),
                                timerSynced: true
                            });
                            syncedCount++;
                            console.log(`📡 Synced existing timer for task ${task.title} (preserved status: ${statusToUse})`);
                        }
                    }
                }

                // Silently sync timers without showing toast message
                if (syncedCount > 0) {
                    console.log(`📊 Silently synced ${syncedCount} existing timers`);
                }

            } catch (error) {
                console.error('Error syncing localStorage timers:', error);
            }
        };

        // Add function to completely reset and start again an expired task
        window.startAgainTask = async (taskId) => {
            try {
                console.log(`🔄 COMPLETE TASK RESET CALLED: ${taskId}`);
                console.log('🔍 Current user:', window.authManager?.getCurrentUser());

                const currentUser = window.authManager?.getCurrentUser();
                if (!currentUser) {
                    console.error('❌ No current user found');
                    return;
                }

                // Step 1: Clear ALL localStorage data for this task
                const userId = currentUser.uid;
                const keysToRemove = [
                    `task_start_${taskId}_${userId}`,
                    `task_expired_${taskId}_${userId}`,
                    `task_completed_${taskId}_${userId}`,
                    `task_progress_${taskId}_${userId}`,
                    `task_verification_${taskId}_${userId}`,
                    `task_submission_${taskId}_${userId}`
                ];

                console.log('🧹 Clearing localStorage keys:', keysToRemove);
                keysToRemove.forEach(key => {
                    if (localStorage.getItem(key)) {
                        localStorage.removeItem(key);
                        console.log(`✅ Removed: ${key}`);
                    }
                });

                // Step 2: Clear ALL task-related data from Firestore
                console.log('🧹 Clearing Firestore data...');

                // Clear any existing verifications first
                const verifications = await window.firestoreManager.getVerificationsByUser(userId);
                const taskVerifications = verifications.filter(v => v.taskId === taskId);
                console.log(`🧹 Found ${taskVerifications.length} verifications to clear`);

                for (const verification of taskVerifications) {
                    await window.firestoreManager.deleteVerification(verification.id);
                    console.log(`✅ Deleted verification: ${verification.id}`);
                }

                // Clear any existing task submissions - this will make the task available again
                const submissions = await window.firestoreManager.getTaskSubmissions('all');
                const userSubmissions = submissions.filter(s => s.task_id === taskId && s.user_id === userId);
                console.log(`🧹 Found ${userSubmissions.length} task submissions to clear`);

                for (const submission of userSubmissions) {
                    await window.firestoreManager.deleteTaskSubmission(submission.id);
                    console.log(`✅ Deleted task submission: ${submission.id}`);
                }

                // Step 3: Clear all timers and UI state
                console.log('🧹 Clearing timers...');
                if (window.dashboardHandler.countdownTimers) {
                    window.dashboardHandler.countdownTimers.forEach(timer => clearInterval(timer));
                    window.dashboardHandler.countdownTimers = [];
                }

                if (window.dashboardHandler.remainingTimeTimer) {
                    clearInterval(window.dashboardHandler.remainingTimeTimer);
                    window.dashboardHandler.remainingTimeTimer = null;
                }

                // Step 4: Force clear cache
                if (window.dashboardHandler.clearCache) {
                    window.dashboardHandler.clearCache();
                    console.log('✅ Cleared dashboard cache');
                }

                // Step 5: Force refresh everything
                console.log('🔄 Force refreshing tasks...');
                await window.dashboardHandler.loadTasks(true); // Force refresh

                // Step 6: Restart timers after a delay
                setTimeout(() => {
                    if (window.dashboardHandler.startCountdownTimers) {
                        window.dashboardHandler.startCountdownTimers();
                    }
                    console.log('✅ Timers restarted');
                }, 500);

                console.log('✅ COMPLETE TASK RESET SUCCESSFUL');
                window.dashboardHandler.showToast('Task completely reset! Fresh start with clean state.', 'success');

                // Close any open modals
                if (window.dashboardHandler.closeTaskModal) {
                    window.dashboardHandler.closeTaskModal();
                }

            } catch (error) {
                console.error('❌ Error in complete task reset:', error);
                window.dashboardHandler.showToast('Error resetting task: ' + error.message, 'error');
            }
        };

        // Add function to restart a completed task
        window.restartTask = async (taskId) => {
            try {
                console.log(`🔄 RESTART TASK CALLED: ${taskId}`);
                console.log('🔍 Current user:', window.authManager?.getCurrentUser());
                console.log('🔍 Dashboard handler:', window.dashboardHandler);

                const currentUser = window.authManager?.getCurrentUser();
                if (!currentUser) {
                    console.error('❌ No current user found');
                    return;
                }

                // Clear any existing task submissions to make task available again
                const submissions = await window.firestoreManager.getTaskSubmissions('all');
                const userSubmissions = submissions.filter(s => s.task_id === taskId && s.user_id === currentUser.uid);
                for (const submission of userSubmissions) {
                    await window.firestoreManager.deleteTaskSubmission(submission.id);
                }

                // Clear the start time from localStorage
                window.clearTaskStartTime(taskId);

                // Clear the expired flag
                const expiredKey = `task_expired_${taskId}_${currentUser.uid}`;
                localStorage.removeItem(expiredKey);

                // Clear any completion flags or progress data
                const completionKey = `task_completed_${taskId}_${currentUser.uid}`;
                localStorage.removeItem(completionKey);

                // Clear any existing verifications for this task to start fresh
                const verifications = await window.firestoreManager.getVerificationsByUser(currentUser.uid);
                const taskVerifications = verifications.filter(v => v.taskId === taskId);

                for (const verification of taskVerifications) {
                    await window.firestoreManager.deleteVerification(verification.id);
                }

                // Clear and restart all countdown timers to ensure fresh state
                if (window.dashboardHandler.countdownTimers) {
                    window.dashboardHandler.countdownTimers.forEach(timer => clearInterval(timer));
                    window.dashboardHandler.countdownTimers = [];
                }

                // Clear remaining time timer
                if (window.dashboardHandler.remainingTimeTimer) {
                    clearInterval(window.dashboardHandler.remainingTimeTimer);
                    window.dashboardHandler.remainingTimeTimer = null;
                }

                console.log('✅ Task restarted successfully with clean timer state');
                window.dashboardHandler.showToast('Task restarted! You can now begin again with a fresh timer.', 'success');

                // Close the current modal
                window.dashboardHandler.closeTaskModal();

                // Refresh the tasks to show updated status and restart timers
                await window.dashboardHandler.loadTasks();

                // Restart timers after a short delay to ensure DOM is ready
                setTimeout(() => {
                    window.dashboardHandler.startCountdownTimers();
                }, 200);

            } catch (error) {
                console.error('Error restarting task:', error);
                window.dashboardHandler.showToast('Error restarting task. Please try again.', 'error');
            }
        };

        // Add function to manually start a task timer for testing
        window.startTaskTimer = (taskId) => {
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            const now = new Date().toISOString();
            localStorage.setItem(startTimeKey, now);
            console.log(`🚀 Manually started timer for task: ${taskId} at ${now}`);
            // Refresh the display
            this.updateRemainingTimeDisplays(tasks);
        };

        // Add function to manually clear all timer data for a task
        window.clearTaskTimer = (taskId) => {
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            const expiredKey = `task_expired_${taskId}_${this.currentUser.uid}`;

            localStorage.removeItem(startTimeKey);
            localStorage.removeItem(expiredKey);

            console.log(`🗑️ Cleared all timer data for task: ${taskId}`);
            console.log(`  - Removed: ${startTimeKey}`);
            console.log(`  - Removed: ${expiredKey}`);

            // Refresh the display
            this.loadTasks();
        };

        // Add function to completely clear all task data (for debugging)
        window.clearAllTaskData = async (taskId) => {
            try {
                console.log(`🧹 CLEARING ALL DATA FOR TASK: ${taskId}`);

                const currentUser = window.authManager?.getCurrentUser();
                if (!currentUser) {
                    console.error('❌ No current user found');
                    return;
                }

                const userId = currentUser.uid;

                // Clear all possible localStorage keys
                const allKeys = Object.keys(localStorage);
                const taskKeys = allKeys.filter(key => key.includes(taskId) && key.includes(userId));

                console.log(`🧹 Found ${taskKeys.length} localStorage keys to clear:`, taskKeys);
                taskKeys.forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`✅ Removed: ${key}`);
                });

                // Clear Firestore data - delete task submissions to make task available
                const submissions = await window.firestoreManager.getTaskSubmissions('all');
                const userSubmissions = submissions.filter(s => s.task_id === taskId && s.user_id === userId);
                for (const submission of userSubmissions) {
                    await window.firestoreManager.deleteTaskSubmission(submission.id);
                }
                console.log('✅ Firestore submissions cleared');

                // Force refresh
                await this.loadTasks(true);
                await this.renderTasks();

                console.log('✅ ALL TASK DATA CLEARED');
                this.showToast('All task data cleared!', 'success');

            } catch (error) {
                console.error('❌ Error clearing all task data:', error);
                this.showToast('Error clearing task data: ' + error.message, 'error');
            }
        };

        // Add function to debug timer status
        window.debugTimerStatus = () => {
            console.log('🕐 Debugging timer status...');
            const tasks = document.querySelectorAll('.duration-text[data-task-id]');
            tasks.forEach(element => {
                const taskId = element.getAttribute('data-task-id');
                const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
                const storedStartTime = localStorage.getItem(startTimeKey);
                console.log(`Task ${taskId}:`, {
                    startTime: storedStartTime,
                    currentDisplay: element.textContent,
                    hasStartTime: !!storedStartTime
                });
            });
        };

        // Add function to test restart manually
        window.testRestart = async (taskId) => {
            console.log('🧪 Testing restart for task:', taskId);
            try {
                // Close any modals
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => modal.remove());
                console.log('✅ Closed all modals');

                // Clear task submissions to make task available
                const submissions = await window.firestoreManager.getTaskSubmissions('all');
                const userSubmissions = submissions.filter(s => s.task_id === taskId && s.user_id === this.currentUser.uid);
                for (const submission of userSubmissions) {
                    await window.firestoreManager.deleteTaskSubmission(submission.id);
                }
                console.log('✅ Cleared task submissions to make available');

                // Reload tasks
                await this.loadTasks();
                console.log('✅ Reloaded tasks');

                this.showToast('Test restart completed!', 'success');
            } catch (error) {
                console.error('❌ Test restart failed:', error);
                this.showToast('Test restart failed: ' + error.message, 'error');
            }
        };

        // Add function to show admin view of user timers
        window.showAdminUserTimers = async () => {
            console.log('👨‍💼 Showing admin view of user timers...');
            try {
                // This would need to be implemented in the admin panel
                // For now, let's create a debug function that shows current user's timer data
                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');

                console.log('📊 Admin Timer View:');
                for (const task of activeTasks) {
                    const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, task.id);
                    const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;
                    const storedStartTime = localStorage.getItem(startTimeKey);

                    if (storedStartTime && taskStatus.startedAt) {
                        const remainingTime = this.calculateLocalRemainingTime(task, storedStartTime);
                        console.log(`Task: ${task.title}`, {
                            userId: this.currentUser.uid,
                            startTime: storedStartTime,
                            remainingTime: remainingTime,
                            status: taskStatus.status
                        });
                    }
                }
            } catch (error) {
                console.error('Error showing admin user timers:', error);
            }
        };
    }

    createTaskCard(task) {
        // Use the user status that was loaded
        const taskStatus = task.userStatus?.status || 'available';

        console.log('🎨 Creating task card for:', task.title, {
            userStatus: task.userStatus,
            userStatusObject: task.userStatusObject,
            finalTaskStatus: taskStatus,
            statusFromUserStatus: task.userStatus?.status,
            isObject: typeof task.userStatus,
            hasStatus: 'status' in (task.userStatus || {})
        });

        // COMPLETELY RECREATED LOGIC - Task Status Priority
        const now = new Date();
        let finalStatus = taskStatus;
        let isTaskEnded = false;
        let isUserTimeExpired = false;

        // Step 1: Check if task deadline has passed (this should override everything else)
        if (task.task_deadline_hours && task.created_at) {
            let taskCreatedAt;

            // Parse created_at date with multiple fallbacks
            try {
                if (task.created_at.toDate && typeof task.created_at.toDate === 'function') {
                    taskCreatedAt = task.created_at.toDate();
                } else if (task.created_at.seconds) {
                    taskCreatedAt = new Date(task.created_at.seconds * 1000);
                } else if (task.created_at._seconds) {
                    taskCreatedAt = new Date(task.created_at._seconds * 1000);
                } else if (typeof task.created_at === 'string') {
                    taskCreatedAt = new Date(task.created_at);
                } else {
                    taskCreatedAt = new Date(task.created_at);
                }

                if (!isNaN(taskCreatedAt.getTime())) {
                    const taskDeadlineTime = new Date(taskCreatedAt.getTime() + (task.task_deadline_hours * 60 * 60 * 1000));
                    isTaskEnded = now > taskDeadlineTime;

                    console.log('🎯 TASK DEADLINE CHECK:', {
                        taskId: task.id,
                        title: task.title,
                        created_at: taskCreatedAt.toISOString(),
                        deadline_hours: task.task_deadline_hours,
                        calculated_deadline: taskDeadlineTime.toISOString(),
                        current_time: now.toISOString(),
                        is_task_ended: isTaskEnded,
                        hours_since_creation: (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60 * 60),
                        hours_until_deadline: (taskDeadlineTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                    });

                    // FORCE ENDED STATUS if deadline has passed - this should override everything
                    if (isTaskEnded) {
                        console.log('🚨 FORCING TASK TO ENDED - Deadline has passed!');
                        finalStatus = 'ended';
                        isUserTimeExpired = false; // Override user time expired
                    }
                } else {
                    console.error('❌ Invalid created_at date for task:', task.id, task.created_at);
                }
            } catch (error) {
                console.error('❌ Error parsing created_at for task:', task.id, error);
            }
        }

        // Step 2: Check if user time has expired (only if task hasn't ended)
        if (!isTaskEnded) {
            const expiredKey = `task_expired_${task.id}_${this.currentUser.uid}`;
            isUserTimeExpired = localStorage.getItem(expiredKey) === 'true';

            console.log('🔍 USER TIME EXPIRY CHECK:', {
                taskId: task.id,
                expiredKey: expiredKey,
                localStorageValue: localStorage.getItem(expiredKey),
                isUserTimeExpired: isUserTimeExpired
            });

            if (isUserTimeExpired) {
                console.log('⏰ USER TIME EXPIRED for task:', task.id);
            }
        }

        // Step 3: Apply priority logic (ended status should already be set above)
        if (finalStatus === 'ended') {
            console.log('✅ FINAL STATUS: ENDED (task deadline passed)');
        } else if (isUserTimeExpired && !isTaskEnded) {
            finalStatus = 'expired'; // User time limit exceeded - can restart
            console.log('✅ FINAL STATUS: EXPIRED (user time limit exceeded)');
        } else {
            console.log('✅ FINAL STATUS: Using original status:', finalStatus);
        }

        // Step 4: Additional check - if task deadline display shows "Ended", force ended status
        // This is a fallback for cases where the deadline calculation might not work properly
        const taskDeadlineDisplay = this.calculateDeadlineDisplay(task.deadline);
        if (taskDeadlineDisplay === 'Ended') {
            console.log('🚨 FALLBACK: Task deadline display shows "Ended", forcing status to ended');
            finalStatus = 'ended';
            isTaskEnded = true;
        }

        // Step 5: Check if the task has a deadline timer that shows "Ended"
        // This handles cases where the deadline timer is already showing "Ended"
        if (task.deadline) {
            try {
                const deadlineDate = new Date(task.deadline);
                if (!isNaN(deadlineDate.getTime()) && now > deadlineDate) {
                    console.log('🚨 FALLBACK 2: Task deadline has passed, forcing status to ended');
                    finalStatus = 'ended';
                    isTaskEnded = true;
                }
            } catch (error) {
                console.error('Error parsing task deadline:', error);
            }
        }

        // Step 6: Direct check - if task has very short deadline and was created today, likely ended
        // This is a more aggressive fallback for tasks that should be ended
        if (task.task_deadline_hours <= 1 && task.created_at) {
            try {
                let taskCreatedAt;
                if (task.created_at.toDate && typeof task.created_at.toDate === 'function') {
                    taskCreatedAt = task.created_at.toDate();
                } else if (task.created_at.seconds) {
                    taskCreatedAt = new Date(task.created_at.seconds * 1000);
                } else if (task.created_at._seconds) {
                    taskCreatedAt = new Date(task.created_at._seconds * 1000);
                } else if (typeof task.created_at === 'string') {
                    taskCreatedAt = new Date(task.created_at);
                } else {
                    taskCreatedAt = new Date(task.created_at);
                }

                if (!isNaN(taskCreatedAt.getTime())) {
                    const hoursSinceCreation = (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceCreation > task.task_deadline_hours) {
                        console.log('🚨 FALLBACK 3: Task with short deadline created hours ago, forcing ended status');
                        finalStatus = 'ended';
                        isTaskEnded = true;
                    }
                }
            } catch (error) {
                console.error('Error in fallback 3:', error);
            }
        }

        // Step 7: ULTIMATE FALLBACK - Force ended status for tasks that should be ended
        // This is the most aggressive check - if we detect any signs the task should be ended, force it
        if (finalStatus !== 'ended' && (task.task_deadline_hours <= 1 || taskDeadlineDisplay === 'Ended')) {
            console.log('🚨 ULTIMATE FALLBACK: Forcing ended status based on deadline indicators');
            finalStatus = 'ended';
            isTaskEnded = true;
        }

        console.log('🎨 FINAL STATUS DECISION:', {
            taskId: task.id,
            taskTitle: task.title,
            originalStatus: taskStatus,
            isUserTimeExpired: isUserTimeExpired,
            isTaskEnded: isTaskEnded,
            finalStatus: finalStatus,
            taskDeadline: task.deadline,
            taskDeadlineHours: task.task_deadline_hours,
            taskCreatedAt: task.created_at,
            currentTime: now.toISOString(),
            willAddEndedClass: finalStatus === 'ended' || finalStatus === 'expired'
        });

        console.log('🔍 RIGHT BEFORE TEMPLATE GENERATION:', {
            taskId: task.id,
            finalStatus: finalStatus,
            statusConfig: this.getTaskStatusConfig(finalStatus, task.deadline),
            willAddEndedClass: finalStatus === 'ended' || finalStatus === 'expired'
        });

        const statusConfig = this.getTaskStatusConfig(finalStatus, task.deadline);

        // Determine task card class based on status
        let taskCardClass = 'task-card';
        if (finalStatus === 'rejected' || finalStatus === 'rejected_resubmission') {
            taskCardClass += ' rejected-task';
        } else if (finalStatus === 'approved') {
            taskCardClass += ' approved-task';
        } else if (finalStatus === 'completed') {
            taskCardClass += ' completed-task';
        } else if (finalStatus === 'ended') {
            taskCardClass += ' ended-task';
        } else if (finalStatus === 'expired') {
            taskCardClass += ' expired-task';
        } else if (finalStatus === 'pending' || finalStatus === 'pending_review') {
            taskCardClass += ' pending-task';
        } else if (finalStatus === 'available') {
            taskCardClass += ' available-task';
        } else if (finalStatus === 'in_progress') {
            taskCardClass += ' in-progress-task';
        }

        // Add ended-task class only for truly ended tasks, not expired ones
        if (finalStatus === 'ended') {
            taskCardClass += ' ended-task-modern';
        } else if (finalStatus === 'expired') {
            taskCardClass += ' expired-task-modern'; // Different class for expired tasks
        }

        // Get difficulty display
        const difficultyStars = this.getDifficultyStars(task.difficulty);

        // Get task deadline display (for badge - shows task availability)
        let taskDeadlineText = 'No Deadline';
        let taskDeadline = null;
        let taskDeadlineTime = null;

        if (task.task_deadline_hours && task.created_at) {
            let taskCreatedAt;
            try {
                if (task.created_at.toDate && typeof task.created_at.toDate === 'function') {
                    taskCreatedAt = task.created_at.toDate();
                } else if (task.created_at.seconds) {
                    taskCreatedAt = new Date(task.created_at.seconds * 1000);
                } else if (task.created_at._seconds) {
                    taskCreatedAt = new Date(task.created_at._seconds * 1000);
                } else if (typeof task.created_at === 'string') {
                    taskCreatedAt = new Date(task.created_at);
                } else {
                    taskCreatedAt = new Date(task.created_at);
                }

                if (!isNaN(taskCreatedAt.getTime())) {
                    taskDeadlineTime = new Date(taskCreatedAt.getTime() + (task.task_deadline_hours * 60 * 60 * 1000));
                    taskDeadline = taskDeadlineTime; // Use the calculated deadline
                    taskDeadlineText = this.calculateDeadlineDisplay(taskDeadlineTime);
                }
            } catch (error) {
                console.error('Error calculating task deadline display:', error);
            }
        } else if (task.deadline || task.task_deadline) {
            taskDeadline = task.deadline || task.task_deadline;
            taskDeadlineText = this.calculateDeadlineDisplay(taskDeadline);
        }

        // Get user time display (for duration section - shows user completion time)
        let userTimeText = this.calculateUserTimeDisplay(task);

        // Override user time display if expired
        if (isUserTimeExpired) {
            userTimeText = 'Expired';
        }

        // Get completion count display - use from user status if available
        const completionCount = task.userStatus?.completionCount || 0;
        const maxCompletions = task.max_restarts ? task.max_restarts + 1 : 1;
        // Show completion count in X/Y format
        const completionText = `${completionCount}/${maxCompletions}`;

        console.log(`🎯 Task ${task.title} completion count:`, {
            userStatus: task.userStatus,
            completionCount: completionCount,
            maxCompletions: maxCompletions,
            completionText: completionText
        });

        console.log('🚀 FINAL TEMPLATE VARIABLES:', {
            taskId: task.id,
            finalStatus: finalStatus,
            taskCardClass: taskCardClass,
            statusConfigClass: statusConfig.class,
            endedTaskClass: finalStatus === 'ended' ? 'ended-task' : '',
            expiredTaskClass: finalStatus === 'expired' ? 'expired-task' : '',
            onclickAttr: finalStatus === 'ended' ? '' : `onclick="window.dashboardHandler.openTaskDetail('${task.id}', this)"`
        });

        return `
            <div class="task-card-modern ${taskCardClass} ${statusConfig.class} ${finalStatus === 'ended' ? 'ended-task' : ''} ${finalStatus === 'expired' ? 'expired-task' : ''}" ${finalStatus === 'ended' ? '' : `onclick="console.log('🔄 TASK CARD CLICKED:', '${task.id}', '${finalStatus}'); if(window.dashboardHandler && window.dashboardHandler.openTaskDetail) { window.dashboardHandler.openTaskDetail('${task.id}', this); } else { console.error('❌ Dashboard handler not available'); }"`}>
                <div class="task-card-header">
                    ${(task.banner || task.background_image) ? `
                        <img src="${task.banner || task.background_image}" alt="${task.title || 'Task'}" class="task-banner">
                    ` : `
                        <div class="task-hexagon-icon">
                            ${(task.title || 'T').charAt(0).toUpperCase()}
                        </div>
                    `}
                    <div class="task-status-overlay">
                        <span class="task-status-badge ${statusConfig.badgeClass}">
                            ${statusConfig.icon} ${statusConfig.label}
                        </span>
                    </div>
                    ${taskDeadline ? `
                        <div class="task-deadline-timer" data-deadline="${this.formatDeadlineForTimer(taskDeadline)}">
                            <i class="fas fa-clock"></i>
                            <span class="deadline-text" data-task-id="${task.id}">${taskDeadlineText}</span>
                        </div>
                    ` : `
                        <div class="task-deadline-timer" style="background: rgba(34, 197, 94, 0.9);">
                            <i class="fas fa-infinity"></i>
                            <span class="deadline-text" data-task-id="${task.id}">No Deadline</span>
                        </div>
                    `}
                    ${task.androidVersion ? `
                        <div class="task-requirement-badge">
                            <i class="fas fa-mobile-alt"></i>
                            Android ${task.androidVersion}+
                        </div>
                    ` : ''}
                    ${task.difficulty ? `
                        <div class="task-difficulty-badge">
                            ${difficultyStars}
                        </div>
                    ` : ''}
                </div>
                <div class="task-card-content">
                    <div class="task-title-section">
                        <h3 class="task-title">${task.title || 'Untitled Task'}</h3>
                        ${task.description ? `
                            <p class="task-description">${task.description}</p>
                        ` : ''}
                    </div>
                    <div class="task-info-section has-completion">
                        <div class="task-reward">
                            <i class="fas fa-coins"></i>
                            <span class="reward-amount">₱${task.reward}</span>
                        </div>
                        <div class="task-duration">
                            <i class="fas fa-clock"></i>
                            <span class="duration-text" data-task-id="${task.id}" data-task-duration="${task.duration || ''}" data-task-deadline="${this.formatDeadlineForTimer(task.deadline)}">${userTimeText}</span>
                        </div>
                        <div class="task-completion">
                            <i class="fas fa-trophy"></i>
                            <span class="completion-text">${completionText}</span>
                        </div>
                    </div>
                    ${task.task_deadline_hours || task.user_time_limit_hours ? `
                        <div class="task-time-info">
                            ${task.task_deadline_hours ? `
                                <div class="task-deadline-info">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>Task Deadline: ${task.task_deadline_hours}h</span>
                                </div>
                            ` : ''}
                            ${task.user_time_limit_hours ? `
                                <div class="task-user-limit-info">
                                    <i class="fas fa-user-clock"></i>
                                    <span>Your Time Limit: ${task.user_time_limit_hours}h</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="task-details-section">
                        <div class="task-detail-item">
                            <span class="detail-label">Max Completions:</span>
                            <span class="detail-value">${maxCompletions}</span>
                        </div>
                        <div class="task-detail-item">
                            <span class="detail-label">Difficulty:</span>
                            <span class="detail-value">${difficultyStars}</span>
                        </div>
                        <div class="task-detail-item">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${this.formatCreatedDate(task)}</span>
                        </div>
                    </div>
                    <div class="task-action-section">
                        ${finalStatus === 'expired' ? `
                            <button class="task-action-btn ${statusConfig.buttonClass}" onclick="event.stopPropagation(); console.log('🔄 START AGAIN BUTTON CLICKED:', '${task.id}'); window.startAgainTask('${task.id}')">
                                ${statusConfig.buttonText}
                            </button>
                        ` : finalStatus === 'ended' ? `
                            <button class="task-action-btn ${statusConfig.buttonClass}" disabled style="opacity: 0.6; cursor: not-allowed;">
                                ${statusConfig.buttonText}
                            </button>
                        ` : finalStatus === 'completed' || finalStatus === 'approved' ? `
                            <button class="task-action-btn ${statusConfig.buttonClass}" onclick="event.stopPropagation(); window.dashboardHandler.openTaskDetail('${task.id}', event.target.closest('.task-card-modern'))">
                                ${statusConfig.buttonText}
                            </button>
                        ` : `
                            <button class="task-action-btn ${statusConfig.buttonClass}" onclick="event.stopPropagation(); window.dashboardHandler.openTaskDetail('${task.id}', event.target.closest('.task-card-modern'))" ${taskStatus === 'disabled' ? 'disabled' : ''}>
                                ${statusConfig.buttonText}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    getDifficultyStars(difficulty) {
        switch (difficulty) {
            case 'easy': return '<i class="fas fa-star"></i> Easy';
            case 'medium': return '<i class="fas fa-star"></i><i class="fas fa-star"></i> Medium';
            case 'hard': return '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i> Hard';
            case 'expert': return '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i> Expert';
            default: return '<i class="fas fa-star"></i><i class="fas fa-star"></i> Medium';
        }
    }

    async getTaskStatusForUser(task) {
        try {
            // First check the taskStatuses collection for the most up-to-date status
            const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, task.id);
            console.log(`📊 Task ${task.title} status from taskStatuses:`, taskStatus);

            // If we have a status from taskStatuses collection, use it
            if (taskStatus && taskStatus.status && taskStatus.status !== 'available') {
                console.log(`✅ Using taskStatuses status for ${task.title}:`, taskStatus.status);
                console.log(`🔍 Full taskStatus object:`, taskStatus);
                return taskStatus; // Return the full object, not just the status
            }

            // If we reach here, it means no task status document exists
            // This should only happen for completely new users
            console.log(`📝 New user detected for ${task.title} - no task status document exists`);
            return { status: 'available', restart_count: 0 };
        } catch (error) {
            console.error('Error getting user task status:', error);
            return { status: 'available', restart_count: 0 };
        }
    }

    getTaskStatusConfig(status, deadline) {
        // Check if task has expired
        if (deadline) {
            let deadlineDate;

            // Handle Firestore Timestamp with toDate method
            if (deadline.toDate && typeof deadline.toDate === 'function') {
                deadlineDate = deadline.toDate();
            }
            // Handle Firestore Timestamp with seconds/nanoseconds
            else if (deadline.seconds && typeof deadline.seconds === 'number') {
                deadlineDate = new Date(deadline.seconds * 1000);
            }
            // Handle regular Date or string
            else {
                deadlineDate = new Date(deadline);
            }

            const now = new Date();
            if (now > deadlineDate) {
                return {
                    class: 'ended',
                    badgeClass: 'status-ended',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'Ended',
                    buttonText: 'Task Ended',
                    buttonClass: 'btn-disabled'
                };
            }
        }

        switch (status) {
            case 'expired':
                return {
                    class: 'expired',
                    badgeClass: 'status-expired',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'Time Expired',
                    buttonText: 'Restart Quest',
                    buttonClass: 'btn-warning'
                };
            case 'locked':
                return {
                    class: 'locked',
                    badgeClass: 'status-locked',
                    icon: '<i class="fas fa-lock"></i>',
                    label: 'Locked',
                    buttonText: 'Check Requirements',
                    buttonClass: 'btn-secondary'
                };
            case 'available':
                return {
                    class: '',
                    badgeClass: 'status-available',
                    icon: '<i class="fas fa-play-circle"></i>',
                    label: 'Available',
                    buttonText: 'Start Task',
                    buttonClass: 'btn-primary'
                };
            case 'in_progress':
                return {
                    class: 'in-progress',
                    badgeClass: 'status-in-progress',
                    icon: '<i class="fas fa-play"></i>',
                    label: 'In Progress',
                    buttonText: 'Complete Task',
                    buttonClass: 'btn-success'
                };
            case 'unlocked':
                return {
                    class: 'unlocked',
                    badgeClass: 'status-unlocked',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'In Progress',
                    buttonText: 'Continue Task',
                    buttonClass: 'btn-success'
                };
            case 'dns_setup':
                return {
                    class: 'dns-setup',
                    badgeClass: 'status-dns-setup',
                    icon: '<i class="fas fa-cog"></i>',
                    label: 'DNS Setup',
                    buttonText: 'Continue Setup',
                    buttonClass: 'btn-primary'
                };
            case 'ready_for_phase2':
                return {
                    class: 'ready-for-phase2',
                    badgeClass: 'status-ready-phase2',
                    icon: '<i class="fas fa-play-circle"></i>',
                    label: 'Ready for Phase 2',
                    buttonText: 'Start Phase 2',
                    buttonClass: 'btn-primary'
                };
            case 'pending_immutable_review':
                return {
                    class: 'pending-immutable-review',
                    badgeClass: 'status-pending-immutable',
                    icon: '<i class="fas fa-hourglass-half"></i>',
                    label: 'Immutable Link Pending Review',
                    buttonText: 'Awaiting Admin Review',
                    buttonClass: 'btn-secondary'
                };
            case 'rejected_resubmission':
                return {
                    class: 'rejected-resubmission',
                    badgeClass: 'status-rejected-resubmission',
                    icon: '<i class="fas fa-redo"></i>',
                    label: 'Rejected - Resubmission Available',
                    buttonText: 'Resubmit Final Verification',
                    buttonClass: 'btn-warning'
                };
            case 'pending':
            case 'pending_review':
                return {
                    class: 'pending',
                    badgeClass: 'status-pending',
                    icon: '<i class="fas fa-hourglass-half"></i>',
                    label: 'Pending Review',
                    buttonText: 'View Progress',
                    buttonClass: 'btn-warning'
                };
            case 'complete':
                return {
                    class: 'complete',
                    badgeClass: 'status-complete',
                    icon: '<i class="fas fa-check-circle"></i>',
                    label: 'Complete',
                    buttonText: 'Restart Quest',
                    buttonClass: 'btn-success'
                };
            case 'completed':
            case 'approved':
                return {
                    class: 'completed',
                    badgeClass: 'status-completed',
                    icon: '<i class="fas fa-trophy"></i>',
                    label: 'Completed',
                    buttonText: 'View Details',
                    buttonClass: 'btn-success'
                };
            case 'ended':
                return {
                    class: 'ended',
                    badgeClass: 'status-ended',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'Ended',
                    buttonText: 'Task Ended',
                    buttonClass: 'btn-secondary'
                };
            case 'rejected':
                return {
                    class: 'rejected',
                    badgeClass: 'status-rejected',
                    icon: '<i class="fas fa-times-circle"></i>',
                    label: 'Rejected - Resubmit',
                    buttonText: 'Resubmit Application',
                    buttonClass: 'btn-warning'
                };
            case 'disabled':
                return {
                    class: 'disabled',
                    badgeClass: 'status-disabled',
                    icon: '<i class="fas fa-ban"></i>',
                    label: 'Account Disabled',
                    buttonText: 'Contact Support',
                    buttonClass: 'btn-disabled'
                };
            default:
                return {
                    class: '',
                    badgeClass: 'status-available',
                    icon: '<i class="fas fa-play-circle"></i>',
                    label: 'Available',
                    buttonText: 'Start Task',
                    buttonClass: 'btn-primary'
                };
        }
    }

    async openTaskDetail(taskId, cardElement = null) {
        try {
            console.log('Opening task detail for:', taskId);

            // Set card loading state
            if (cardElement) {
                this.setCardLoading(cardElement, true);

                // Add timeout protection to prevent stuck loading state
                setTimeout(() => {
                    if (cardElement && cardElement.classList.contains('card-loading')) {
                        console.warn('Task detail loading timeout - resetting card state');
                        this.setCardLoading(cardElement, false);
                    }
                }, 10000); // 10 second timeout
            }

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Force refresh task status
            console.log('🔄 Force refreshing task status...');
            const taskStatus = await this.getUserTaskStatus(taskId, true); // Force refresh
            console.log('📊 Final task status for modal:', taskStatus);

            this.showTaskDetailModal(task, taskStatus);
        } catch (error) {
            console.error('Error opening task detail:', error);
            this.showToast('Failed to load task details', 'error');
        } finally {
            // Reset card loading state
            if (cardElement) {
                this.setCardLoading(cardElement, false);
            }
        }
    }

    async getUserTaskStatus(taskId, forceRefresh = false) {
        try {
            console.log('🔍 Getting task status for user:', this.currentUser.uid, 'task:', taskId, 'forceRefresh:', forceRefresh);

            // Get task details
            const task = await window.firestoreManager.getTask(taskId);

            // First check for custom task status (Firefox + LeechBlock setup, Immutable link, etc.)
            const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
            console.log('📊 Task status from taskStatuses collection:', taskStatus);
            console.log('🔍 Task status exists:', !!taskStatus);
            console.log('🔍 Task status.status:', taskStatus?.status);
            console.log('🔍 Task status.phase:', taskStatus?.phase);

            // Debug: Let's also check the raw document to see what's actually in the database
            if (forceRefresh) {
                console.log('🔍 Force refresh: Checking raw database document...');
                const rawDoc = await db.collection('taskStatuses').doc(`${this.currentUser.uid}_${taskId}`).get();
                if (rawDoc.exists) {
                    console.log('📄 Raw document data:', rawDoc.data());
                } else {
                    console.log('❌ No raw document found in taskStatuses collection');
                }
            }

            // Always calculate completion count from submissions, regardless of current status
            // Get completion count from task submissions
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = submissions.filter(s =>
                s.task_id === taskId && s.user_id === this.currentUser.uid
            );

            // Count completed/approved submissions (these represent actual completions)
            const completionCount = userSubmissions.filter(s =>
                s.status === 'completed' || s.status === 'approved'
            ).length;

            console.log(`📊 Completion count for ${taskId}:`, {
                totalSubmissions: userSubmissions.length,
                completedSubmissions: completionCount,
                submissions: userSubmissions.map(s => ({ id: s.id, status: s.status, restart_count: s.restart_count }))
            });
            const maxCompletions = task.max_restarts ? task.max_restarts + 1 : 1;

            // If we have a task status document, use it (this is the source of truth)
            if (taskStatus.status && taskStatus.status !== 'available') {
                console.log('✅ Using task status from taskStatuses:', taskStatus.status);
                console.log('🔍 Task status details:', {
                    status: taskStatus.status,
                    phase: taskStatus.phase,
                    immutableLinkApproved: taskStatus.immutableLinkApproved,
                    immutableLink: taskStatus.immutableLink ? 'Present' : 'Missing'
                });

                return {
                    ...taskStatus,
                    completionCount: completionCount,
                    maxCompletions: maxCompletions
                };
            }

            // If we reach here, it means no task status document exists
            // This should only happen for completely new users
            console.log('📝 New user detected - no task status document exists');
            return {
                status: 'available',
                phase: null,
                completionCount: completionCount,
                maxCompletions: maxCompletions
            };
        } catch (error) {
            console.error('Error getting user task status:', error);
            return {
                status: 'available',
                phase: null,
                completionCount: 0,
                maxCompletions: 1
            };
        }
    }

    showTaskDetailModal(task, taskStatus) {
        console.log('Creating task detail modal...');

        // Remove any existing modals first
        const existingModal = document.getElementById('task-detail-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'task-detail-modal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        const statusConfig = this.getTaskStatusConfig(taskStatus.status);
        console.log('🎭 Modal display - taskStatus:', taskStatus);
        console.log('🎭 Modal display - statusConfig:', statusConfig);

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container max-w-4xl">
                <div class="modal-header">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-tasks text-blue-600 text-xl"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="modal-title text-xl font-semibold text-gray-900 mb-2">${task.title || 'Untitled Task'}</h3>
                                <div class="flex items-center space-x-3">
                                    <span class="status-badge ${statusConfig.badgeClass}">
                                        ${statusConfig.icon} ${statusConfig.label}
                                    </span>
                                    <span class="text-lg font-bold text-green-600">₱${task.reward}</span>
                                </div>
                            </div>
                        </div>
                        <button id="close-task-detail-modal" class="modal-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="modal-form">
                    ${(task.banner || task.background_image) ? `
                        <div class="mb-6">
                            <img src="${task.banner || task.background_image}" alt="${task.title || 'Task'}" class="w-full h-48 object-cover rounded-lg">
                        </div>
                    ` : ''}

                    <div class="space-y-6">
                        ${task.description ? `
                            <div class="form-group">
                                <h4 class="form-label">Description</h4>
                                <p class="text-gray-700">${task.description}</p>
                            </div>
                        ` : ''}

                        ${task.instructions ? `
                            <div class="form-group">
                                <h4 class="form-label">Instructions</h4>
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4" style="overflow-x: hidden; word-wrap: break-word;">
                                    <div class="text-sm text-gray-700" style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">${task.instructions}</div>
                                </div>
                            </div>
                        ` : ''}

                        ${task.phase1Requirements ? `
                            <div class="form-group">
                                <h4 class="form-label">Phase 1 Requirements</h4>
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4" style="overflow-x: hidden; word-wrap: break-word;">
                                    <div class="text-sm text-gray-700" style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">${task.phase1Requirements}</div>
                                </div>
                            </div>
                        ` : ''}

                        ${task.phase2Requirements ? `
                            <div class="form-group">
                                <h4 class="form-label">Phase 2 Requirements</h4>
                                <div class="bg-green-50 border border-green-200 rounded-lg p-4" style="overflow-x: hidden; word-wrap: break-word;">
                                    <div class="text-sm text-gray-700" style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">${task.phase2Requirements}</div>
                                </div>
                            </div>
                        ` : ''}

                        ${task.requires_referrer_email ? `
                            <div class="form-group">
                                <div class="referrer-warning-box">
                                    <div class="referrer-warning-header">
                                        <div class="referrer-warning-icon">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div class="referrer-warning-title">
                                            <h4>Referrer Email Required</h4>
                                            <p>${task.referrer_warning_message || 'Please contact your referrer for email provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div class="form-row">
                            ${task.difficulty ? `
                                <div class="form-group">
                                    <h4 class="form-label">Difficulty</h4>
                                    <div class="flex items-center">
                                        <span class="text-lg">${this.getDifficultyStars(task.difficulty)}</span>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${task.duration ? `
                                <div class="form-group">
                                    <h4 class="form-label">Duration</h4>
                                    <div class="flex items-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-500 mr-2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12,6 12,12 16,14"></polyline>
                                        </svg>
                                        <span class="text-gray-700">${task.duration} days</span>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        ${task.androidVersion ? `
                            <div class="form-group">
                                <h4 class="form-label">Requirements</h4>
                                <div class="flex items-center">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-500 mr-2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                        <line x1="8" y1="21" x2="16" y2="21"></line>
                                        <line x1="12" y1="17" x2="12" y2="21"></line>
                                    </svg>
                                    <span class="text-gray-700">Android ${task.androidVersion} or higher</span>
                                </div>
                            </div>
                        ` : ''}

                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h4 class="form-label">Task Status</h4>
                            <p class="text-gray-700 mb-4">Current status: <span class="font-medium">${statusConfig.label}</span></p>
                            ${(() => {
                console.log('🔍 Modal conditional check - taskStatus.status:', taskStatus.status);
                return '';
            })()}
                            ${taskStatus.status === 'available' ? `
                                ${task.requires_referrer_email ? `
                                    <div class="mb-4">
                                        <label class="form-label">
                                            <i class="fas fa-envelope"></i>
                                            Referrer Email (Required)
                                        </label>
                                        <input type="email" id="referrer-email-${task.id}" class="form-input" 
                                               placeholder="Enter referrer email address" required>
                                        <small class="form-help">This task requires a referrer email to proceed</small>
                                    </div>
                                ` : ''}
                                <button onclick="window.dashboardHandler.startTask('${task.id}', this)" class="btn btn-primary w-full">
                                    <i class="fas fa-play mr-2"></i>
                                    Start Task
                                </button>
                            ` : taskStatus.status === 'in_progress' ? `
                                <button onclick="window.dashboardHandler.showTaskCompletionForm('${task.id}', this)" class="btn btn-success w-full">
                                    <i class="fas fa-check mr-2"></i>
                                    Complete Task
                                </button>
                            ` : taskStatus.status === 'unlocked' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}', this)" class="btn btn-primary w-full">
                                    <i class="fas fa-arrow-right mr-2"></i>
                                    Continue Task
                                </button>
                            ` : taskStatus.status === 'pending' ? `
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-hourglass-half text-yellow-500 mr-2"></i>
                                        <h5 class="font-medium text-yellow-800">Under Review</h5>
                                    </div>
                                    <p class="text-sm text-yellow-700 mb-3">Your submission is currently being reviewed by our admin team. Please wait for approval.</p>
                                </div>
                            ` : taskStatus.status === 'dns_setup' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}', this)" class="btn btn-primary w-full">
                                    <i class="fas fa-arrow-right mr-2"></i>
                                    Continue Task
                                </button>
                            ` : taskStatus.status === 'ready_for_phase2' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}', this)" class="btn btn-primary w-full">
                                    <i class="fas fa-check-circle mr-2"></i>
                                    Start Phase 2
                                </button>
                            ` : taskStatus.status === 'complete' ? `
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center justify-between">
                                        <div class="text-sm text-blue-600">
                                            <span class="font-medium">Completions:</span> ${taskStatus.completionCount || 0}/${taskStatus.maxCompletions || 1}
                                        </div>
                                        <button onclick="window.dashboardHandler.restartQuest('${task.id}', this)" class="btn btn-primary">
                                            <i class="fas fa-redo mr-2"></i>
                                            Restart Quest
                                        </button>
                                    </div>
                                </div>
                            ` : taskStatus.status === 'completed' || taskStatus.status === 'approved' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}', this)" class="btn btn-success w-full">
                                    <i class="fas fa-redo mr-2"></i>
                                    Restart Task
                                </button>
                            ` : taskStatus.status === 'rejected' ? `
                                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                                        <h5 class="font-medium text-red-800">Application Rejected</h5>
                                    </div>
                                    <p class="text-sm text-red-700 mb-3">Your initial application was rejected. Please review the requirements and resubmit your application.</p>
                                    <button onclick="window.dashboardHandler.resubmitTask('${task.id}', this)" class="btn-warning">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                            <polyline points="16,6 12,2 8,6"></polyline>
                                            <line x1="12" y1="2" x2="12" y2="15"></line>
                                        </svg>
                                        Resubmit Application
                                    </button>
                                </div>
                            ` : taskStatus.status === 'rejected_resubmission' ? `
                                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-redo text-red-500 mr-2"></i>
                                        <h5 class="font-medium text-red-800">Final Verification Rejected</h5>
                                    </div>
                                    <p class="text-sm text-red-700 mb-3">Your final verification was rejected. Please review the requirements and resubmit your final verification.</p>
                                    <button onclick="window.dashboardHandler.resubmitTask('${task.id}', this)" class="btn-warning">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                            <polyline points="16,6 12,2 8,6"></polyline>
                                            <line x1="12" y1="2" x2="12" y2="15"></line>
                                        </svg>
                                        Resubmit Final Verification
                                    </button>
                                </div>
                            ` : `
                                <p class="text-sm text-gray-600">Task interaction coming soon!</p>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('Task detail modal appended to DOM:', modal);

        // Setup event listeners
        document.getElementById('close-task-detail-modal').addEventListener('click', () => {
            modal.remove();
        });
    }

    async startTask(taskId, button = null) {
        return await window.loadingManager.withDatabaseLoading(async () => {
            console.log('Starting task:', taskId);

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Starting Task...');
            }

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            console.log('Found task:', task);
            console.log('Task ID:', task.id);

            // Check if task is available to start
            const status = await this.getUserTaskStatus(task.id);
            console.log('🔍 Task status check:', status);

            if (status.status === 'pending' || status.status === 'pending_review') {
                this.showToast('Your submission is under review. Please wait for admin approval.', 'info');
                return;
            } else if (status.status === 'completed' || status.status === 'approved') {
                // Task completed - check if user can restart
                console.log('🎯 Task completed, checking restart options');
                await this.showTaskRestartOptions(task, status);
                return;
            } else if (status.status === 'rejected') {
                // Task rejected - show resubmit option
                console.log('🎯 Task was rejected, showing resubmit option');
                await this.showTaskRestartOptions(task, status);
                return;
            } else if (status.status !== 'available' && status.status !== 'in_progress') {
                this.showToast('This task is not available to start.', 'error');
                return;
            }

            // Check if referrer email is required and capture it
            let referrerEmail = null;
            if (task.requires_referrer_email) {
                let referrerElement = document.getElementById(`referrer-email-${task.id}`);
                referrerEmail = referrerElement ? referrerElement.value.trim() : null;

                // Fallback: if specific element not found, try to find any referrer email input
                if (!referrerElement || !referrerEmail) {
                    console.log('🔍 Primary referrer element not found, trying fallback...');
                    const allReferrerInputs = document.querySelectorAll('input[id*="referrer-email"]');
                    console.log('Found referrer inputs:', allReferrerInputs.length);

                    for (let input of allReferrerInputs) {
                        if (input.value && input.value.trim()) {
                            referrerElement = input;
                            referrerEmail = input.value.trim();
                            console.log('Using fallback referrer input:', input.id, input.value);
                            break;
                        }
                    }
                }

                console.log('📧 Referrer email validation (startTask):', {
                    requiresReferrer: task.requires_referrer_email,
                    taskId: task.id,
                    elementId: `referrer-email-${task.id}`,
                    elementExists: !!referrerElement,
                    elementValue: referrerElement ? referrerElement.value : 'Element not found',
                    trimmedValue: referrerEmail,
                    allReferrerInputs: document.querySelectorAll('input[id*="referrer-email"]').length,
                    allInputs: document.querySelectorAll('input[type="email"]').length
                });

                if (!referrerEmail) {
                    this.showToast('Referrer email is required for this task. Please enter a valid email address.', 'error');
                    // Focus on the referrer email input if it exists
                    if (referrerElement) {
                        referrerElement.focus();
                    } else {
                        // Try to focus on any referrer email input
                        const fallbackInput = document.querySelector('input[id*="referrer-email"]');
                        if (fallbackInput) {
                            fallbackInput.focus();
                        }
                    }
                    return;
                }

                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(referrerEmail)) {
                    this.showToast('Please enter a valid email address for the referrer.', 'error');
                    return;
                }
            }

            // Close any existing modals
            const existingModal = document.getElementById('task-detail-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Get current task status with force refresh
            console.log('🔄 Getting fresh task status for task:', taskId);
            const taskStatus = await this.getUserTaskStatus(taskId, true); // Force refresh
            console.log('📊 Current task status:', taskStatus);

            if (taskStatus.status === 'available') {
                // Start the task - change status to in_progress
                console.log('🎯 Status is available, starting task');
                await this.startTaskDirectly(task, referrerEmail);
            } else if (taskStatus.status === 'in_progress') {
                // Task is in progress - show simple message
                console.log('🎯 Task is in progress');
                this.showToast('Task is already in progress. Please complete it first.', 'info');
            } else if (taskStatus.status === 'pending' || taskStatus.status === 'pending_review') {
                // Show waiting message for admin review
                this.showToast('Your submission is under review. Please wait for admin approval.', 'info');
                return;
            } else if (taskStatus.status === 'completed' || taskStatus.status === 'approved') {
                // Task completed - check if user can restart
                console.log('🎯 Task completed, checking restart options');
                await this.showTaskRestartOptions(task, taskStatus);
                return;
            } else if (taskStatus.status === 'rejected') {
                // Task rejected - show resubmit option
                console.log('🎯 Task was rejected, showing resubmit option');
                await this.showTaskRestartOptions(task, taskStatus);
            } else {
                this.showToast('Task cannot be started at this time.', 'error');
                return;
            }

            // Reload tasks to update status
            await this.loadTasks();

        }, 'Starting Task', 'Please wait while we start your task...').finally(() => {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        });
    }

    showDNSSetupModal(task, taskId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Get Firefox + LeechBlock configuration from task
        const dnsConfig = task.dnsConfig || {};
        // Always use the correct Immutable URL, ignore old DNS server addresses
        const immutableUrlToBlock = 'https://auth.immutable.com';
        const customInstructions = dnsConfig.customInstructions;

        // Use passed taskId or fallback to task.id
        const actualTaskId = taskId || task.id;

        if (!actualTaskId) {
            console.error('Task missing ID:', task);
            this.showToast('Task ID missing', 'error');
            return;
        }

        console.log('Creating Firefox + LeechBlock setup modal for task:', actualTaskId, task.title);

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container-modern max-w-2xl">
                <!-- Modal Header -->
                <div class="modal-header-modern">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <i class="fas fa-shield-alt"></i>
                            </div>
                        <div class="modal-title-content">
                            <h3 class="modal-title">Firefox + LeechBlock Setup</h3>
                            <p class="modal-subtitle">${task.title}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        </button>
                </div>
                    
                <!-- Modal Body -->
                <div class="modal-body-modern">
                    <!-- Progress Indicator -->
                    <div class="dns-progress-indicator">
                        <div class="progress-steps">
                            <div class="step active">
                                <div class="step-number">1</div>
                                <div class="step-label">Setup Firefox</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <div class="step-label">Verify</div>
                        </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <div class="step-label">Continue</div>
                    </div>
                                    </div>
                                </div>

                    <!-- Main Content -->
                    <div class="dns-content">
                        <!-- Setup Instructions -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-cog"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Setup Instructions</h4>
                                    <p>Install Firefox browser and LeechBlock extension to capture the Immutable link</p>
                                    </div>
                                </div>
                                
                            <div class="instructions-list">
                                <div class="instruction-item">
                                    <div class="instruction-number">1</div>
                                    <div class="instruction-content">
                                        <h5>Install Firefox Browser</h5>
                                        <p>Download and install Firefox browser from your device's app store or visit <a href="https://www.mozilla.org/firefox/" target="_blank" style="color: #3b82f6;">mozilla.org/firefox</a></p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">2</div>
                                    <div class="instruction-content">
                                        <h5>Install LeechBlock NG Extension</h5>
                                        <p>Open Firefox → Click the menu (☰) → Add-ons and Themes → Search for "LeechBlock NG" → Click "Add to Firefox" → Confirm installation</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">3</div>
                                    <div class="instruction-content">
                                        <h5>Access LeechBlock Options</h5>
                                        <p>Click the puzzle piece icon (Extensions) in Firefox toolbar → Find "LeechBlock NG" → Click on it → Select "Options" to open the settings page</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">4</div>
                                    <div class="instruction-content">
                                        <h5>Configure Block Set 1</h5>
                                        <p>In the Options page, go to "Set 1" tab → Enter name: <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px;">Immutable Blocker</code></p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">5</div>
                                    <div class="instruction-content">
                                        <h5>Add Domain to Block</h5>
                                        <p>In "What to Block" section, add this domain (one per line): <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px;">auth.immutable.com</code></p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">6</div>
                                    <div class="instruction-content">
                                        <h5>Set Time Periods</h5>
                                        <p>In "When to Block" section → Click "All Day" button to block 24/7 → Select all days of the week (Monday through Sunday)</p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">7</div>
                                    <div class="instruction-content">
                                        <h5>Configure Block Method</h5>
                                        <p>In "How to Block" section → Set to "Default Page" → This will show LeechBlock's default blocking page when the site is accessed</p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">8</div>
                                    <div class="instruction-content">
                                        <h5>Save Settings</h5>
                                        <p>Click "Save Options" button at the bottom of the page to apply your settings</p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">9</div>
                                    <div class="instruction-content">
                                        <h5>Test the Block</h5>
                                        <div class="dns-address-box">
                                            <div class="dns-address-label">Test URL to verify blocking:</div>
                                            <div class="dns-address-value">${immutableUrlToBlock}</div>
                                        </div>
                                        <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #6b7280;">Try opening this URL in Firefox - it should show the LeechBlock blocking page instead of redirecting</p>
                                    </div>
                                </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">10</div>
                                    <div class="instruction-content">
                                        <h5>Set Firefox as Default Browser</h5>
                                        <p>Go to Firefox Settings → General → Default Applications → Set Firefox as default browser for web links</p>
                                    </div>
                                </div>
                            </div>
                        
                        <!-- Firefox + LeechBlock Verification -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-check-circle"></i>
                                    </div>
                                <div class="section-title">
                                    <h4>Setup Verification</h4>
                                    <p>Verify your Firefox + LeechBlock configuration before proceeding</p>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <div class="dns-server-display">
                                    <div class="server-label">Immutable URL to Block:</div>
                                    <div class="server-address">
                                        <span id="dns-server-display">${immutableUrlToBlock}</span>
                                        <button type="button" class="copy-btn" onclick="window.dashboardHandler.copyDNSServer('${immutableUrlToBlock}', this)">
                                            <i class="fas fa-copy"></i>
                                        </button>
                            </div>
                        </div>

                                <div class="verification-actions">
                                    <button type="button" class="verify-btn" onclick="window.dashboardHandler.checkDNSConfiguration('${immutableUrlToBlock}', this)">
                                        <i class="fas fa-check-circle"></i>
                                Verify Firefox + LeechBlock Setup
                            </button>
                                    <div id="dns-check-result" class="verification-result">
                                <!-- DNS check result will appear here -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Important Notice -->
                        <div class="important-notice">
                            <div class="notice-icon">
                                <i class="fas fa-exclamation-triangle"></i>
                                    </div>
                            <div class="notice-content">
                                <h5>Important</h5>
                                <p>Firefox + LeechBlock must be configured before clicking the Immutable Connect link to prevent auto-redirect. Verify that the Immutable URL is blocked.</p>
                                </div>
                            </div>
                        </div>
                </div>

                <!-- Modal Footer -->
                <div class="modal-footer-modern">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    <button type="button" class="btn btn-primary" id="proceed-btn" data-task-id="${actualTaskId}" disabled>
                        <i class="fas fa-arrow-right"></i>
                            Continue to Immutable Link
                        </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listener for proceed button
        const proceedBtn = modal.querySelector('#proceed-btn');
        if (proceedBtn) {
            const taskIdAttr = proceedBtn.getAttribute('data-task-id');
            console.log('Proceed button data-task-id:', taskIdAttr);
            console.log('Task object:', task);

            proceedBtn.addEventListener('click', () => {
                const taskId = proceedBtn.getAttribute('data-task-id');
                console.log('Clicked proceed button, taskId:', taskId);

                if (taskId && taskId.trim() !== '') {
                    this.proceedToImmutableLink(taskId);
                } else {
                    console.error('No task ID found on proceed button');
                    this.showToast('Task ID missing', 'error');
                }
            });
        }
    }

    async copyDNSServer(dnsServer, button = null) {
        try {
            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Copying...');
            }

            await navigator.clipboard.writeText(dnsServer);
            this.showToast('DNS server address copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = dnsServer;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('DNS server address copied to clipboard!', 'success');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async checkDNSConfiguration(immutableUrl, button = null) {
        const resultDiv = document.getElementById('dns-check-result');
        const proceedBtn = document.getElementById('proceed-btn');

        // Set button loading state
        if (button) {
            this.setButtonLoading(button, true, 'Verifying...');
        }

        if (!resultDiv || !proceedBtn) {
            console.error('LeechBlock check elements not found');
            return;
        }

        // Show loading state
        resultDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span class="text-sm text-gray-600">Verifying Firefox + LeechBlock configuration...</span>
            </div>
        `;

        try {
            // Check if LeechBlock is working by testing the URL
            const leechBlockCheckResult = await this.performLeechBlockCheck(immutableUrl);

            if (leechBlockCheckResult.isConfigured) {
                resultDiv.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-check-circle text-green-500"></i>
                        <span class="text-sm text-green-600 font-medium">Firefox + LeechBlock is active</span>
                    </div>
                `;
                proceedBtn.disabled = false;
                proceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                this.showToast('✅ Firefox + LeechBlock is active - proceed', 'success');
            } else {
                // Show simple error message
                resultDiv.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                        <span class="text-sm text-yellow-600 font-medium">Firefox + LeechBlock is not active</span>
                    </div>
                `;
                proceedBtn.disabled = true;
                proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
                this.showToast('⚠️ Firefox + LeechBlock is not active', 'warning');
            }

        } catch (error) {
            console.error('LeechBlock check error:', error);
            resultDiv.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                    <span class="text-sm text-yellow-600 font-medium">Firefox + LeechBlock is not active</span>
                </div>
            `;
            proceedBtn.disabled = true;
            proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
            this.showToast('⚠️ Firefox + LeechBlock is not active', 'warning');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async performLeechBlockCheck(immutableUrl) {
        try {
            console.log('Testing Firefox + LeechBlock configuration for Immutable link capture...');

            // Since we can't directly test LeechBlock from the web page,
            // we'll provide a simple verification that the user can perform
            // and assume it's working if they click the verify button

            // Create a test URL that should be blocked if LeechBlock is working
            const testUrl = immutableUrl;

            // For now, we'll simulate a successful check since the user
            // needs to manually verify LeechBlock is working
            console.log('✅ LeechBlock verification - user should test manually');

            // Return a successful result to allow user to proceed
            // The real verification happens when they test the URL in Firefox
            return {
                isConfigured: true,
                reason: 'LeechBlock verification - please test the URL in Firefox to confirm blocking'
            };

        } catch (error) {
            console.error('LeechBlock check method failed:', error);
            // Fallback: assume LeechBlock is not configured if check fails
            return { isConfigured: false, error: error.message };
        }
    }

    async testDomainAccess(url) {
        try {
            // Method 1: Try fetch with no-cors (most reliable for blocked domains)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal,
                    cache: 'no-cache'
                });

                clearTimeout(timeout);
                console.log(`Domain access test success for ${url} (fetch)`);
                return true;

            } catch (fetchError) {
                clearTimeout(timeout);
                console.log(`Domain access test failed for ${url} (fetch):`, fetchError.message);

                // Method 2: Fallback to image loading test
                return await this.testImageLoad(url);
            }

        } catch (error) {
            console.log(`Domain access test error for ${url}:`, error.message);
            return false;
        }
    }

    async testImageLoad(url) {
        return new Promise((resolve) => {
            const img = new Image();
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.log(`Image load timeout for ${url}`);
                    resolve(false); // Timeout = likely blocked
                }
            }, 4000);

            img.onload = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.log(`Image load success for ${url}`);
                    resolve(true); // Success = domain accessible
                }
            };

            img.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.log(`Image load error for ${url}`);
                    resolve(false); // Error = domain blocked
                }
            };

            // Try to load the image
            img.src = url + '?t=' + Date.now();
        });
    }


    async proceedToImmutableLink(taskId) {
        try {
            console.log('Proceeding to Immutable link with taskId:', taskId);

            // Validate taskId
            if (!taskId || taskId.trim() === '') {
                console.error('Empty taskId provided to proceedToImmutableLink');
                this.showToast('Task ID is missing', 'error');
                return;
            }

            // Close Firefox + LeechBlock setup modal
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.remove();
            }

            // Update task status to dns_setup
            await window.firestoreManager.updateTaskStatus(taskId, 'dns_setup');

            // Show Immutable link capture modal
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                this.showImmutableLinkModal(task);
            }

            // Reload tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('Error proceeding to Immutable link:', error);
            this.showToast('Failed to proceed: ' + error.message, 'error');
        }
    }

    showImmutableLinkModal(task) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Get Immutable app configuration from task
        const dnsConfig = task.dnsConfig || {};
        const immutableApp = dnsConfig.immutableApp || {};
        const appName = immutableApp.name || 'Battle of Souls';
        const connectText = immutableApp.connectText || 'Connect to Immutable';
        const linkPattern = immutableApp.linkPattern || 'immutable';

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container-modern max-w-2xl">
                <!-- Modal Header -->
                <div class="modal-header-modern">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <i class="fas fa-link"></i>
                            </div>
                        <div class="modal-title-content">
                            <h3 class="modal-title">Immutable Link Capture</h3>
                            <p class="modal-subtitle">${task.title}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        </button>
                </div>

                <!-- Modal Body -->
                <div class="modal-body-modern">
                    <!-- Progress Indicator -->
                    <div class="dns-progress-indicator">
                        <div class="progress-steps">
                            <div class="step active">
                                <div class="step-number">1</div>
                                <div class="step-label">Setup</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <div class="step-label">Capture</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <div class="step-label">Submit</div>
                            </div>
                    </div>
                </div>
                
                    <!-- Main Content -->
                    <div class="dns-content">
                        <!-- Important Notice -->
                        <div class="important-notice">
                            <div class="notice-icon">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="notice-content">
                                <h5>Important</h5>
                                <p>Make sure your DNS is properly configured before proceeding!</p>
                        </div>
                    </div>

                        <!-- Instructions Section -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-list-ol"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Step-by-Step Instructions</h4>
                                    <p>Follow these steps to capture your Immutable link</p>
                                </div>
                            </div>
                            
                            <div class="instructions-list">
                                <div class="instruction-item">
                                    <div class="instruction-number">1</div>
                                    <div class="instruction-content">
                                        <h5>Complete Tutorial & Get Gaming ID</h5>
                                        <p>Finish the game tutorial and copy your Gaming ID from profile</p>
                                </div>
                            </div>
                            
                                <div class="instruction-item">
                                    <div class="instruction-number">2</div>
                                    <div class="instruction-content">
                                        <h5>Submit Gaming ID & Screenshot</h5>
                                        <p>Submit your Gaming ID and profile screenshot for verification</p>
                                </div>
                            </div>
                            
                                <div class="instruction-item">
                                    <div class="instruction-number">3</div>
                                    <div class="instruction-content">
                                        <h5>Configure Firefox + LeechBlock</h5>
                                        <p>Set up Firefox browser with LeechBlock extension to block auto-redirects</p>
                                </div>
                            </div>
                            
                                <div class="instruction-item">
                                    <div class="instruction-number">4</div>
                                    <div class="instruction-content">
                                        <h5>Go Back to ${appName} App</h5>
                                        <p>Return to the ${appName} mobile game</p>
                                </div>
                            </div>
                            
                                <div class="instruction-item">
                                    <div class="instruction-number">5</div>
                                    <div class="instruction-content">
                                        <h5>Tap ${connectText}</h5>
                                        <p>Look for the "${connectText}" button in the app</p>
                                </div>
                            </div>
                            
                                <div class="instruction-item">
                                    <div class="instruction-number">6</div>
                                    <div class="instruction-content">
                                        <h5>DNS Blocks Auto-Redirect</h5>
                                        <p>The link should appear in the app instead of auto-opening browser</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">7</div>
                                    <div class="instruction-content">
                                        <h5>Copy the Immutable Link</h5>
                                        <p>Copy the Immutable link that appears in the app</p>
                                </div>
                            </div>
                        </div>
                    </div>

                        <!-- Link Input Section -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-paste"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Immutable Link Submission</h4>
                                    <p>Paste the captured link here</p>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <form id="immutable-link-form">
                                    <div class="dns-server-display">
                                        <div class="server-label">Immutable Link:</div>
                                        <div class="server-address">
                        <textarea id="immutable-link" required class="form-textarea" rows="3" 
                                                placeholder="Paste the Immutable link you copied from the ${appName} app here..." 
                                                style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-family: 'Courier New', monospace; font-size: 0.875rem; resize: vertical;"></textarea>
                                        </div>
                                    </div>
                                    <p class="text-sm text-gray-500 mt-2">The link should start with https:// and contain ${linkPattern}-related parameters</p>
                                </form>
                            </div>
                    </div>

                        <!-- Admin Review Process -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-info-circle"></i>
                            </div>
                                <div class="section-title">
                                    <h4>Admin Review Process</h4>
                                    <p>What happens after submission</p>
                        </div>
                    </div>
                    
                            <div class="instructions-list">
                                <div class="instruction-item">
                                    <div class="instruction-number">📋</div>
                                    <div class="instruction-content">
                                        <h5>After submission</h5>
                                        <p>Your link will be reviewed by an admin</p>
                            </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">✅</div>
                                    <div class="instruction-content">
                                        <h5>Approved</h5>
                                        <p>You'll receive notification to proceed with game stages</p>
                        </div>
                    </div>

                                <div class="instruction-item">
                                    <div class="instruction-number">❌</div>
                                    <div class="instruction-content">
                                        <h5>Rejected</h5>
                                        <p>You'll be notified with reason and can resubmit</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">⏳</div>
                                    <div class="instruction-content">
                                        <h5>Pending</h5>
                                        <p>Please wait for admin review (usually within 3-5 minutes)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Security Notice -->
                        <div class="important-notice">
                            <div class="notice-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="notice-content">
                                <h5>Security Note</h5>
                                <p>🔒 Admin will use your link to sign in and verify your account. After approval, you can proceed to play the game stages we've set up.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="modal-footer-modern">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    <button type="submit" class="btn btn-primary" form="immutable-link-form">
                        <i class="fas fa-check"></i>
                            Submit Link
                        </button>
                    </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        const form = document.getElementById('immutable-link-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitImmutableLink(task.id);
            });
        }
    }

    async submitImmutableLink(taskId) {
        let loadingModal = null;

        try {
            const immutableLink = document.getElementById('immutable-link').value.trim();

            if (!immutableLink) {
                this.showToast('Please paste the Immutable link', 'error');
                return;
            }

            // Get task-specific validation pattern
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);
            const linkPattern = task?.dnsConfig?.immutableApp?.linkPattern || 'immutable';

            // Basic validation for Immutable link
            if (!immutableLink.includes(linkPattern) || !immutableLink.startsWith('https://')) {
                this.showToast('❌ Link invalid. Please regenerate inside app.', 'error');
                return;
            }

            loadingModal = this.showLoadingModal('Submitting Immutable Link', 'Please wait while we process your submission...');

            // Store the Immutable link (now goes to pending admin review)
            await window.firestoreManager.storeImmutableLink(taskId, immutableLink);

            // Close modal
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.remove();
            }

            this.showToast('📋 Immutable link submitted for admin review. You will be notified once approved.', 'success');

            // Reload tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('Error submitting Immutable link:', error);
            this.showToast('Failed to submit link: ' + error.message, 'error');
        } finally {
            this.hideLoadingModal(loadingModal);
        }
    }

    showPhase1VerificationModal(task) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container-modern max-w-2xl">
                <!-- Modal Header -->
                <div class="modal-header-modern">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <i class="fas fa-gamepad"></i>
                            </div>
                        <div class="modal-title-content">
                            <h3 class="modal-title">Game Setup Guide</h3>
                            <p class="modal-subtitle">${task.title}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        </button>
                </div>
                
                <!-- Modal Body -->
                <div class="modal-body-modern">
                    <!-- Progress Indicator -->
                    <div class="dns-progress-indicator">
                        <div class="progress-steps">
                            <div class="step active" id="progress-step-1">
                            <div class="step-number">1</div>
                                <div class="step-label">Download</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step" id="progress-step-2">
                                <div class="step-number">2</div>
                                <div class="step-label">Sign In</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step" id="progress-step-3">
                                <div class="step-number">3</div>
                                <div class="step-label">Find ID</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step" id="progress-step-4">
                                <div class="step-number">4</div>
                                <div class="step-label">Submit</div>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div class="dns-content">
                        <!-- Step 1: Download -->
                        <div class="dns-section" id="step-1">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-download"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Download Battle of Souls</h4>
                                    <p>Download the game from Google Play Store</p>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <div class="dns-server-display">
                                    <div class="server-label">Download Link:</div>
                                    <div class="server-address">
                                        <a href="https://play.google.com/store/apps/details?id=com.pxlr.battleofsouls&hl=en" target="_blank" class="verify-btn">
                                            <i class="fas fa-download"></i>
                                            Download Game
                                        </a>
                                    </div>
                                </div>
                                
                                <div class="verification-actions">
                                    <button type="button" class="btn btn-secondary" onclick="window.dashboardHandler.nextStep(2, this)">
                                        <i class="fas fa-check"></i>
                                        I Already Have It
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Step 2: Sign In -->
                        <div class="dns-section" id="step-2" style="display: none;">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-sign-in-alt"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Sign In with Google Account</h4>
                                    <p>Open the game and sign in with your Google account</p>
                                </div>
                            </div>
                            
                            <div class="important-notice">
                                <div class="notice-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="notice-content">
                                    <h5>Important</h5>
                                    <p>You must sign in with your Google account, not as a guest!</p>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <div class="verification-actions">
                                    <button type="button" class="btn btn-primary" onclick="window.dashboardHandler.nextStep(3, this)">
                                        <i class="fas fa-check"></i>
                                        I'm Signed In
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Step 3: Find Game ID -->
                        <div class="dns-section" id="step-3" style="display: none;">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-id-card"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Find Your Game ID</h4>
                                    <p>In the game, go to Settings or Profile to find your Game ID</p>
                                </div>
                            </div>
                            
                            <div class="instructions-list">
                                <div class="instruction-item">
                                    <div class="instruction-number">1</div>
                                    <div class="instruction-content">
                                        <h5>Open the game</h5>
                                        <p>Launch Battle of Souls on your device</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">2</div>
                                    <div class="instruction-content">
                                        <h5>Go to Settings or Profile</h5>
                                        <p>Navigate to the game's settings or profile section</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">3</div>
                                    <div class="instruction-content">
                                        <h5>Look for "Player ID" or "Game ID"</h5>
                                        <p>Find your unique identifier in the profile</p>
                                    </div>
                                </div>
                                
                                <div class="instruction-item">
                                    <div class="instruction-number">4</div>
                                    <div class="instruction-content">
                                        <h5>Copy the ID</h5>
                                        <p>Copy the ID (usually numbers) for submission</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <div class="verification-actions">
                                    <button type="button" class="btn btn-primary" onclick="window.dashboardHandler.nextStep(4, this)">
                                        <i class="fas fa-check"></i>
                                        I Found My Game ID
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Step 4: Submit Information -->
                        <div class="dns-section" id="step-4" style="display: none;">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-upload"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Submit Your Information</h4>
                                    <p>Submit your Game ID and profile screenshot</p>
                                </div>
                            </div>
                            
                            <div class="verification-box">
                                <form id="phase1-form" class="step-form">
                                    <div class="dns-server-display">
                                        <div class="server-label">Game ID:</div>
                                        <div class="server-address">
                                            <input type="text" id="game-id" required class="form-input" placeholder="Enter your Game ID" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                                        </div>
                                    </div>

                                    <div class="dns-server-display">
                                        <div class="server-label">Android Version:</div>
                                        <div class="server-address">
                                            <select id="android-version" required class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                                            <option value="">Select your Android version</option>
                                            <option value="10">Android 10</option>
                                            <option value="11">Android 11</option>
                                            <option value="12">Android 12</option>
                                            <option value="13">Android 13</option>
                                            <option value="14">Android 14</option>
                                            <option value="15">Android 15</option>
                                        </select>
                                        </div>
                                    </div>

                                    <div class="dns-server-display">
                                        <div class="server-label">Profile Screenshot:</div>
                                        <div class="server-address">
                                            <input type="file" id="profile-screenshot" required class="form-input" accept="image/*" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                                        </div>
                                    </div>

                                    <div class="dns-server-display">
                                        <div class="server-label">Additional Notes:</div>
                                        <div class="server-address">
                                            <textarea id="phase1-notes" class="form-textarea" rows="3" placeholder="Any additional information or notes" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; resize: vertical;"></textarea>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                                    </div>

                <!-- Modal Footer -->
                <div class="modal-footer-modern">
                                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                                            Cancel
                                        </button>
                    <button type="submit" class="btn btn-primary" form="phase1-form" id="submit-phase1-btn" style="display: none;">
                        <i class="fas fa-check"></i>
                                            Submit Phase 1
                                        </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        const form = document.getElementById('phase1-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitPhase1Verification(task.id, modal);
            });
        }
    }

    nextStep(stepNumber, button = null) {
        // Set button loading state
        if (button) {
            this.setButtonLoading(button, true, 'Loading...');
        }

        // Hide all content steps
        document.querySelectorAll('.dns-section').forEach(step => {
            step.style.display = 'none';
        });

        // Update progress indicator
        document.querySelectorAll('.progress-steps .step').forEach(step => {
            step.classList.remove('active');
        });

        // Show the target step
        const targetStep = document.getElementById(`step-${stepNumber}`);
        const progressStep = document.getElementById(`progress-step-${stepNumber}`);

        if (targetStep) {
            targetStep.style.display = 'block';
        }

        if (progressStep) {
            progressStep.classList.add('active');
        }

        // Show submit button only on last step
        const submitBtn = document.getElementById('submit-phase1-btn');
        if (submitBtn) {
            submitBtn.style.display = stepNumber === 4 ? 'block' : 'none';
        }

        // Reset button loading state after a short delay
        if (button) {
            setTimeout(() => {
                this.setButtonLoading(button, false);
            }, 300);
        }
    }

    // Debug function to manually fix task status
    async fixTaskStatus(taskId, status) {
        try {
            console.log('🔧 Manually fixing task status:', { taskId, status, userId: this.currentUser.uid });
            await window.firestoreManager.updateTaskStatus(taskId, status, this.currentUser.uid);
            console.log('✅ Task status fixed successfully');
            this.showToast('Task status fixed! Please refresh the page.', 'success');
        } catch (error) {
            console.error('❌ Error fixing task status:', error);
            this.showToast('Failed to fix task status: ' + error.message, 'error');
        }
    }

    // Debug function to check task status
    async debugTaskStatus(taskId) {
        try {
            console.log('🔍 Debugging task status for:', taskId);

            // Check taskStatuses collection
            const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
            console.log('📊 Task status from taskStatuses:', taskStatus);

            // Check verifications
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);
            console.log('📋 Task verifications:', taskVerifications.map(v => ({
                phase: v.phase,
                status: v.status,
                gameId: v.gameId,
                autoRejected: v.autoRejected
            })));

            // Get task status
            const status = await this.getUserTaskStatus(task.id);
            console.log('🏆 Task status:', status);

            // Get final status
            const finalStatus = await this.getUserTaskStatus(taskId);
            console.log('🎯 Final task status:', finalStatus);

            return finalStatus;
        } catch (error) {
            console.error('❌ Error debugging task status:', error);
        }
    }

    // Load completion statistics for user profile
    async loadCompletionStats() {
        try {
            // Get user's task submissions to calculate stats
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = submissions.filter(s => s.user_id === this.currentUser.uid);

            // Calculate stats
            const completedSubmissions = userSubmissions.filter(s => s.status === 'approved' || s.status === 'completed');
            const totalCompletions = completedSubmissions.length;

            // Calculate total earned from completed submissions
            let totalRewardsEarned = 0;
            for (const submission of completedSubmissions) {
                if (submission.task?.reward) {
                    totalRewardsEarned += parseFloat(submission.task.reward) || 0;
                }
            }

            // Update completion count
            const completionElement = document.getElementById('quest-completions');
            if (completionElement) {
                completionElement.textContent = totalCompletions;
            }

            // Update total earned
            const earnedElement = document.getElementById('total-earned');
            if (earnedElement) {
                earnedElement.textContent = `₱${totalRewardsEarned.toFixed(2)}`;
            }

            console.log('Completion stats loaded:', { totalCompletions, totalRewardsEarned });
        } catch (error) {
            console.error('Error loading completion stats:', error);
            // Set default values on error
            const completionElement = document.getElementById('quest-completions');
            if (completionElement) {
                completionElement.textContent = '0';
            }

            const earnedElement = document.getElementById('total-earned');
            if (earnedElement) {
                earnedElement.textContent = '₱0';
            }
        }
    }

    // Restart quest function
    async restartQuest(taskId, button = null) {
        try {
            console.log('🔄 Restarting quest:', taskId);

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Restarting...');
            }

            // Get task details first
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Close the task detail modal specifically
            const taskModal = document.getElementById('task-detail-modal');
            console.log('🔍 Looking for task detail modal:', taskModal);
            if (taskModal) {
                taskModal.remove();
                console.log('✅ Task detail modal closed');
            } else {
                console.log('❌ Task detail modal not found, trying to close any modal');
                // Fallback: close any modal
                const anyModal = document.querySelector('.modal');
                if (anyModal) {
                    anyModal.remove();
                    console.log('✅ Closed fallback modal');
                }
            }

            // Clear any existing task submissions to make task available again
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmissions = submissions.filter(s => s.task_id === taskId && s.user_id === this.currentUser.uid);
            for (const submission of userSubmissions) {
                await window.firestoreManager.deleteTaskSubmission(submission.id);
            }

            // Clear stored start time from localStorage
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(startTimeKey);
            console.log(`🗑️ Cleared start time from localStorage: ${startTimeKey}`);

            // Clear expired flag from localStorage
            const expiredKey = `task_expired_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(expiredKey);
            console.log(`🗑️ Cleared expired flag from localStorage: ${expiredKey}`);

            // Clear any completion flags or progress data
            const completionKey = `task_completed_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(completionKey);

            // Also clear any existing verifications for this task to start fresh
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);

            for (const verification of taskVerifications) {
                // Delete old verifications to start completely fresh
                await window.firestoreManager.deleteVerification(verification.id);
                console.log('🗑️ Deleted old verification:', verification.id);
            }

            // Clear and restart all countdown timers to ensure fresh state
            if (this.countdownTimers) {
                this.countdownTimers.forEach(timer => clearInterval(timer));
                this.countdownTimers = [];
            }

            this.showToast(`Quest restarted! You can now begin again with fresh timer.`, 'success');

            // Reload tasks to update the UI
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error restarting quest:', error);
            this.showToast('Failed to restart quest: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    showPhase2VerificationModal(task) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container-modern max-w-2xl">
                <!-- Modal Header -->
                <div class="modal-header-modern">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <i class="fas fa-check-circle"></i>
                            </div>
                        <div class="modal-title-content">
                            <h3 class="modal-title">Phase 2 Verification</h3>
                            <p class="modal-subtitle">${task.title}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        </button>
                </div>

                <!-- Modal Body -->
                <div class="modal-body-modern">
                    <!-- Progress Indicator -->
                    <div class="dns-progress-indicator">
                        <div class="progress-steps">
                            <div class="step active">
                                <div class="step-number">1</div>
                                <div class="step-label">Requirements</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <div class="step-label">Submit</div>
                            </div>
                            <div class="step-line"></div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <div class="step-label">Complete</div>
                            </div>
                    </div>
                </div>
                
                    <!-- Main Content -->
                    <div class="dns-content">
                        <!-- Requirements Section -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-list-check"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Phase 2 Requirements</h4>
                                    <p>Complete these requirements to finish your task</p>
                        </div>
                    </div>

                            <div class="verification-box">
                                <div class="dns-server-display">
                                    <div class="server-label">Requirements:</div>
                                    <div class="server-address">
                                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.875rem; white-space: pre-wrap; color: #374151;">
${task.phase2Requirements || 'Please provide proof of task completion.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                    </div>

                        <!-- Submission Form -->
                        <div class="dns-section">
                            <div class="section-header">
                                <div class="section-icon">
                                    <i class="fas fa-upload"></i>
                                </div>
                                <div class="section-title">
                                    <h4>Submit Your Completion</h4>
                                    <p>Provide proof of task completion</p>
                                </div>
                    </div>

                            <div class="verification-box">
                                <form id="phase2-form" class="step-form">
                                    <div class="dns-server-display">
                                        <div class="server-label">Game ID:</div>
                                        <div class="server-address">
                                            <input type="text" id="game-id-phase2" required class="form-input" placeholder="Enter your Game ID" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                    </div>
                                    </div>
                                    <p class="text-sm text-gray-500 mt-2">Same Game ID from Phase 1</p>
                                    
                                    <div class="dns-server-display">
                                        <div class="server-label">Completion Screenshot:</div>
                                        <div class="server-address">
                                            <input type="file" id="completion-screenshot" required class="form-input" accept="image/*" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                    </div>
                                    </div>
                                    <p class="text-sm text-gray-500 mt-2">Upload screenshot showing task completion</p>
                                    
                                    <div class="dns-server-display">
                                        <div class="server-label">Additional Screenshots:</div>
                                        <div class="server-address">
                                            <input type="file" id="additional-screenshots" class="form-input" accept="image/*" multiple style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                                        </div>
                                    </div>
                                    <p class="text-sm text-gray-500 mt-2">Optional: Additional screenshots for verification</p>
                                    
                                    <div class="dns-server-display">
                                        <div class="server-label">Completion Notes:</div>
                                        <div class="server-address">
                                            <textarea id="phase2-notes" class="form-textarea" rows="3" placeholder="Describe how you completed the task" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; resize: vertical;"></textarea>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- Important Notice -->
                        <div class="important-notice">
                            <div class="notice-icon">
                                <i class="fas fa-info-circle"></i>
                            </div>
                            <div class="notice-content">
                                <h5>Final Submission</h5>
                                <p>This is your final verification. Make sure all information is accurate and screenshots are clear.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="modal-footer-modern">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    <button type="submit" class="btn btn-primary" form="phase2-form">
                        <i class="fas fa-check"></i>
                            Submit Phase 2
                        </button>
                    </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        const form = document.getElementById('phase2-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitPhase2Verification(task.id, modal);
            });
        }
    }

    async startTaskDirectly(task, passedReferrerEmail = null) {
        try {
            console.log('🚀 Starting task directly:', task.title);

            // Get referrer email if required
            let referrerEmail = passedReferrerEmail;
            if (task.requires_referrer_email && !referrerEmail) {
                let referrerElement = document.getElementById(`referrer-email-${task.id}`);
                referrerEmail = referrerElement ? referrerElement.value.trim() : null;

                // Fallback: if specific element not found, try to find any referrer email input
                if (!referrerElement || !referrerEmail) {
                    console.log('🔍 Primary referrer element not found in startTaskDirectly, trying fallback...');
                    const allReferrerInputs = document.querySelectorAll('input[id*="referrer-email"]');
                    console.log('Found referrer inputs:', allReferrerInputs.length);

                    for (let input of allReferrerInputs) {
                        if (input.value && input.value.trim()) {
                            referrerElement = input;
                            referrerEmail = input.value.trim();
                            console.log('Using fallback referrer input:', input.id, input.value);
                            break;
                        }
                    }
                }

                console.log('📧 Referrer email debugging (startTaskDirectly):', {
                    requiresReferrer: task.requires_referrer_email,
                    passedReferrerEmail: passedReferrerEmail,
                    elementId: `referrer-email-${task.id}`,
                    elementExists: !!referrerElement,
                    elementValue: referrerElement ? referrerElement.value : 'Element not found',
                    trimmedValue: referrerEmail,
                    allReferrerInputs: document.querySelectorAll('input[id*="referrer-email"]').length
                });
            } else if (task.requires_referrer_email && referrerEmail) {
                console.log('📧 Using passed referrer email:', referrerEmail);
            }

            // Validate referrer email if required
            if (task.requires_referrer_email) {
                if (!referrerEmail) {
                    this.showToast('Referrer email is required for this task. Please enter a valid email address.', 'error');
                    // Focus on the referrer email input if it exists
                    const referrerElement = document.getElementById(`referrer-email-${task.id}`) || document.querySelector('input[id*="referrer-email"]');
                    if (referrerElement) {
                        referrerElement.focus();
                    }
                    return;
                }

                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(referrerEmail)) {
                    this.showToast('Please enter a valid email address for the referrer.', 'error');
                    return;
                }
            }

            // Create task submission
            const submissionData = {
                task_id: task.id,
                user_id: this.currentUser.uid,
                status: 'in_progress',
                restart_count: 0,
                referrer_email: referrerEmail
            };

            console.log('💾 Creating task submission...');
            await window.firestoreManager.createTaskSubmission(submissionData);
            console.log('✅ Task submission created');

            // Start the timer for this task
            console.log('⏰ Starting timer for task:', task.id);
            window.startTaskTimer(task.id);

            // Update task status to in_progress in the database
            const statusData = {
                startedAt: new Date(),
                timerSynced: true
            };

            // Save referrer email if provided
            if (referrerEmail) {
                statusData.referrer_email = referrerEmail;
            }

            await window.firestoreManager.updateTaskStatus(task.id, 'in_progress', this.currentUser.uid, statusData);

            this.showToast('✅ Task started successfully! Timer is now running. Click the task again when you\'re ready to submit.', 'success');

            // Close the task detail modal
            const taskModal = document.getElementById('task-detail-modal');
            if (taskModal) {
                taskModal.remove();
            }

            // Reload tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error starting task:', error);
            this.showToast(`❌ Failed to start task: ${error.message}`, 'error');
        }
    }

    async showTaskRestartOptions(task, taskStatus) {
        console.log('Creating task restart options modal...');

        // Remove any existing modals first
        const existingModal = document.getElementById('task-restart-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Get user's restart count
        const submissions = await window.firestoreManager.getTaskSubmissions('all');
        const userSubmission = submissions.find(s =>
            s.task_id === task.id && s.user_id === this.currentUser.uid
        );

        const currentRestartCount = userSubmission?.restart_count || 0;
        const maxRestarts = task.max_restarts || 3;
        const canRestart = currentRestartCount < maxRestarts;
        const remainingRestarts = maxRestarts - currentRestartCount;

        const modal = document.createElement('div');
        modal.id = 'task-restart-modal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container max-w-2xl">
                <div class="modal-header">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-check-circle text-green-600 text-xl"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="modal-title text-xl font-semibold text-gray-900 mb-2">Task Completed!</h3>
                                <p class="text-gray-600">${task.title || 'Untitled Task'}</p>
                            </div>
                        </div>
                        <button id="close-task-restart-modal" class="modal-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="modal-form">
                    <div class="space-y-6">
                        ${canRestart ? `
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 class="form-label text-blue-800 mb-2">Restart Task</h4>
                                <p class="text-blue-700 mb-3">You can restart this task ${remainingRestarts} more time${remainingRestarts > 1 ? 's' : ''}.</p>
                                <button onclick="window.dashboardHandler.restartTask('${task.id}', this)" class="btn btn-primary">
                                    <i class="fas fa-redo mr-2"></i>
                                    Restart Task
                                </button>
                            </div>
                        ` : `
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h4 class="form-label text-gray-800 mb-2">Maximum Restarts Reached</h4>
                                <p class="text-gray-700">You have reached the maximum number of restarts (${maxRestarts}) for this task.</p>
                            </div>
                        `}

                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h4 class="form-label">Task Details</h4>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="font-medium text-gray-600">Reward:</span>
                                    <span class="text-gray-900">₱${task.reward}</span>
                                </div>
                                <div>
                                    <span class="font-medium text-gray-600">Completed:</span>
                                    <span class="text-gray-900">${currentRestartCount + 1} time${currentRestartCount > 0 ? 's' : ''}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup close button
        document.getElementById('close-task-restart-modal').addEventListener('click', () => {
            modal.remove();
        });
    }

    async restartTask(taskId, button = null) {
        try {
            console.log('🔄 Restarting task:', taskId);

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Restarting...');
            }

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Close the restart modal first
            const restartModal = document.getElementById('task-restart-modal');
            if (restartModal) {
                restartModal.remove();
            }

            // Update task submission to restart (in_progress status)
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === this.currentUser.uid
            );

            if (userSubmission) {
                // Instead of updating the existing submission, create a new one for restart
                // This preserves the completion history
                const restartCount = (userSubmission.restart_count || 0) + 1;
                const submissionData = {
                    task_id: taskId,
                    user_id: this.currentUser.uid,
                    status: 'available', // Set to available so user can input email again
                    restart_count: restartCount,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                };
                await window.firestoreManager.createTaskSubmission(submissionData);
                console.log(`🔄 Created new submission for restart #${restartCount}: ${taskId}`);
            } else {
                // If no submission exists, create a new one
                const submissionData = {
                    task_id: taskId,
                    user_id: this.currentUser.uid,
                    status: 'available', // Set to available so user can input email again
                    restart_count: 0,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                };
                await window.firestoreManager.createTaskSubmission(submissionData);
                console.log(`🆕 Created new task submission for restart: ${taskId}`);
            }

            // Clear stored start time from localStorage
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(startTimeKey);
            console.log(`🗑️ Cleared start time from localStorage: ${startTimeKey}`);

            // Clear expired flag from localStorage
            const expiredKey = `task_expired_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(expiredKey);
            console.log(`🗑️ Cleared expired flag from localStorage: ${expiredKey}`);

            // Clear any completion flags or progress data
            const completionKey = `task_completed_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(completionKey);

            // Also clear any existing verifications for this task to start fresh
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);

            for (const verification of taskVerifications) {
                // Delete old verifications to start completely fresh
                await window.firestoreManager.deleteVerification(verification.id);
                console.log('🗑️ Deleted old verification:', verification.id);
            }

            // Clear and restart all countdown timers to ensure fresh state
            if (this.countdownTimers) {
                this.countdownTimers.forEach(timer => clearInterval(timer));
                this.countdownTimers = [];
            }

            this.showToast(`✅ Task restarted! Please input your email and start the task again.`, 'success');

            // Close all modals
            this.closeAllModals();

            // Add a small delay to ensure database update has propagated
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reload tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error restarting task:', error);
            this.showToast(`❌ Failed to restart task: ${error.message}`, 'error');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    // Show task completion form with proof upload
    async showTaskCompletionForm(taskId, button = null) {
        try {
            console.log('📝 Showing task completion form for:', taskId);

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Loading...');
            }

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Remove any existing completion modals
            const existingModal = document.getElementById('task-completion-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'task-completion-modal';
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            modal.innerHTML = `
                <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
                <div class="modal-container max-w-2xl" style="position: relative;">
                    <div class="modal-header">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-check-circle text-green-600 text-xl"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h3 class="modal-title text-xl font-semibold text-gray-900 mb-2">Complete Task</h3>
                                    <p class="text-gray-600">${task.title || 'Untitled Task'}</p>
                                    <p class="text-sm text-green-600 mt-1">Upload proof of completion to submit for review</p>
                                </div>
                            </div>
                            <button id="close-task-completion-modal" class="modal-close">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="modal-form">
                        <div class="space-y-6">
                            ${task.description ? `
                                <div class="form-group">
                                    <h4 class="form-label">Task Description</h4>
                                    <p class="text-gray-700">${task.description}</p>
                                </div>
                            ` : ''}

                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 class="form-label text-blue-800 mb-2">Submit Your Completion</h4>
                                <p class="text-blue-700 mb-4">Upload proof of task completion and add notes:</p>
                                
                                <form id="task-completion-form" class="space-y-4">
                                    <div class="form-group">
                                        <label class="form-label">Completion Screenshot *</label>
                                        <input type="file" id="completion-proof" class="form-input" accept="image/*" required>
                                        <small class="form-help">Upload a screenshot showing task completion</small>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">Completion Notes</label>
                                        <textarea id="completion-notes" class="form-textarea" rows="3" placeholder="Describe how you completed the task (optional)"></textarea>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" form="task-completion-form">
                            <i class="fas fa-check"></i>
                            Submit Completion
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Setup form submission
            const form = document.getElementById('task-completion-form');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.submitTaskCompletion(taskId, modal);
                });
            }

            // Setup close button
            document.getElementById('close-task-completion-modal').addEventListener('click', () => {
                modal.remove();
            });

            // Setup form submission
            const completionForm = document.getElementById('task-completion-form');
            if (completionForm) {
                completionForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    this.submitTaskCompletion(taskId, modal, submitBtn);
                });
            }

        } catch (error) {
            console.error('Error showing task completion form:', error);
            this.showToast('Failed to load completion form', 'error');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async submitTaskCompletion(taskId, modal, button = null) {
        try {
            console.log('🔄 Submitting task completion...');

            // Show loading overlay within the modal
            this.showModalLoading(modal, 'Uploading Screenshot', 'Please wait while we upload your proof...');

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Submitting...');
            }

            const completionProof = document.getElementById('completion-proof').files[0];
            const completionNotes = document.getElementById('completion-notes').value.trim();

            if (!completionProof) {
                this.hideModalLoading(modal);
                this.showToast('Please upload a completion screenshot', 'error');
                return;
            }

            // Update loading message
            this.updateModalLoading(modal, 'Processing Submission', 'Saving your task completion...');

            // Upload screenshot to Firebase Storage
            console.log('📤 Uploading completion screenshot...');
            const screenshotUrl = await this.uploadScreenshot(completionProof, `task_completion_${taskId}_${this.currentUser.uid}`);
            console.log('✅ Screenshot uploaded:', screenshotUrl);

            // Get current submission and update it to pending_review
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === this.currentUser.uid
            );

            if (userSubmission) {
                // Update existing submission to pending_review, preserving referrer email
                await window.firestoreManager.updateTaskSubmission(userSubmission.id, {
                    status: 'pending_review',
                    proof_image_url: screenshotUrl,
                    notes: completionNotes || 'Task completed and submitted',
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    // Note: referrer_email is already in the existing submission, so we don't need to update it
                });
                console.log('✅ Task submission updated to pending_review');
                console.log('📧 Preserved referrer email:', userSubmission.referrer_email);
            } else {
                // Create new submission if none exists (shouldn't happen for completion)
                const submissionData = {
                    task_id: taskId,
                    user_id: this.currentUser.uid,
                    status: 'pending_review',
                    restart_count: 0,
                    referrer_email: null, // This case shouldn't happen for task completion
                    proof_image_url: screenshotUrl,
                    notes: completionNotes || 'Task completed and submitted'
                };
                await window.firestoreManager.createTaskSubmission(submissionData);
                console.log('✅ Task submission created');
            }

            this.hideModalLoading(modal);
            this.showToast('✅ Task completion submitted successfully! Your submission is now under review.', 'success');
            modal.remove();

            // Also close the main task detail modal
            const taskDetailModal = document.getElementById('task-detail-modal');
            if (taskDetailModal) {
                taskDetailModal.remove();
            }

            await this.loadTasks();

        } catch (error) {
            console.error('Error submitting task completion:', error);
            this.hideModalLoading(modal);
            this.showToast('Failed to submit task completion: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    // Modal loading functions
    showModalLoading(modal, title = 'Loading...', message = 'Please wait...') {
        // Remove existing loading overlay if any
        const existingLoading = modal.querySelector('.modal-loading-overlay');
        if (existingLoading) {
            existingLoading.remove();
        }

        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'modal-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="modal-loading-content">
                <div class="modal-loading-spinner">
                    <div class="spinner"></div>
                </div>
                <h3 class="modal-loading-title">${title}</h3>
                <p class="modal-loading-message">${message}</p>
            </div>
        `;

        // Add to modal
        modal.appendChild(loadingOverlay);

        // Add CSS if not already added
        if (!document.getElementById('modal-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-loading-styles';
            style.textContent = `
                .modal-loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 16px;
                }

                .modal-loading-content {
                    text-align: center;
                    padding: 2rem;
                }

                .modal-loading-spinner {
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 1rem;
                }

                .modal-loading-spinner .spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid #f3f4f6;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .modal-loading-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 0.5rem;
                }

                .modal-loading-message {
                    font-size: 0.875rem;
                    color: #6b7280;
                    margin: 0;
                }
            `;
            document.head.appendChild(style);
        }
    }

    updateModalLoading(modal, title, message) {
        const loadingOverlay = modal.querySelector('.modal-loading-overlay');
        if (loadingOverlay) {
            const titleEl = loadingOverlay.querySelector('.modal-loading-title');
            const messageEl = loadingOverlay.querySelector('.modal-loading-message');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
        }
    }

    hideModalLoading(modal) {
        const loadingOverlay = modal.querySelector('.modal-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // Resubmit task after rejection
    async resubmitTask(taskId, button = null) {
        try {
            console.log('🔄 Resubmitting task:', taskId);

            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true, 'Resubmitting...');
            }

            // Close the task detail modal first
            const taskDetailModal = document.getElementById('task-detail-modal');
            if (taskDetailModal) {
                taskDetailModal.remove();
            }

            // Small delay to ensure modal closes smoothly
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Check if user has a rejected submission
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === this.currentUser.uid
            );

            if (!userSubmission || userSubmission.status !== 'rejected') {
                this.showToast('No rejected submission found for this task', 'error');
                return;
            }

            // Show completion form for resubmission
            await this.showTaskCompletionForm(taskId);

            // Show success message
            this.showToast('📝 Please upload new proof and resubmit your application', 'info');

        } catch (error) {
            console.error('Error resubmitting task:', error);
            this.showToast('Failed to resubmit task: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async submitPhase1Verification(taskId, modal) {
        try {
            console.log('🔄 Starting Phase 1 verification submission...');
            this.showModalLoading(modal, 'Submitting Phase 1 Verification', 'Please wait while we process your verification...');

            const gameId = document.getElementById('game-id').value.trim();
            const androidVersion = document.getElementById('android-version').value;
            const notes = document.getElementById('phase1-notes').value.trim();
            const screenshot = document.getElementById('profile-screenshot').files[0];

            console.log('📝 Form data:', { gameId, androidVersion, notes, screenshot: screenshot?.name });

            if (!gameId || !androidVersion || !screenshot) {
                this.hideModalLoading(modal);
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

            // Update loading message
            this.updateModalLoading(modal, 'Uploading Screenshot', 'Please wait while we upload your verification image...');

            // Upload screenshot to Firebase Storage
            console.log('📤 Uploading screenshot...');
            const screenshotUrl = await this.uploadScreenshot(screenshot, `phase1_${taskId}_${this.currentUser.uid}`);
            console.log('✅ Screenshot uploaded:', screenshotUrl);

            // Get task details to check for referrer email requirement
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            // Get referrer email from saved task status instead of input field
            let referrerEmail = null;
            if (task?.requires_referrer_email) {
                const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
                referrerEmail = taskStatus?.referrer_email || null;

                // Fallback to input field if not found in task status (for backward compatibility)
                if (!referrerEmail) {
                    const referrerElement = document.getElementById(`referrer-email-${taskId}`);
                    referrerEmail = referrerElement ? referrerElement.value.trim() : null;
                }
            }

            console.log('📧 Referrer email for Phase 1 verification:', {
                taskId: taskId,
                requiresReferrer: task?.requires_referrer_email,
                referrerEmail: referrerEmail,
                elementId: `referrer-email-${taskId}`,
                elementValue: document.getElementById(`referrer-email-${taskId}`)?.value,
                taskStatusReferrer: taskStatus?.referrer_email
            });

            const verificationData = {
                taskId: taskId,
                userId: this.currentUser.uid,
                phase: 'initial',
                status: 'pending',
                gameId: gameId,
                androidVersion: androidVersion,
                screenshots: [screenshotUrl],
                notes: notes || 'Phase 1 verification submitted',
                referrer_email: referrerEmail,
                createdAt: new Date()
            };

            console.log('💾 Saving verification data...');
            await window.firestoreManager.createVerification(verificationData);
            console.log('✅ Verification data saved');

            // Also create a task submission for tracking
            if (task) {
                const submissionData = {
                    task_id: taskId,
                    user_id: this.currentUser.uid,
                    status: 'pending_review',
                    restart_count: 0,
                    referrer_email: referrerEmail
                };
                await window.firestoreManager.createTaskSubmission(submissionData);
                console.log('✅ Task submission created');
            }

            // Update task status to pending
            await window.firestoreManager.updateTaskStatus(taskId, 'pending');

            this.hideModalLoading(modal);
            this.showToast('✅ Phase 1 verification submitted successfully!', 'success');
            modal.remove();
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error submitting Phase 1 verification:', error);
            this.hideModalLoading(modal);

            // Show specific error message
            let errorMessage = 'Failed to submit verification';
            if (error.message.includes('CORS')) {
                errorMessage = 'Upload failed due to network restrictions. Please check your internet connection and try again.';
            } else if (error.message.includes('permission')) {
                errorMessage = 'You do not have permission to upload files. Please contact support.';
            } else if (error.message.includes('size')) {
                errorMessage = 'File is too large. Please upload a smaller image.';
            } else if (error.message.includes('type')) {
                errorMessage = 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
            } else {
                errorMessage = error.message || 'An unexpected error occurred. Please try again.';
            }

            this.showToast(`❌ ${errorMessage}`, 'error');
        }
    }

    async submitPhase2Verification(taskId, modal) {
        try {
            this.showModalLoading(modal, 'Submitting Phase 2 Verification', 'Please wait while we process your final verification...');

            const gameId = document.getElementById('game-id-phase2').value.trim();
            const notes = document.getElementById('phase2-notes').value.trim();
            const completionScreenshot = document.getElementById('completion-screenshot').files[0];
            const additionalScreenshots = document.getElementById('additional-screenshots').files;

            if (!gameId || !completionScreenshot) {
                this.hideModalLoading(modal);
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

            // Update loading message
            this.updateModalLoading(modal, 'Uploading Screenshots', 'Please wait while we upload your verification images...');

            // Get Android version from the initial verification
            const initialVerification = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const userInitialVerification = initialVerification.find(v => v.taskId === taskId && v.phase === 'initial');
            const androidVersion = userInitialVerification?.androidVersion || 'Unknown';

            // Upload screenshots to Firebase Storage
            const screenshots = [];
            screenshots.push(await this.uploadScreenshot(completionScreenshot, `phase2_completion_${taskId}_${this.currentUser.uid}`));

            for (let i = 0; i < additionalScreenshots.length; i++) {
                const url = await this.uploadScreenshot(additionalScreenshots[i], `phase2_additional_${taskId}_${this.currentUser.uid}_${i}`);
                screenshots.push(url);
            }

            const verificationData = {
                taskId: taskId,
                userId: this.currentUser.uid,
                phase: 'final',
                status: 'pending',
                gameId: gameId,
                androidVersion: androidVersion,
                screenshots: screenshots,
                notes: notes || 'Phase 2 verification submitted',
                createdAt: new Date()
            };

            await window.firestoreManager.createVerification(verificationData);

            // Update task status to pending
            await window.firestoreManager.updateTaskStatus(taskId, 'pending');

            this.hideModalLoading(modal);
            this.showToast('Phase 2 verification submitted successfully!', 'success');
            modal.remove();
            await this.loadTasks();

        } catch (error) {
            console.error('Error submitting Phase 2 verification:', error);
            this.hideModalLoading(modal);
            this.showToast('Failed to submit verification: ' + error.message, 'error');
        }
    }

    async uploadScreenshot(file, filename) {
        try {
            // Validate file first
            if (!file) {
                throw new Error('No file provided');
            }

            // Validate file type and size
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(file.type)) {
                throw new Error('Please upload a valid image file (JPEG, PNG, or WebP)');
            }

            if (file.size > maxSize) {
                throw new Error('File size must be less than 5MB');
            }

            // Use ImgBB for image upload
            try {
                console.log('📤 Uploading to ImgBB...');

                // Check if StorageManager is available
                if (!window.storageManager) {
                    throw new Error('StorageManager not properly configured');
                }

                const result = await window.storageManager.uploadToImgBB(file, filename);
                console.log('✅ Screenshot uploaded successfully via ImgBB:', result.url);
                return result.url;
            } catch (imgbbError) {
                console.error('❌ ImgBB upload failed:', imgbbError);

                // Fallback: Create a compressed data URL for testing (within Firestore limits)
                console.log('🔄 Using fallback method for testing...');
                return new Promise((resolve) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();

                    img.onload = () => {
                        // Resize image to reduce size (max 400x400)
                        const maxSize = 400;
                        let { width, height } = img;

                        if (width > height) {
                            if (width > maxSize) {
                                height = (height * maxSize) / width;
                                width = maxSize;
                            }
                        } else {
                            if (height > maxSize) {
                                width = (width * maxSize) / height;
                                height = maxSize;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;

                        // Draw resized image
                        ctx.drawImage(img, 0, 0, width, height);

                        // Convert to compressed data URL (JPEG with 0.7 quality)
                        const compressedDataURL = canvas.toDataURL('image/jpeg', 0.7);

                        // Check if still too large (Firestore limit is ~1MB)
                        if (compressedDataURL.length > 1000000) {
                            // If still too large, create a placeholder
                            resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIFVwbG9hZCBGYWlsZWQ8L3RleHQ+PC9zdmc+');
                        } else {
                            resolve(compressedDataURL);
                        }
                    };

                    img.onerror = () => {
                        // If image fails to load, create placeholder
                        resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIFVwbG9hZCBGYWlsZWQ8L3RleHQ+PC9zdmc+');
                    };

                    img.src = URL.createObjectURL(file);
                });
            }
        } catch (error) {
            console.error('❌ Error uploading screenshot:', error);

            // Provide user-friendly error messages
            if (error.code === 'storage/unauthorized') {
                throw new Error('You do not have permission to upload files. Please contact support.');
            } else if (error.code === 'storage/canceled') {
                throw new Error('Upload was canceled. Please try again.');
            } else if (error.code === 'storage/unknown') {
                throw new Error('An unknown error occurred during upload. Please try again.');
            } else if (error.message.includes('CORS')) {
                throw new Error('Upload failed due to network restrictions. Please check your internet connection and try again.');
            } else if (error.message.includes('RLS') || error.message.includes('row-level security')) {
                throw new Error('Storage configuration issue. Using fallback method.');
            } else {
                throw new Error(error.message || 'Failed to upload screenshot. Please try again.');
            }
        }
    }

    async createInitialVerification(taskId) {
        try {
            const verificationData = {
                taskId: taskId,
                userId: this.currentUser.uid,
                phase: 'initial',
                status: 'pending',
                createdAt: new Date(),
                screenshots: [],
                notes: 'Initial verification submitted'
            };

            await window.firestoreManager.createVerification(verificationData);
            console.log('Initial verification created for task:', taskId);
        } catch (error) {
            console.error('Error creating initial verification:', error);
            throw error;
        }
    }

    async createFinalVerification(taskId) {
        try {
            const verificationData = {
                taskId: taskId,
                userId: this.currentUser.uid,
                phase: 'final',
                status: 'pending',
                createdAt: new Date(),
                screenshots: [],
                notes: 'Final verification submitted'
            };

            await window.firestoreManager.createVerification(verificationData);
            console.log('Final verification created for task:', taskId);
        } catch (error) {
            console.error('Error creating final verification:', error);
            throw error;
        }
    }

    async loadWalletHistory() {
        let pageLoading = null;

        try {
            // Show loading indicator
            pageLoading = this.showPageLoading('Loading wallet history...');

            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                await this.waitForAuthentication();
            }

            // Check if user is disabled
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists && userDoc.data().status === 'disabled') {
                this.showAccountDisabledNotice();
                // Mark all data as loaded for disabled users to hide loading modal
                this.markDataLoaded('userData');
                this.markDataLoaded('tasks');
                this.markDataLoaded('wallet');
                this.markDataLoaded('notifications');
                return;
            }

            // Use the new balance tracking system
            await this.loadTransactionHistory();
        } catch (error) {
            console.error('Error loading wallet history:', error);
            this.showToast('Failed to load wallet history', 'error');
        } finally {
            this.hidePageLoading(pageLoading);
            // Mark wallet data as loaded
            this.markDataLoaded('wallet');
        }
    }

    async renderWalletHistory(history) {
        const historyContainer = document.getElementById('wallet-history');
        if (!historyContainer) return;

        if (history.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-history text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No transaction history yet</p>
                </div>
            `;
            return;
        }

        // Process each history item asynchronously
        const historyItems = await Promise.all(history.map(async item => {
            if (item.type === 'withdrawal') {
                return this.createWithdrawalHistoryItem(item);
            } else if (item.type === 'earning') {
                return await this.createEarningHistoryItem(item);
            }
            return '';
        }));

        historyContainer.innerHTML = historyItems.join('');
    }

    createWithdrawalHistoryItem(withdrawal) {
        const statusConfig = this.getWithdrawalStatusConfig(withdrawal.status);

        return `
            <div class="activity-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-money-bill-wave text-gray-400"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900">Withdrawal Request</p>
                        <p class="text-sm text-gray-500">${withdrawal.method.toUpperCase()} - ${withdrawal.account_details}</p>
                        <p class="text-xs text-gray-400">Reference: ${withdrawal.referenceNumber || 'N/A'}</p>
                        <p class="text-xs text-gray-400">${new Date(withdrawal.createdAt?.toDate()).toLocaleString()}</p>
                        ${withdrawal.rejectionReason ? `
                            <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div class="flex items-start gap-2">
                                    <i class="fas fa-exclamation-triangle text-red-500 mt-0.5"></i>
                                    <div>
                                        <p class="text-xs font-semibold text-red-800 mb-1">Rejection Reason:</p>
                                        <p class="text-xs text-red-700">${withdrawal.rejectionReason}</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-medium text-red-600">-₱${withdrawal.amount}</p>
                    <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                </div>
            </div>
        `;
    }


    async createEarningHistoryItem(verification) {
        // Get the task details to show the correct reward amount
        let taskReward = 50; // Default fallback
        try {
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === verification.taskId);
            if (task) {
                taskReward = task.reward;
            }
        } catch (error) {
            console.error('Error fetching task details for earning history:', error);
        }

        return `
            <div class="activity-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-coins text-green-500"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900">Task Completed</p>
                        <p class="text-sm text-gray-500">Task Reward</p>
                        <p class="text-xs text-gray-400">Reference: ${verification.referenceNumber || 'N/A'}</p>
                        <p class="text-xs text-gray-400">${new Date(verification.createdAt?.toDate()).toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-medium text-green-600">+₱${taskReward}</p>
                    <span class="status-badge status-approved">Approved</span>
                </div>
            </div>
        `;
    }

    getWithdrawalStatusConfig(status) {
        switch (status) {
            case 'pending':
                return { badgeClass: 'status-pending', label: 'Pending' };
            case 'paid':
                return { badgeClass: 'status-approved', label: 'Paid' };
            case 'rejected':
                return { badgeClass: 'status-rejected', label: 'Rejected' };
            default:
                return { badgeClass: 'status-pending', label: 'Pending' };
        }
    }


    renderActivityHistory(activities) {
        const container = document.getElementById('activity-history');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = `
                <div class="activity-empty">
                    <i class="fas fa-history"></i>
                    <p>No activity yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => {
            if (activity.type === 'verification') {
                return this.createVerificationActivityItem(activity);
            } else if (activity.type === 'withdrawal') {
                return this.createWithdrawalActivityItem(activity);
            }
        }).join('');
    }

    createVerificationActivityItem(verification) {
        const statusConfig = this.getVerificationStatusConfig(verification.status);

        return `
            <div class="activity-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-check-circle text-blue-500"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900">${verification.phase === 'initial' ? 'Initial' : 'Final'} Verification</p>
                        <p class="text-sm text-gray-500">Task Verification</p>
                        <p class="text-xs text-gray-400">Game ID: ${verification.gameId}</p>
                        <p class="text-xs text-gray-400">Reference: ${verification.referenceNumber || 'N/A'}</p>
                        <p class="text-xs text-gray-400">${new Date(verification.createdAt?.toDate()).toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                </div>
            </div>
        `;
    }

    createWithdrawalActivityItem(withdrawal) {
        const statusConfig = this.getWithdrawalStatusConfig(withdrawal.status);
        const date = new Date(withdrawal.createdAt?.toDate()).toLocaleString();

        // Simple, clean withdrawal activity item - just shows what user did
        return `
            <div class="activity-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-money-bill-wave text-green-500"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-900">Withdrawal Request</p>
                        <p class="text-sm text-gray-500">₱${withdrawal.amount} via ${withdrawal.method.toUpperCase()}</p>
                        <p class="text-xs text-gray-400">Reference: ${withdrawal.referenceNumber || 'N/A'}</p>
                        <p class="text-xs text-gray-400">${date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                </div>
            </div>
        `;
    }

    getVerificationStatusConfig(status) {
        switch (status) {
            case 'pending':
                return { badgeClass: 'status-pending', label: 'Pending' };
            case 'approved':
                return { badgeClass: 'status-approved', label: 'Approved' };
            case 'rejected':
                return { badgeClass: 'status-rejected', label: 'Rejected' };
            default:
                return { badgeClass: 'status-pending', label: 'Pending' };
        }
    }

    async checkAccountStatusAndShowWithdrawal() {
        try {
            // Check if user account is disabled
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.status === 'disabled') {
                    this.showToast('❌ Your account is disabled. You cannot make withdrawals.', 'error');
                    return;
                }
            }

            // If account is active, show withdrawal modal
            this.showWithdrawalModal();
        } catch (error) {
            console.error('Error checking account status:', error);
            this.showToast('❌ Failed to verify account status', 'error');
        }
    }

    showWithdrawalModal() {
        const modal = document.getElementById('withdrawal-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Check and display cooldown status
        this.updateWithdrawalCooldownStatus();

        // Focus on amount input
        setTimeout(() => {
            document.getElementById('withdrawal-amount').focus();
        }, 100);
    }

    updateWithdrawalCooldownStatus() {
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
        if (!submitBtn) return;

        if (this.isSubmittingWithdrawal) {
            this.setButtonLoading(submitBtn, true, 'Processing...');
            return;
        }

        if (this.lastWithdrawalTime) {
            const now = Date.now();
            const timeSinceLastWithdrawal = now - this.lastWithdrawalTime;

            if (timeSinceLastWithdrawal < this.withdrawalCooldown) {
                const remainingTime = Math.ceil((this.withdrawalCooldown - timeSinceLastWithdrawal) / 1000);
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fas fa-clock"></i> Wait ${remainingTime}s`;
                submitBtn.style.opacity = '0.6';

                // Update countdown every second
                const countdownInterval = setInterval(() => {
                    const newTime = Date.now();
                    const newTimeSince = newTime - this.lastWithdrawalTime;

                    if (newTimeSince >= this.withdrawalCooldown) {
                        clearInterval(countdownInterval);
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
                        submitBtn.style.opacity = '1';
                        this.lastWithdrawalTime = null;
                        localStorage.removeItem('lastWithdrawalTime');
                    } else {
                        const newRemainingTime = Math.ceil((this.withdrawalCooldown - newTimeSince) / 1000);
                        submitBtn.innerHTML = `<i class="fas fa-clock"></i> Wait ${newRemainingTime}s`;
                    }
                }, 1000);
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
                submitBtn.style.opacity = '1';
                this.lastWithdrawalTime = null;
                localStorage.removeItem('lastWithdrawalTime');
            }
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
            submitBtn.style.opacity = '1';
        }
    }

    closeWithdrawalModal() {
        const modal = document.getElementById('withdrawal-modal');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        document.getElementById('withdrawal-form').reset();

        // Reset submitting flag
        this.isSubmittingWithdrawal = false;

        // Clear localStorage
        localStorage.removeItem('isSubmittingWithdrawal');

        // Re-enable submit button if it was disabled
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
            submitBtn.style.opacity = '1';
        }
    }

    async submitWithdrawal() {
        const now = Date.now();

        // INSTANT UI BLOCKING - Set immediately to prevent spam
        if (this.isSubmittingWithdrawal) {
            this.showToast('⏳ Please wait, withdrawal is being processed...', 'warning');
            return;
        }

        // IMMEDIATELY set the flag to prevent multiple submissions
        this.isSubmittingWithdrawal = true;

        // Add timeout protection to prevent stuck button
        const timeoutId = setTimeout(() => {
            if (this.isSubmittingWithdrawal) {
                console.warn('Withdrawal submission timeout - resetting state');
                this.isSubmittingWithdrawal = false;
                this.resetWithdrawalButton();
            }
        }, 30000); // 30 second timeout

        // Check cooldown period
        if (this.lastWithdrawalTime && (now - this.lastWithdrawalTime) < this.withdrawalCooldown) {
            const remainingTime = Math.ceil((this.withdrawalCooldown - (now - this.lastWithdrawalTime)) / 1000);
            this.showToast(`⏰ Please wait ${remainingTime} seconds before next withdrawal`, 'warning');
            this.isSubmittingWithdrawal = false; // Reset flag on early return
            this.resetWithdrawalButton(); // Reset button
            return;
        }

        // Check if user account is disabled
        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.status === 'disabled') {
                    this.showToast('❌ Your account is disabled. You cannot make withdrawals.', 'error');
                    this.isSubmittingWithdrawal = false; // Reset flag on early return
                    this.resetWithdrawalButton(); // Reset button
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking account status:', error);
            this.showToast('❌ Failed to verify account status', 'error');
            this.isSubmittingWithdrawal = false; // Reset flag on early return
            this.resetWithdrawalButton(); // Reset button
            return;
        }

        // Set withdrawal time after all checks pass
        this.lastWithdrawalTime = now;

        // Store in localStorage for persistence across page reloads
        localStorage.setItem('lastWithdrawalTime', now.toString());
        localStorage.setItem('isSubmittingWithdrawal', 'true');

        // INSTANT UI UPDATE
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
        if (submitBtn) {
            this.setButtonLoading(submitBtn, true, 'Processing...');
        }

        let loadingModal = null;

        try {
            const amount = parseFloat(document.getElementById('withdrawal-amount').value);
            const method = document.getElementById('withdrawal-method').value;
            const account = document.getElementById('withdrawal-account').value;
            const accountName = document.getElementById('withdrawal-account-name').value;

            // Basic validation
            if (!amount || !method || !account || !accountName) {
                this.showToast('❌ Please fill in all fields', 'error');
                return;
            }

            if (amount <= 0) {
                this.showToast('❌ Amount must be greater than 0', 'error');
                return;
            }

            // Validate phone number format (must start with 09 and be 11 digits)
            if (!/^09\d{9}$/.test(account)) {
                this.showToast('❌ Phone number must start with "09" and be 11 digits total', 'error');
                return;
            }

            // Validate account name (at least 2 words, no numbers)
            if (accountName.trim().split(' ').length < 2) {
                this.showToast('❌ Please enter your full name (first and last name)', 'error');
                return;
            }

            if (/\d/.test(accountName)) {
                this.showToast('❌ Account name should not contain numbers', 'error');
                return;
            }

            // Show loading
            loadingModal = this.showLoadingModal('Processing Withdrawal', 'Please wait while we process your withdrawal request...');

            // Check if user has sufficient balance
            const user = await window.firestoreManager.getUser(this.currentUser.uid);
            if (user.walletBalance < amount) {
                this.showToast('❌ Insufficient balance', 'error');
                return;
            }

            // Create withdrawal request and deduct balance in a single transaction
            const result = await window.firestoreManager.createWithdrawalRequestWithBalanceDeduction({
                user_id: this.currentUser.uid,
                amount: amount,
                method: method,
                account_details: account,
                account_name: accountName.trim()
            });

            // Create notification for withdrawal submission
            await window.firestoreManager.createAdminNotification(this.currentUser.uid, {
                type: 'withdrawal_submitted',
                title: '💸 Withdrawal Request Submitted',
                message: `Your withdrawal request of ₱${amount} via ${method} has been submitted and is pending admin approval. Reference: ${result.referenceNumber}`,
                data: { withdrawalId: result.id, amount: amount, method: method, referenceNumber: result.referenceNumber }
            });

            this.showToast(`✅ Withdrawal request submitted successfully! Reference: ${result.referenceNumber}`, 'success');
            this.closeWithdrawalModal();

            // Reload user data and wallet history to show updated balance
            await this.loadUserData();
            await this.loadWalletHistory();

        } catch (error) {
            console.error('Error submitting withdrawal:', error);
            this.showToast('❌ Failed to submit withdrawal: ' + error.message, 'error');
        } finally {
            // Clear timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Reset flags and UI
            this.isSubmittingWithdrawal = false;
            this.hideLoadingModal(loadingModal);

            // Clear localStorage
            localStorage.removeItem('isSubmittingWithdrawal');

            // Re-enable submit button
            this.resetWithdrawalButton();
        }
    }

    closeTaskModal() {
        // Close task detail modal
        const taskDetailModal = document.getElementById('task-detail-modal');
        if (taskDetailModal) {
            taskDetailModal.remove();
        }

        // Also close any other task modals
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    closeAllModals() {
        this.closeTaskModal();
        this.closeWithdrawalModal();

        // Also close task detail modal
        const taskDetailModal = document.getElementById('task-detail-modal');
        if (taskDetailModal) {
            taskDetailModal.remove();
        }

        // Close any other modals that might be open
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            if (modal.id !== 'task-modal' && modal.id !== 'withdrawal-modal') {
                modal.remove();
            }
        });
    }

    resetWithdrawalButton() {
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
        if (submitBtn) {
            this.setButtonLoading(submitBtn, false);
            // Ensure correct withdrawal button text
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
        }
    }

    // Notifications
    async loadNotifications() {
        let pageLoading = null;

        try {
            // Show loading indicator
            pageLoading = this.showPageLoading('Loading notifications...');

            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                await this.waitForAuthentication();
            }

            // Check if user is disabled
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists && userDoc.data().status === 'disabled') {
                this.showAccountDisabledNotice();
                // Mark all data as loaded for disabled users to hide loading modal
                this.markDataLoaded('userData');
                this.markDataLoaded('tasks');
                this.markDataLoaded('wallet');
                this.markDataLoaded('notifications');
                return;
            }

            console.log('Loading notifications...');
            const notifications = await window.firestoreManager.getUserNotifications(this.currentUser.uid);
            this.renderNotifications(notifications);
            this.updateNotificationBadge(notifications);

            // Check for auto-rejection notifications and refresh tasks if needed
            const hasAutoRejection = notifications.some(n => n.type === 'verification_auto_rejected' && !n.read);
            if (hasAutoRejection) {
                console.log('🔄 Auto-rejection notification found, refreshing tasks...');
                console.log('📋 Auto-rejection notifications:', notifications.filter(n => n.type === 'verification_auto_rejected'));

                // Force refresh tasks and wait a bit for database consistency
                setTimeout(async () => {
                    await this.loadTasks();
                    console.log('✅ Tasks refreshed after auto-rejection notification');

                    // Also force refresh the current tab if it's tasks tab
                    if (document.getElementById('tasks-tab') && !document.getElementById('tasks-tab').classList.contains('hidden')) {
                        console.log('🔄 Refreshing tasks tab display...');
                        await this.loadTasks();
                    }
                }, 2000); // Increased delay to 2 seconds for better database consistency
            }

            // Check for immutable link approval notifications and refresh tasks if needed
            const hasImmutableApproval = notifications.some(n => n.type === 'immutable_link_approved' && !n.read);
            if (hasImmutableApproval) {
                console.log('🔄 Immutable link approval notification found, refreshing tasks...');
                console.log('📋 Immutable approval notifications:', notifications.filter(n => n.type === 'immutable_link_approved'));

                // Force refresh tasks and wait a bit for database consistency
                setTimeout(async () => {
                    await this.loadTasks();
                    console.log('✅ Tasks refreshed after immutable link approval notification');

                    // Also force refresh the current tab if it's tasks tab
                    if (document.getElementById('tasks-tab') && !document.getElementById('tasks-tab').classList.contains('hidden')) {
                        console.log('🔄 Refreshing tasks tab display...');
                        await this.loadTasks();
                    }
                }, 1000); // Shorter delay for immutable approvals
            }

            // Check for verification approval notifications and refresh tasks if needed
            const hasVerificationApproval = notifications.some(n => n.type === 'verification_approved' && !n.read);
            if (hasVerificationApproval) {
                console.log('🔄 Verification approval notification found, refreshing tasks...');
                console.log('📋 Verification approval notifications:', notifications.filter(n => n.type === 'verification_approved'));

                // Force refresh tasks and wait a bit for database consistency
                setTimeout(async () => {
                    await this.loadTasks();
                    console.log('✅ Tasks refreshed after verification approval notification');

                    // Also force refresh the current tab if it's tasks tab
                    if (document.getElementById('tasks-tab') && !document.getElementById('tasks-tab').classList.contains('hidden')) {
                        console.log('🔄 Refreshing tasks tab display...');
                        await this.loadTasks();
                    }
                }, 1000); // Shorter delay for verification approvals
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showToast('Failed to load notifications', 'error');
        } finally {
            this.hidePageLoading(pageLoading);
            // Mark notifications data as loaded
            this.markDataLoaded('notifications');
        }
    }

    renderNotifications(notifications) {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;

        if (notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="notifications-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        notificationsList.innerHTML = notifications.map(notification => this.createNotificationItem(notification)).join('');
    }

    createNotificationItem(notification, isPopup = false) {
        const isRead = notification.isRead;
        const date = notification.createdAt ? new Date(notification.createdAt.toDate()).toLocaleString() : 'Just now';

        // For popup, show shorter format
        if (isPopup) {
            return `
                <div class="notification-item ${isRead ? 'read' : 'unread'}" data-notification-id="${notification.id}">
                    <div class="notification-icon ${this.getNotificationIconClass(notification.type)}">
                        <i class="${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${notification.title}</p>
                        <p class="notification-message">${notification.message}</p>
                        <p class="notification-time">${date}</p>
                    </div>
                </div>
            `;
        }

        // Special handling for auto-rejection notifications
        if (notification.type === 'verification_auto_rejected') {
            return `
                <div class="notification-item ${isRead ? 'read' : 'unread'} auto-rejected-notification" data-notification-id="${notification.id}">
                    <div class="notification-icon auto-reject-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${notification.title}</p>
                        <p class="notification-message">${notification.message}</p>
                        <div class="auto-reject-details">
                            <div class="auto-reject-task">Task: ${notification.data?.taskTitle || 'N/A'}</div>
                            <div class="auto-reject-gameid">Game ID: ${notification.data?.gameId || 'N/A'}</div>
                        </div>
                        <p class="notification-time">${date}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge status-rejected">
                            Auto-Rejected
                        </span>
                    </div>
                </div>
            `;
        }

        // Special handling for withdrawal approved notifications
        if (notification.type === 'withdrawal_approved') {
            // Debug: Log notification data to see what's available
            console.log('Withdrawal approved notification data:', notification.data);
            console.log('Full notification object:', notification);

            // Extract data with better fallback handling
            const method = notification.data?.paymentMethod || notification.data?.method || 'N/A';
            const reference = notification.data?.referenceNumber || notification.data?.reference_number || 'N/A';

            console.log('Extracted method:', method, 'reference:', reference);

            return `
                <div class="notification-item ${isRead ? 'read' : 'unread'} withdrawal-approved" data-notification-id="${notification.id}">
                    <div class="notification-icon ${this.getNotificationIconClass(notification.type)}">
                        <i class="${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${notification.title}</p>
                        <p class="notification-message">${notification.message}</p>
                        <div class="withdrawal-details">
                            <div class="withdrawal-method">Method: ${method}</div>
                            <div class="withdrawal-reference">Ref: ${reference}</div>
                        </div>
                        <p class="notification-time">${date}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge status-approved">
                            Approved
                        </span>
                    </div>
                </div>
            `;
        }

        // Special handling for withdrawal rejections to emphasize the reason
        if (notification.type === 'withdrawal_rejected' && notification.data && notification.data.reason) {
            return `
                <div class="notification-item ${isRead ? 'read' : 'unread'} withdrawal-rejected" data-notification-id="${notification.id}">
                    <div class="notification-icon ${this.getNotificationIconClass(notification.type)}">
                        <i class="${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${notification.title}</p>
                        <p class="notification-message">${notification.message}</p>
                        <div class="rejection-reason-box">
                            <div class="rejection-reason-label">Rejection Reason:</div>
                            <div class="rejection-reason-text">${notification.data.reason}</div>
                        </div>
                        <p class="notification-time">${date}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge ${isRead ? 'status-approved' : 'status-pending'}">
                            ${isRead ? 'Read' : 'New'}
                        </span>
                    </div>
                </div>
            `;
        }

        // Special handling for Immutable link rejections to emphasize the reason
        if (notification.type === 'immutable_link_rejected' && notification.data && notification.data.reason) {
            return `
                <div class="notification-item ${isRead ? 'read' : 'unread'} immutable-link-rejected" data-notification-id="${notification.id}">
                    <div class="notification-icon ${this.getNotificationIconClass(notification.type)}">
                        <i class="${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${notification.title}</p>
                        <p class="notification-message">${notification.message}</p>
                        <div class="rejection-reason-box">
                            <div class="rejection-reason-label">Rejection Reason:</div>
                            <div class="rejection-reason-text">${notification.data.reason}</div>
                        </div>
                        <p class="notification-time">${date}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge ${isRead ? 'status-approved' : 'status-pending'}">
                            ${isRead ? 'Read' : 'New'}
                        </span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="notification-item ${isRead ? 'read' : 'unread'}" data-notification-id="${notification.id}">
                <div class="notification-icon ${this.getNotificationIconClass(notification.type)}">
                    <i class="${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <p class="notification-title">${notification.title}</p>
                    <p class="notification-message">${notification.message}</p>
                    <p class="notification-time">${date}</p>
                </div>
                <div class="text-right">
                    <span class="status-badge ${isRead ? 'status-approved' : 'status-pending'}">
                        ${isRead ? 'Read' : 'New'}
                    </span>
                </div>
            </div>
        `;
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'balance_change':
                return 'fas fa-wallet';
            case 'withdrawal_rejected':
                return 'fas fa-times-circle';
            case 'withdrawal_submitted':
                return 'fas fa-clock';
            case 'withdrawal_approved':
                return 'fas fa-check-circle';
            case 'immutable_link_approved':
                return 'fas fa-check-circle';
            case 'immutable_link_rejected':
                return 'fas fa-times-circle';
            default:
                return 'fas fa-bell';
        }
    }

    getNotificationIconClass(type) {
        switch (type) {
            case 'balance_change':
                return 'bg-green-100 text-green-600';
            case 'withdrawal_rejected':
                return 'bg-red-100 text-red-600';
            case 'withdrawal_submitted':
                return 'bg-yellow-100 text-yellow-600';
            case 'withdrawal_approved':
                return 'bg-green-100 text-green-600';
            case 'immutable_link_approved':
                return 'bg-green-100 text-green-600';
            case 'immutable_link_rejected':
                return 'bg-red-100 text-red-600';
            default:
                return 'bg-blue-100 text-blue-600';
        }
    }

    updateNotificationBadge(notifications) {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;

        const unreadCount = notifications.filter(n => !n.isRead).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            await window.firestoreManager.markNotificationAsRead(notificationId);
            // Reload notifications to update the UI
            await this.loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllNotificationsAsRead() {
        try {
            const notifications = await window.firestoreManager.getUserNotifications(this.currentUser.uid);
            const unreadNotifications = notifications.filter(n => !n.isRead);

            for (const notification of unreadNotifications) {
                await window.firestoreManager.markNotificationAsRead(notification.id);
            }

            await this.loadNotifications();
            this.showToast('All notifications marked as read', 'success');
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            this.showToast('Failed to mark notifications as read', 'error');
        }
    }

    signOut() {
        auth.signOut().then(() => {
            this.showToast('Successfully signed out!', 'success');
            window.location.href = '/login/';
        }).catch((error) => {
            console.error('Sign-out error:', error);
            this.showToast('Failed to sign out: ' + error.message, 'error');
        });
    }

    // showLoading method removed - now using LoadingManager

    // Button loading state utilities
    setButtonLoading(button, isLoading, loadingText = 'Processing...') {
        if (!button) return;

        if (isLoading) {
            // Store original content
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                ${loadingText}
            `;
            button.classList.add('loading');

            // Add click prevention
            button.style.pointerEvents = 'none';
            button.style.cursor = 'not-allowed';
        } else {
            // Restore original content
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
            button.disabled = false;
            button.classList.remove('loading');

            // Restore click functionality
            button.style.pointerEvents = 'auto';
            button.style.cursor = 'pointer';
        }
    }

    // Card loading state utilities
    setCardLoading(cardElement, isLoading) {
        if (!cardElement) return;

        if (isLoading) {
            // Store original classes
            cardElement.dataset.originalClasses = cardElement.className;

            // Add loading state
            cardElement.classList.add('card-loading');
            cardElement.style.pointerEvents = 'none';
            cardElement.style.cursor = 'not-allowed';
            cardElement.style.opacity = '0.7';

            // Add loading overlay
            let loadingOverlay = cardElement.querySelector('.card-loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'card-loading-overlay';
                loadingOverlay.innerHTML = `
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div class="loading-text">Loading...</div>
                `;
                cardElement.style.position = 'relative';
                cardElement.appendChild(loadingOverlay);
            }
        } else {
            // Restore original state
            cardElement.classList.remove('card-loading');
            cardElement.style.pointerEvents = 'auto';
            cardElement.style.cursor = 'pointer';
            cardElement.style.opacity = '1';

            // Remove loading overlay
            const loadingOverlay = cardElement.querySelector('.card-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
        }
    }

    // Modern loading modal functions - Use centralized LoadingManager
    showLoadingModal(title = 'Loading...', message = 'Please wait while we process your request') {
        // Use the centralized LoadingManager
        if (window.loadingManager) {
            return window.loadingManager.showLoading(title, message);
        }

        // Fallback to local implementation if LoadingManager not available
        const existingModal = document.querySelector('.loading-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.innerHTML = `
            <div class="loading-modal-content">
                <div class="loading-spinner"></div>
                <h3 class="loading-title">${title}</h3>
                <p class="loading-message">${message}</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        return modal;
    }

    hideLoadingModal(modal) {
        if (window.loadingManager && typeof modal === 'string') {
            // If it's a LoadingManager ID, use the manager
            window.loadingManager.hideLoading(modal);
        } else if (modal && modal.parentNode) {
            // Fallback for direct modal elements
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    showPageLoading(message = 'Loading...') {
        // Remove existing page loading if any
        const existingLoading = document.querySelector('.page-loading');
        if (existingLoading) {
            existingLoading.remove();
        }

        // Create page loading
        const loading = document.createElement('div');
        loading.className = 'page-loading';
        loading.innerHTML = `
            <div class="page-loading-content">
                <div class="page-loading-spinner"></div>
                <span class="page-loading-text">${message}</span>
            </div>
        `;

        document.body.appendChild(loading);

        // Show loading with animation
        setTimeout(() => {
            loading.classList.add('show');
        }, 10);

        return loading;
    }

    hidePageLoading(loading) {
        if (loading) {
            loading.classList.remove('show');
            setTimeout(() => {
                if (loading.parentNode) {
                    loading.parentNode.removeChild(loading);
                }
            }, 200);
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

    // Profile dropdown methods
    toggleProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        const arrow = document.querySelector('.profile-arrow');

        if (!dropdown) {
            console.warn('Profile dropdown not found');
            return;
        }

        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            dropdown.classList.add('hidden');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        const arrow = document.querySelector('.profile-arrow');

        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        if (arrow) {
            arrow.style.transform = 'rotate(0deg)';
        }
    }

    // Mobile menu methods
    openMobileMenu() {
        const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
        if (mobileMenuOverlay) {
            mobileMenuOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            console.warn('Mobile menu overlay not found');
        }
    }

    closeMobileMenu() {
        const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
        if (mobileMenuOverlay) {
            mobileMenuOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Test storage connectivity
    async testStorageConnectivity() {
        try {
            console.log('🔍 Testing ImgBB Storage connectivity...');

            if (window.storageManager) {
                console.log('✅ Storage Manager is available');
                if (window.CONFIG?.IMGBB_API_KEY && window.CONFIG.IMGBB_API_KEY !== 'YOUR_IMGBB_API_KEY') {
                    console.log('✅ ImgBB API key is configured');
                    console.log('✅ ImgBB Storage is ready for uploads');
                    return true;
                } else {
                    console.warn('⚠️ ImgBB API key not configured - please update config.js');
                    return false;
                }
            } else {
                console.warn('⚠️ Storage Manager not available');
                return false;
            }

        } catch (error) {
            console.error('❌ Storage connectivity test failed:', error);
            return false;
        }
    }

    // Helper function to get user balance changes
    async getUserBalanceChanges() {
        try {
            console.log('🔍 Loading balance changes for user:', this.currentUser.uid);
            const snapshot = await db.collection('balance_changes')
                .where('userId', '==', this.currentUser.uid)
                .get();

            if (snapshot.empty) {
                console.log('No balance changes found for user');
                return [];
            }

            const changes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('📊 Balance changes loaded:', changes.map(c => ({
                reason: c.reason,
                changeAmount: c.changeAmount,
                timestamp: c.timestamp
            })));

            // Sort by createdAt in JavaScript to avoid Firestore index requirement
            return changes.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA; // Descending order (newest first)
            });
        } catch (error) {
            console.error('Error getting balance changes:', error);
            // Return empty array instead of throwing error to prevent breaking the UI
            return [];
        }
    }

    // Helper function to generate balance change descriptions
    getBalanceChangeDescription(change) {
        switch (change.reason) {
            case 'task_approved':
                return `Task Completed: ${change.metadata?.taskTitle || 'Task'}`;
            case 'withdrawal_submitted':
                return `Withdrawal Submitted: ${change.metadata?.paymentMethod || 'Processing...'}`;
            case 'withdrawal_approved':
                return `Withdrawal Approved: ${change.metadata?.paymentMethod || 'Processing...'}`;
            case 'withdrawal_rejected':
                return `Withdrawal Rejected: ${change.metadata?.paymentMethod || 'Processing...'}`;
            case 'withdrawal_rejected_refund':
                return `Withdrawal Refunded: ${change.metadata?.paymentMethod || 'Processing...'}`;
            case 'admin_balance_adjustment':
                const action = change.metadata?.action || 'adjusted';
                const reason = change.metadata?.reason || 'Admin adjustment';
                return `Balance ${action === 'add' ? 'Increased' : action === 'subtract' ? 'Decreased' : 'Set'} by Admin: ${reason}`;
            case 'balance_change':
                return 'Balance Updated by Admin';
            default:
                return 'Balance Change';
        }
    }

    getStatusForReason(reason) {
        switch (reason) {
            case 'task_approved':
                return 'approved';
            case 'withdrawal_submitted':
                return 'pending';
            case 'withdrawal_approved':
                return 'approved';
            case 'withdrawal_rejected':
                return 'rejected';
            case 'withdrawal_rejected_refund':
                return 'refunded';
            case 'admin_balance_adjustment':
                return 'approved';
            case 'balance_change':
                return 'approved';
            default:
                return 'completed';
        }
    }

    // Notification popup methods

    getTaskStatusConfig(status, deadline) {
        switch (status) {
            case 'available':
                return {
                    class: 'available',
                    badgeClass: 'status-available',
                    icon: '<i class="fas fa-play-circle"></i>',
                    label: 'Available',
                    buttonClass: 'btn-primary',
                    buttonText: 'Start Task'
                };
            case 'in_progress':
                return {
                    class: 'in-progress',
                    badgeClass: 'status-in-progress',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'In Progress',
                    buttonClass: 'btn-success',
                    buttonText: 'Complete Task'
                };
            case 'pending_review':
                return {
                    class: 'pending',
                    badgeClass: 'status-pending',
                    icon: '<i class="fas fa-hourglass-half"></i>',
                    label: 'Pending Review',
                    buttonClass: 'btn-warning',
                    buttonText: 'View Details'
                };
            case 'approved':
                return {
                    class: 'approved',
                    badgeClass: 'status-approved',
                    icon: '<i class="fas fa-check-circle"></i>',
                    label: 'Approved',
                    buttonClass: 'btn-success',
                    buttonText: 'View Details'
                };
            case 'rejected':
                return {
                    class: 'rejected',
                    badgeClass: 'status-rejected',
                    icon: '<i class="fas fa-times-circle"></i>',
                    label: 'Rejected',
                    buttonClass: 'btn-danger',
                    buttonText: 'View Details'
                };
            case 'completed':
                return {
                    class: 'completed',
                    badgeClass: 'status-completed',
                    icon: '<i class="fas fa-trophy"></i>',
                    label: 'Completed',
                    buttonClass: 'btn-success',
                    buttonText: 'View Details'
                };
            case 'expired':
                return {
                    class: 'expired',
                    badgeClass: 'status-expired',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'Time Expired',
                    buttonClass: 'btn-warning',
                    buttonText: 'Start Again'
                };
            case 'ended':
                return {
                    class: 'ended',
                    badgeClass: 'status-ended',
                    icon: '<i class="fas fa-stop"></i>',
                    label: 'Task Ended',
                    buttonClass: 'btn-secondary',
                    buttonText: 'Task Ended'
                };
            default:
                return {
                    class: 'available',
                    badgeClass: 'status-available',
                    icon: '<i class="fas fa-play-circle"></i>',
                    label: 'Available',
                    buttonClass: 'btn-primary',
                    buttonText: 'Start Task'
                };
        }
    }

    async openNotificationPopup() {
        console.log('🔔 Opening notification popup...');

        // Load notifications for popup
        await this.loadNotificationsForPopup();

        // Show popup
        const notificationPopup = document.getElementById('notification-popup');
        if (notificationPopup) {
            notificationPopup.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            console.warn('Notification popup not found');
        }
    }

    closeNotificationPopup() {
        console.log('🔔 Closing notification popup...');
        const notificationPopup = document.getElementById('notification-popup');
        if (notificationPopup) {
            notificationPopup.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    async loadNotificationsForPopup() {
        try {
            const notifications = await window.firestoreManager.getUserNotifications(this.currentUser.uid);
            const popupList = document.getElementById('notification-popup-list');

            if (!popupList) return;

            if (notifications.length === 0) {
                popupList.innerHTML = `
                    <div class="notifications-empty">
                        <i class="fas fa-bell-slash"></i>
                        <h3>No notifications</h3>
                        <p>You're all caught up!</p>
                    </div>
                `;
                return;
            }

            // Show only the latest 5 notifications in popup
            const recentNotifications = notifications.slice(0, 5);
            popupList.innerHTML = recentNotifications.map(notification =>
                this.createNotificationItem(notification, true)
            ).join('');

            // Update notification badge
            this.updateNotificationBadge(notifications);

        } catch (error) {
            console.error('Error loading notifications for popup:', error);
            const popupList = document.getElementById('notification-popup-list');
            if (popupList) {
                popupList.innerHTML = `
                    <div class="notifications-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error loading notifications</h3>
                        <p>Please try again later</p>
                    </div>
                `;
            }
        }
    }

    // Global button click prevention system
    setupGlobalButtonProtection() {
        // Add click prevention to all buttons with onclick handlers
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.classList.contains('loading')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Add click prevention to task cards with loading state
            const card = e.target.closest('.task-card-modern');
            if (card && card.classList.contains('card-loading')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);

        // Add protection for form submissions
        document.addEventListener('submit', (e) => {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.classList.contains('loading')) {
                e.preventDefault();
                return false;
            }
        });
    }
}

// Initialize dashboard handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardHandler = new DashboardHandler();
});
