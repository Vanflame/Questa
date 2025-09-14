// Dashboard Page Handler
class DashboardHandler {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.isSubmittingWithdrawal = false;
        this.lastWithdrawalTime = null;
        this.withdrawalCooldown = 5000; // 5 seconds cooldown
        this.init();
    }

    init() {
        console.log('📱 Initializing Dashboard Handler...');

        // Initialize withdrawal state from localStorage
        this.initializeWithdrawalState();

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

                // Test storage connectivity
                await this.testStorageConnectivity();
            } else {
                console.log('👤 No user, redirecting to login...');
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
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async showAccountDisabledNotice() {
        const tasksGrid = document.getElementById('tasks-grid');
        if (tasksGrid) {
            // Get support email from settings
            let supportEmail = 'support@example.com';
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
        }
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
                this.submitWithdrawal();
            });
        }

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeAllModals();
            }
        });
    }

    setupTabNavigation() {
        // Default to tasks tab so users can see available tasks immediately
        this.switchTab('tasks');
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

    async loadTasks() {
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
                return;
            }

            console.log('Loading tasks...');
            const tasks = await window.firestoreManager.getTasks();
            console.log('Tasks loaded:', tasks);

            // Filter only active tasks for users
            const activeTasks = tasks.filter(task => task.status === 'active');
            console.log('Active tasks:', activeTasks);

            // Log deadline information for debugging
            activeTasks.forEach((task, index) => {
                console.log(`Task ${index} (${task.title}):`, {
                    hasDeadline: !!task.deadline,
                    deadline: task.deadline,
                    deadlineType: typeof task.deadline,
                    deadlineFormatted: this.formatDeadlineForTimer(task.deadline),
                    duration: task.duration,
                    userTimeLimit: task.userTimeLimit,
                    userTimeLimitType: typeof task.userTimeLimit
                });
            });

            this.renderTasks(activeTasks);

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
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showToast('Failed to load tasks: ' + error.message, 'error');
            this.renderTasks([]);
        }

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
                return 'Expired';
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
        if (task.deadline) {
            const result = this.calculateDeadlineDisplay(task.deadline);
            console.log(`📅 Using task deadline: ${result}`);
            return result;
        } else if (task.userTimeLimit) {
            // Convert minutes to appropriate display format
            const minutes = task.userTimeLimit;
            let result;
            if (minutes < 60) {
                result = `${minutes}m`;
            } else if (minutes < 1440) { // Less than 24 hours
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                result = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
            } else {
                const days = Math.floor(minutes / 1440);
                const remainingHours = Math.floor((minutes % 1440) / 60);
                result = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
            }
            console.log(`⏰ Using userTimeLimit as fallback (${minutes} minutes): ${result}`);
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

        // Also check if task status indicates it's started (pending, dns_setup, etc.)
        const taskStatus = task.userStatus || 'available';
        const isTaskStarted = taskStatus === 'pending' || taskStatus === 'dns_setup' || taskStatus === 'unlocked';
        const isTaskCompleted = taskStatus === 'complete' || taskStatus === 'completed';

        // If task is completed, don't show countdown
        if (isTaskCompleted) {
            console.log(`✅ Task completed - not showing countdown for ${task.title}`);
            return 'Completed';
        }

        if ((storedStartTime || isTaskStarted) && task.userTimeLimit) {
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
        } else if (task.userTimeLimit) {
            // User hasn't started - show static user time limit
            const minutes = task.userTimeLimit;
            let result;
            if (minutes < 60) {
                result = `${minutes}m`;
            } else if (minutes < 1440) { // Less than 24 hours
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                result = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
            } else {
                const days = Math.floor(minutes / 1440);
                const remainingHours = Math.floor((minutes % 1440) / 60);
                result = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
            }
            console.log(`⏰ User time display (${minutes} minutes): ${result}`);
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
                } else if (task.userTimeLimit) {
                    // Convert minutes to appropriate display format
                    const minutes = task.userTimeLimit;
                    if (minutes < 60) {
                        return `${minutes}m`;
                    } else if (minutes < 1440) { // Less than 24 hours
                        const hours = Math.floor(minutes / 60);
                        const remainingMinutes = minutes % 60;
                        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
                    } else {
                        const days = Math.floor(minutes / 1440);
                        const remainingHours = Math.floor((minutes % 1440) / 60);
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
            if (task.userTimeLimit) {
                // Use custom user time limit if set (in minutes)
                userCompletionDeadline = new Date(startTime.getTime() + (task.userTimeLimit * 60 * 1000));
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
            if (!startTime || !task.userTimeLimit) {
                return this.calculateRemainingTimeForUserSync(task);
            }

            const now = new Date();
            const start = new Date(startTime);
            const userCompletionDeadline = new Date(start.getTime() + (task.userTimeLimit * 60 * 1000));

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
                    const taskDeadlineText = task.deadline ? this.calculateDeadlineDisplay(task.deadline) : 'No Deadline';
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
        const tasksGrid = document.getElementById('tasks-grid');
        if (!tasksGrid) return;

        if (tasks.length === 0) {
            tasksGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No tasks available</h3>
                    <p class="text-gray-500">Check back later for new tasks!</p>
                </div>
            `;
            return;
        }

        // Load task statuses and completion counts for all tasks
        const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
            const status = await this.getTaskStatusForUser(task);
            const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, task.id);

            console.log(`📊 Loading task: ${task.title}`, {
                completionCount: completionCount,
                maxCompletions: task.maxCompletions || 1,
                status: status
            });

            // Store start time in localStorage if task is started
            if (status.startedAt) {
                const startTimeKey = `task_start_${task.id}_${this.currentUser.uid}`;
                const startTime = status.startedAt.toDate ? status.startedAt.toDate().toISOString() : status.startedAt;
                localStorage.setItem(startTimeKey, startTime);
                console.log(`💾 Stored start time for ${task.title}: ${startTime}`);

                // Sync timer data to database for admin view
                if (window.syncTimerToDatabase) {
                    window.syncTimerToDatabase(task.id, startTime);
                }
            }

            return {
                ...task,
                userStatus: status,
                completionCount: completionCount,
                maxCompletions: task.maxCompletions || 1
            };
        }));

        tasksGrid.innerHTML = tasksWithStatus.map(task => {
            return this.createTaskCard(task);
        }).join('');

        // Update remaining time displays after rendering
        this.updateRemainingTimeDisplays(tasksWithStatus);

        // Set up periodic updates for remaining time displays
        this.startRemainingTimeTimer(tasksWithStatus);

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
        window.debugCompletionCounts = async () => {
            console.log('🏆 Debugging completion counts...');
            try {
                const tasks = await window.firestoreManager.getTasks();
                for (const task of tasks) {
                    const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, task.id);
                    console.log(`Task: ${task.title}`, {
                        id: task.id,
                        completionCount: completionCount,
                        maxCompletions: task.maxCompletions || 1,
                        display: `${completionCount}/${task.maxCompletions || 1}`
                    });
                }
            } catch (error) {
                console.error('Error debugging completion counts:', error);
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
                // Update task status with start time for admin view
                await window.firestoreManager.updateTaskStatus(taskId, 'unlocked', this.currentUser.uid, {
                    startedAt: new Date(startTime),
                    timerSynced: true
                });
                console.log(`📡 Synced timer for task ${taskId} to database`);
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
                            await window.firestoreManager.updateTaskStatus(task.id, 'unlocked', this.currentUser.uid, {
                                startedAt: new Date(storedStartTime),
                                timerSynced: true
                            });
                            syncedCount++;
                            console.log(`📡 Synced existing timer for task ${task.title}`);
                        }
                    }
                }

                if (syncedCount > 0) {
                    this.showToast(`Synced ${syncedCount} existing timers to database for admin view`, 'success');
                }

            } catch (error) {
                console.error('Error syncing localStorage timers:', error);
            }
        };

        // Add function to restart a completed task
        window.restartTask = async (taskId) => {
            try {
                console.log(`🔄 Restarting task: ${taskId}`);

                // Clear any existing task status - set to 'available' to allow restart
                await window.firestoreManager.updateTaskStatus(taskId, 'available', this.currentUser.uid);

                // Clear the start time from localStorage
                window.clearTaskStartTime(taskId);

                // Clear the expired flag
                const expiredKey = `task_expired_${taskId}_${this.currentUser.uid}`;
                localStorage.removeItem(expiredKey);

                // Clear any completion flags or progress data
                const completionKey = `task_completed_${taskId}_${this.currentUser.uid}`;
                localStorage.removeItem(completionKey);

                // Clear any existing verifications for this task to start fresh
                const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
                const taskVerifications = verifications.filter(v => v.taskId === taskId);

                for (const verification of taskVerifications) {
                    await window.firestoreManager.deleteVerification(verification.id);
                }

                // Clear and restart all countdown timers to ensure fresh state
                if (this.countdownTimers) {
                    this.countdownTimers.forEach(timer => clearInterval(timer));
                    this.countdownTimers = [];
                }

                // Clear remaining time timer
                if (this.remainingTimeTimer) {
                    clearInterval(this.remainingTimeTimer);
                    this.remainingTimeTimer = null;
                }

                console.log('✅ Task restarted successfully with clean timer state');
                this.showToast('Task restarted! You can now begin again with a fresh timer.', 'success');

                // Refresh the tasks to show updated status and restart timers
                await this.loadTasks();

                // Restart timers after a short delay to ensure DOM is ready
                setTimeout(() => {
                    this.startCountdownTimers();
                }, 200);

            } catch (error) {
                console.error('Error restarting task:', error);
                this.showToast('Error restarting task. Please try again.', 'error');
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
        const taskStatus = task.userStatus || 'available';

        // Check if user time has expired
        const expiredKey = `task_expired_${task.id}_${this.currentUser.uid}`;
        const isUserTimeExpired = localStorage.getItem(expiredKey) === 'true';

        // Override status if user time expired
        const finalStatus = isUserTimeExpired ? 'expired' : taskStatus;

        const statusConfig = this.getTaskStatusConfig(finalStatus, task.deadline);

        // Get difficulty display
        const difficultyStars = this.getDifficultyStars(task.difficulty);

        // Get task deadline display (for badge - shows task availability)
        const taskDeadlineText = task.deadline ? this.calculateDeadlineDisplay(task.deadline) : 'No Deadline';

        // Get user time display (for duration section - shows user completion time)
        let userTimeText = this.calculateUserTimeDisplay(task);

        // Override user time display if expired
        if (isUserTimeExpired) {
            userTimeText = 'Expired';
        }

        // Get completion count display
        const completionCount = task.completionCount || 0;
        const maxCompletions = task.maxCompletions || 1;
        // Show completion count in X/Y format
        const completionText = `${completionCount}/${maxCompletions}`;

        return `
            <div class="task-card-modern ${statusConfig.class}" onclick="window.dashboardHandler.openTaskDetail('${task.id}')">
                <div class="task-card-header">
                    ${task.banner ? `
                        <img src="${task.banner}" alt="${task.title}" class="task-banner">
                    ` : `
                        <div class="task-hexagon-icon">
                            ${task.title.charAt(0).toUpperCase()}
                        </div>
                    `}
                    <div class="task-status-overlay">
                        <span class="task-status-badge ${statusConfig.badgeClass}">
                            ${statusConfig.icon} ${statusConfig.label}
                        </span>
                    </div>
                    ${task.deadline ? `
                        <div class="task-deadline-timer" data-deadline="${this.formatDeadlineForTimer(task.deadline)}">
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
                        <h3 class="task-title">${task.title}</h3>
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
                            <span class="detail-value">${task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="task-action-section">
                        ${finalStatus === 'expired' ? `
                            <button class="task-action-btn ${statusConfig.buttonClass}" onclick="event.stopPropagation(); window.restartTask('${task.id}')">
                                ${statusConfig.buttonText}
                            </button>
                        ` : `
                            <button class="task-action-btn ${statusConfig.buttonClass}" onclick="event.stopPropagation(); window.dashboardHandler.openTaskDetail('${task.id}')" ${taskStatus === 'disabled' ? 'disabled' : ''}>
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
            if (taskStatus && taskStatus.status && taskStatus.status !== 'locked') {
                console.log(`✅ Using taskStatuses status for ${task.title}:`, taskStatus.status);
                console.log(`🔍 Full taskStatus object:`, taskStatus);
                return taskStatus.status;
            }

            // Fallback to verification-based status for backward compatibility
            console.log(`⚠️ Falling back to verification-based status for ${task.title}`);
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === task.id);

            if (taskVerifications.length === 0) {
                return 'available';
            }

            const initialVerification = taskVerifications.find(v => v.phase === 'initial');
            const finalVerification = taskVerifications.find(v => v.phase === 'final');

            if (finalVerification && finalVerification.status === 'approved') {
                return 'complete';
            } else if (finalVerification && finalVerification.status === 'pending') {
                return 'pending';
            } else if (initialVerification && initialVerification.status === 'approved') {
                return 'unlocked';
            } else if (initialVerification && initialVerification.status === 'pending') {
                return 'pending';
            } else if (initialVerification && initialVerification.status === 'rejected') {
                return 'rejected';
            }

            return 'available';
        } catch (error) {
            console.error('Error getting user task status:', error);
            return 'available';
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
                    class: 'expired',
                    badgeClass: 'status-expired',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'Expired',
                    buttonText: 'Expired',
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
            case 'unlocked':
                return {
                    class: 'unlocked',
                    badgeClass: 'status-unlocked',
                    icon: '<i class="fas fa-clock"></i>',
                    label: 'In Progress',
                    buttonText: 'Continue Task',
                    buttonClass: 'btn-success'
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
                return {
                    class: 'completed',
                    badgeClass: 'status-completed',
                    icon: '<i class="fas fa-trophy"></i>',
                    label: 'Completed',
                    buttonText: 'Quest Finished',
                    buttonClass: 'btn-disabled'
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

    async openTaskDetail(taskId) {
        try {
            console.log('Opening task detail for:', taskId);

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            // Force refresh task status
            console.log('🔄 Force refreshing task status...');
            const taskStatus = await this.getUserTaskStatus(taskId);
            console.log('📊 Final task status for modal:', taskStatus);

            this.showTaskDetailModal(task, taskStatus);
        } catch (error) {
            console.error('Error opening task detail:', error);
            this.showToast('Failed to load task details', 'error');
        }
    }

    async getUserTaskStatus(taskId) {
        try {
            console.log('🔍 Getting task status for user:', this.currentUser.uid, 'task:', taskId);

            // Check quest completion count and limits
            const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, taskId);
            const task = await window.firestoreManager.getTask(taskId);
            const maxCompletions = task?.maxCompletions || 1; // Default to 1 if not set

            console.log(`📊 Quest completion count: ${completionCount}/${maxCompletions}`);

            // If user has reached max completions, show as completed
            if (completionCount >= maxCompletions) {
                return {
                    status: 'completed',
                    phase: 'final',
                    completionCount: completionCount,
                    maxCompletions: maxCompletions
                };
            }

            // First check for custom task status (DNS setup, Immutable link, etc.)
            const taskStatus = await window.firestoreManager.getTaskStatusForUser(this.currentUser.uid, taskId);
            console.log('📊 Task status from taskStatuses collection:', taskStatus);

            // If we have a custom task status, use it
            if (taskStatus.status !== 'locked') {
                console.log('✅ Using task status from taskStatuses:', taskStatus.status);
                return {
                    ...taskStatus,
                    completionCount: completionCount,
                    maxCompletions: maxCompletions
                };
            }

            console.log('⚠️ Task status was locked, falling back to verification-based status');

            // Fallback to verification-based status
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);

            if (taskVerifications.length === 0) {
                return { status: 'available', phase: null };
            }

            const initialVerification = taskVerifications.find(v => v.phase === 'initial');
            const finalVerification = taskVerifications.find(v => v.phase === 'final');

            if (finalVerification && finalVerification.status === 'approved') {
                return { status: 'complete', phase: 'final', verification: finalVerification };
            } else if (finalVerification && finalVerification.status === 'pending') {
                return { status: 'pending', phase: 'final', verification: finalVerification };
            } else if (initialVerification && initialVerification.status === 'approved') {
                return { status: 'unlocked', phase: 'initial', verification: initialVerification };
            } else if (initialVerification && initialVerification.status === 'pending') {
                return { status: 'pending', phase: 'initial', verification: initialVerification };
            } else if (initialVerification && initialVerification.status === 'rejected') {
                return { status: 'rejected', phase: 'initial', verification: initialVerification };
            }

            return { status: 'available', phase: null };
        } catch (error) {
            console.error('Error getting user task status:', error);
            return { status: 'available', phase: null };
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
            <div class="modal-container task-detail-container">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="flex items-center mt-2">
                            <span class="status-badge ${statusConfig.badgeClass} mr-3">
                                ${statusConfig.icon} ${statusConfig.label}
                            </span>
                            <span class="text-2xl font-bold text-green-600">₱${task.reward}</span>
                        </div>
                    </div>
                    <button id="close-task-detail-modal" class="modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="modal-form">
                    ${task.banner ? `
                        <div class="mb-6">
                            <img src="${task.banner}" alt="${task.title}" class="w-full h-48 object-cover rounded-lg">
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
                                <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="5,3 19,12 5,21"></polygon>
                                    </svg>
                                    Start Task
                                </button>
                            ` : taskStatus.status === 'unlocked' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 12l2 2 4-4"></path>
                                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                                    </svg>
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
                                <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 12l2 2 4-4"></path>
                                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                                    </svg>
                                    Continue Task
                                </button>
                            ` : taskStatus.status === 'ready_for_phase2' ? `
                                <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 12l2 2 4-4"></path>
                                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                                    </svg>
                                    Continue Task
                                </button>
                            ` : taskStatus.status === 'complete' ? `
                                <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                                        <h5 class="font-medium text-green-800">Quest Completed!</h5>
                                    </div>
                                    <p class="text-sm text-green-700 mb-3">Congratulations! You have successfully completed this quest and earned ₱${task.reward}.</p>
                                    <div class="flex items-center justify-between">
                                        <div class="text-sm text-green-600">
                                            <span class="font-medium">Completions:</span> ${taskStatus.completionCount || 0}/${taskStatus.maxCompletions || 1}
                                        </div>
                                        <button onclick="window.dashboardHandler.restartQuest('${task.id}')" class="btn-success">
                                            <i class="fas fa-redo mr-1"></i>
                                            Restart Quest
                                        </button>
                                    </div>
                                </div>
                            ` : taskStatus.status === 'completed' ? `
                                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-trophy text-purple-500 mr-2"></i>
                                        <h5 class="font-medium text-purple-800">Quest Finished</h5>
                                    </div>
                                    <p class="text-sm text-purple-700 mb-3">You have reached the maximum number of completions for this quest (${taskStatus.maxCompletions || 1}).</p>
                                    <div class="text-sm text-purple-600">
                                        <span class="font-medium">Total Completions:</span> ${taskStatus.completionCount || 0}/${taskStatus.maxCompletions || 1}
                                    </div>
                                </div>
                            ` : taskStatus.status === 'rejected' ? `
                                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-center mb-2">
                                        <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                                        <h5 class="font-medium text-red-800">Application Rejected</h5>
                                    </div>
                                    <p class="text-sm text-red-700 mb-3">Your initial application was rejected. Please review the requirements and resubmit your application.</p>
                                    <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-warning">
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
                                    <button onclick="window.dashboardHandler.startTask('${task.id}')" class="btn-warning">
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

    async startTask(taskId) {
        try {
            console.log('Starting task:', taskId);

            // Get task details
            const tasks = await window.firestoreManager.getTasks();
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            console.log('Found task:', task);
            console.log('Task ID:', task.id);

            // Check completion limits before allowing user to start
            const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, taskId);
            const maxCompletions = task?.maxCompletions || 1;

            if (completionCount >= maxCompletions) {
                this.showToast(`You have reached the maximum completions (${maxCompletions}) for this quest.`, 'error');
                return;
            }

            // Close any existing modals
            const existingModal = document.getElementById('task-detail-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Get current task status
            const taskStatus = await this.getUserTaskStatus(taskId);
            console.log('Current task status:', taskStatus);

            if (taskStatus.status === 'available') {
                // Show Phase 1 verification modal (Android version will be captured here)
                this.showPhase1VerificationModal(task);
            } else if (taskStatus.status === 'unlocked') {
                // Show DNS setup step before Phase 2
                this.showDNSSetupModal(task, taskId);
            } else if (taskStatus.status === 'dns_setup') {
                // Show Immutable link capture step
                this.showImmutableLinkModal(task);
            } else if (taskStatus.status === 'pending') {
                // Show waiting message for admin review
                this.showToast('Your submission is under review. Please wait for admin approval.', 'info');
                return;
            } else if (taskStatus.status === 'ready_for_phase2') {
                // Show Phase 2 verification modal
                console.log('🎯 Task status is ready_for_phase2, showing Phase 2 modal');
                this.showPhase2VerificationModal(task);
            } else if (taskStatus.status === 'rejected_resubmission') {
                // Show Phase 2 verification modal for resubmission
                console.log('🎯 Task status is rejected_resubmission, showing Phase 2 modal for resubmission');
                this.showPhase2VerificationModal(task);
                this.showToast('Your final verification was rejected. Please resubmit with the correct information.', 'warning');
            } else if (taskStatus.status === 'rejected') {
                // Show Phase 1 verification modal for resubmission
                this.showPhase1VerificationModal(task);
                this.showToast('Please resubmit your application with the required information.', 'info');
            } else {
                this.showToast('Task cannot be started at this time.', 'error');
                return;
            }

            // Reload tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('Error starting task:', error);
            this.showToast('Failed to start task: ' + error.message, 'error');
        }
    }

    showDNSSetupModal(task, taskId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Get DNS configuration from task
        const dnsConfig = task.dnsConfig || {};
        const serverAddress = dnsConfig.serverAddress || '36413b.dns.nextdns.io';
        const customInstructions = dnsConfig.customInstructions;

        // Use passed taskId or fallback to task.id
        const actualTaskId = taskId || task.id;

        if (!actualTaskId) {
            console.error('Task missing ID:', task);
            this.showToast('Task ID missing', 'error');
            return;
        }

        console.log('Creating DNS setup modal for task:', actualTaskId, task.title);

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container max-w-2xl">
                <div class="modal-header">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-network-wired text-blue-600"></i>
                        </div>
                        <div>
                            <h3 class="modal-title text-xl font-semibold">DNS Configuration Required</h3>
                            <p class="text-sm text-gray-600 mt-1">${task.title}</p>
                        </div>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                    
                <div class="modal-body">
                    <!-- Info Section -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-info-circle text-blue-600 text-sm"></i>
                            </div>
                            <div>
                                <h4 class="text-blue-800 font-semibold mb-2">Private DNS Setup Required</h4>
                                <p class="text-blue-700 text-sm leading-relaxed">
                                    Configure your device's DNS settings to capture the Immutable link without auto-redirect.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Instructions Section -->
                    ${customInstructions ? `
                        <div class="mb-4">
                            <h4 class="text-sm font-semibold text-gray-900 mb-3">Custom DNS Setup Instructions</h4>
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <pre class="text-sm text-gray-700 whitespace-pre-wrap">${customInstructions}</pre>
                            </div>
                        </div>
                    ` : `
                        <div class="mb-4">
                            <h4 class="text-sm font-semibold text-gray-900 mb-3">Setup Instructions</h4>
                            <div class="space-y-3">
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</div>
                                    <div>
                                        <p class="font-medium text-gray-900 text-sm">Open Android Settings</p>
                                        <p class="text-xs text-gray-600">Settings → Network & Internet → Advanced</p>
                                    </div>
                                </div>

                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</div>
                                    <div>
                                        <p class="font-medium text-gray-900 text-sm">Select Private DNS</p>
                                        <p class="text-xs text-gray-600">Tap on "Private DNS" option</p>
                                    </div>
                                </div>
                                
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">3</div>
                                    <div>
                                        <p class="font-medium text-gray-900 text-sm">Choose Provider Hostname</p>
                                        <p class="text-xs text-gray-600">Select "Private DNS provider hostname"</p>
                                    </div>
                                </div>
                                
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">4</div>
                                    <div>
                                        <p class="font-medium text-gray-900 text-sm">Enter DNS Address</p>
                                        <div class="mt-2">
                                            <div class="bg-gray-100 border border-gray-300 rounded-lg p-3 font-mono text-sm">
                                                <span class="text-gray-600">Enter this address:</span><br>
                                                <span class="text-blue-600 font-semibold">${serverAddress}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">5</div>
                                    <div>
                                        <p class="font-medium text-gray-900 text-sm">Save Settings</p>
                                        <p class="text-xs text-gray-600">Tap "Save" to apply the DNS settings</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}

                    <!-- Important Note -->
                    <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div class="flex items-start space-x-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-check-circle text-green-600 text-xs"></i>
                            </div>
                            <div>
                                <h4 class="text-green-800 font-semibold text-sm mb-1">Important</h4>
                                <p class="text-green-700 text-xs">
                                    DNS must be active before clicking the Immutable Connect link to prevent auto-redirect.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- DNS Verification Section -->
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                        <div class="flex items-center mb-3">
                            <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                <i class="fas fa-shield-alt text-purple-600 text-sm"></i>
                            </div>
                            <div>
                                <h4 class="text-purple-800 font-semibold text-sm">DNS Verification</h4>
                                <p class="text-purple-700 text-xs">Verify your DNS configuration before proceeding</p>
                            </div>
                        </div>
                        
                        <!-- DNS Server Address -->
                        <div class="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <span class="text-gray-600 text-xs font-medium">DNS Server Address:</span>
                                    <div class="mt-1">
                                        <span class="text-purple-600 font-semibold font-mono text-sm" id="dns-server-display">${serverAddress}</span>
                                    </div>
                                </div>
                                <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-md flex items-center space-x-1 transition-colors" onclick="window.dashboardHandler.copyDNSServer('${serverAddress}')">
                                    <i class="fas fa-copy text-xs"></i>
                                    <span>Copy</span>
                                </button>
                            </div>
                        </div>

                        <!-- Verify Button -->
                        <div class="flex items-center space-x-3">
                            <button type="button" class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md flex items-center space-x-2 transition-colors" onclick="window.dashboardHandler.checkDNSConfiguration('${serverAddress}')">
                                <i class="fas fa-shield-alt text-sm"></i>
                                <span>Verify DNS Configuration</span>
                            </button>
                            <div id="dns-check-result" class="flex items-center space-x-2 min-h-[32px]">
                                <!-- DNS check result will appear here -->
                            </div>
                        </div>
                        
                        <!-- Verification Note -->
                        <div class="bg-white border border-gray-200 rounded-lg p-2 mt-3">
                            <div class="flex items-start space-x-2">
                                <div class="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i class="fas fa-info-circle text-blue-500 text-xs"></i>
                                </div>
                                <div class="text-xs text-gray-600">
                                    <strong class="text-gray-800">Required:</strong> Verify that <code class="bg-gray-100 px-1 rounded text-xs">auth.immutable.com</code> is blocked to prevent auto-redirect.
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Modal Footer -->
                <div class="modal-footer bg-gray-50 px-6 py-4 rounded-b-xl">
                    <div class="flex items-center justify-between">
                        <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-md flex items-center space-x-2 transition-colors" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times text-sm"></i>
                            <span>Cancel</span>
                        </button>
                        <button type="button" class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2 rounded-md flex items-center space-x-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed" id="proceed-btn" data-task-id="${actualTaskId}" disabled>
                            <i class="fas fa-arrow-right text-sm"></i>
                            <span>Continue to Immutable Link</span>
                        </button>
                    </div>
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

    async copyDNSServer(dnsServer) {
        try {
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
        }
    }

    async checkDNSConfiguration(dnsServer) {
        const resultDiv = document.getElementById('dns-check-result');
        const proceedBtn = document.getElementById('proceed-btn');

        if (!resultDiv || !proceedBtn) {
            console.error('DNS check elements not found');
            return;
        }

        // Show loading state
        resultDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span class="text-sm text-gray-600">Verifying DNS configuration...</span>
            </div>
        `;

        try {
            // Use a more reliable DNS checking method that doesn't trigger CORS
            const dnsCheckResult = await this.performDNSCheck(dnsServer);

            if (dnsCheckResult.isConfigured) {
                resultDiv.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-check-circle text-green-500"></i>
                        <span class="text-sm text-green-600 font-medium">DNS is active</span>
                    </div>
                `;
                proceedBtn.disabled = false;
                proceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                this.showToast('✅ DNS is active - proceed', 'success');
            } else {
                // Show simple error message
                resultDiv.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                        <span class="text-sm text-yellow-600 font-medium">DNS is not active</span>
                    </div>
                `;
                proceedBtn.disabled = true;
                proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
                this.showToast('⚠️ DNS is not active', 'warning');
            }

        } catch (error) {
            console.error('DNS check error:', error);
            resultDiv.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                    <span class="text-sm text-yellow-600 font-medium">DNS is not active</span>
                </div>
            `;
            proceedBtn.disabled = true;
            proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
            this.showToast('⚠️ DNS is not active', 'warning');
        }
    }

    async performDNSCheck(dnsServer) {
        try {
            console.log('Testing DNS configuration for Immutable link capture...');

            // Test the specific domain that needs to be blocked for Immutable link capture
            const immutableAuthDomain = 'https://auth.immutable.com';

            // Test with a domain that should work (for basic connectivity check)
            // Use a simple, reliable domain for connectivity testing
            const workingDomain = 'https://www.google.com';

            // Test with additional domains that NextDNS typically blocks
            const additionalBlockedDomains = [
                'https://ads.example.com/test.png',
                'https://tracking.example.com/test.png'
            ];

            const [immutableResult, workingResult, additionalResults] = await Promise.all([
                this.testDomainAccess(immutableAuthDomain),
                this.testDomainAccess(workingDomain),
                Promise.all(additionalBlockedDomains.map(domain => this.testDomainAccess(domain)))
            ]);

            console.log('DNS Test Results:', {
                immutableAuth: immutableResult,
                workingDomain: workingResult,
                additionalBlocked: additionalResults,
                testDetails: {
                    immutableDomain: immutableAuthDomain,
                    workingDomain: workingDomain,
                    additionalDomains: additionalBlockedDomains
                }
            });

            // DNS is configured correctly if:
            // 1. Working domain is accessible (basic connectivity)
            // 2. auth.immutable.com is blocked (required for Immutable link capture)
            const isConfigured = workingResult && !immutableResult;

            return {
                isConfigured: isConfigured,
                details: {
                    workingDomain: workingResult,
                    immutableAuth: immutableResult,
                    additionalBlocked: additionalResults,
                    immutableBlocked: !immutableResult
                }
            };

        } catch (error) {
            console.error('DNS check method failed:', error);
            // Fallback: assume DNS is not configured if check fails
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

            // Close DNS setup modal
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
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">Capture Immutable Link - ${task.title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <form id="immutable-link-form" class="modal-form">
                    <div class="form-group">
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                                <h4 class="text-yellow-800 font-semibold">Important Instructions</h4>
                            </div>
                            <p class="text-yellow-700 text-sm">
                                Make sure your DNS is properly configured before proceeding!
                            </p>
                        </div>
                    </div>

                    <div class="form-group">
                        <h4 class="form-label">Step-by-Step Instructions</h4>
                        <div class="space-y-3">
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                                <div>
                                    <p class="font-medium text-gray-900">Complete Tutorial & Get Gaming ID</p>
                                    <p class="text-sm text-gray-600">Finish the game tutorial and copy your Gaming ID from profile</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                                <div>
                                    <p class="font-medium text-gray-900">Submit Gaming ID & Screenshot</p>
                                    <p class="text-sm text-gray-600">Submit your Gaming ID and profile screenshot for verification</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                                <div>
                                    <p class="font-medium text-gray-900">Configure DNS Settings</p>
                                    <p class="text-sm text-gray-600">Set up DNS configuration to block auto-redirects</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                                <div>
                                    <p class="font-medium text-gray-900">Go Back to ${appName} App</p>
                                    <p class="text-sm text-gray-600">Return to the ${appName} mobile game</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">5</div>
                                <div>
                                    <p class="font-medium text-gray-900">Tap ${connectText}</p>
                                    <p class="text-sm text-gray-600">Look for the "${connectText}" button in the app</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">6</div>
                                <div>
                                    <p class="font-medium text-gray-900">DNS Blocks Auto-Redirect</p>
                                    <p class="text-sm text-gray-600">The link should appear in the app instead of auto-opening browser</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">7</div>
                                <div>
                                    <p class="font-medium text-gray-900">Copy the Immutable Link</p>
                                    <p class="text-sm text-gray-600">Copy the Immutable link that appears in the app</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Paste Immutable Link *</label>
                        <textarea id="immutable-link" required class="form-textarea" rows="3" 
                            placeholder="Paste the Immutable link you copied from the ${appName} app here..."></textarea>
                        <small class="form-hint">The link should start with https:// and contain ${linkPattern}-related parameters</small>
                    </div>

                    <div class="form-group">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                                <h4 class="text-blue-800 font-semibold">Admin Review Process</h4>
                            </div>
                            <p class="text-blue-700 text-sm">
                                📋 <strong>After submission:</strong> Your link will be reviewed by an admin<br>
                                ✅ <strong>Approved:</strong> You'll receive notification to proceed with game stages<br>
                                ❌ <strong>Rejected:</strong> You'll be notified with reason and can resubmit<br>
                                ⏳ <strong>Pending:</strong> Please wait for admin review (usually within 3-5 minutes)
                            </p>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-shield-alt text-yellow-600 mr-2"></i>
                                <h4 class="text-yellow-800 font-semibold">Important Security Note</h4>
                            </div>
                            <p class="text-yellow-700 text-sm">
                                🔒 <strong>Admin Access:</strong> The admin will use your link to sign in and verify your account<br>
                                🎮 <strong>After Approval:</strong> You can proceed to play the game stages we've set up<br>
                                📸 <strong>Final Submission:</strong> Submit your gameplay results for final review
                            </p>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                            </svg>
                            Submit Link
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        document.getElementById('immutable-link-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitImmutableLink(task.id);
        });
    }

    async submitImmutableLink(taskId) {
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

            this.showLoading(true);

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
            this.showLoading(false);
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
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">🎮 Game Setup Guide - ${task.title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="setup-steps">
                        <div class="step-item active" id="step-1">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h4 class="step-title">📱 Download Battle of Souls</h4>
                                <p class="step-description">Download the game from Google Play Store</p>
                                <div class="step-actions">
                                    <button type="button" class="btn-primary" onclick="window.open('https://play.google.com/store/apps/details?id=com.pxlr.battleofsouls&hl=en', '_blank')">
                                        <i class="fas fa-download"></i> Download Game
                                    </button>
                                    <button type="button" class="btn-secondary" onclick="window.dashboardHandler.nextStep(2)">
                                        I Already Have It
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="step-item" id="step-2">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h4 class="step-title">🔐 Sign In with Google Account</h4>
                                <p class="step-description">Open the game and sign in with your Google account (NOT guest account)</p>
                                <div class="step-warning">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <strong>Important:</strong> You must sign in with your Google account, not as a guest!
                                </div>
                                <div class="step-actions">
                                    <button type="button" class="btn-primary" onclick="window.dashboardHandler.nextStep(3)">
                                        I'm Signed In
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="step-item" id="step-3">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h4 class="step-title">🆔 Find Your Game ID</h4>
                                <p class="step-description">In the game, go to Settings or Profile to find your Game ID</p>
                                <div class="step-help">
                                    <p><strong>How to find Game ID:</strong></p>
                                    <ul>
                                        <li>Open the game</li>
                                        <li>Go to Settings or Profile</li>
                                        <li>Look for "Player ID" or "Game ID"</li>
                                        <li>Copy the ID (usually numbers)</li>
                                    </ul>
                                </div>
                                <div class="step-actions">
                                    <button type="button" class="btn-primary" onclick="window.dashboardHandler.nextStep(4)">
                                        I Found My Game ID
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="step-item" id="step-4">
                            <div class="step-number">4</div>
                            <div class="step-content">
                                <h4 class="step-title">📸 Submit Your Information</h4>
                                <p class="step-description">Now you can submit your Game ID and profile screenshot</p>
                                <form id="phase1-form" class="step-form">
                                    <div class="form-group">
                                        <label class="form-label">Game ID *</label>
                                        <input type="text" id="game-id" required class="form-input" placeholder="Enter your Game ID">
                                        <small class="form-hint">Your unique game identifier from the game settings</small>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Android Version *</label>
                                        <select id="android-version" required class="form-select">
                                            <option value="">Select your Android version</option>
                                            <option value="10">Android 10</option>
                                            <option value="11">Android 11</option>
                                            <option value="12">Android 12</option>
                                            <option value="13">Android 13</option>
                                            <option value="14">Android 14</option>
                                            <option value="15">Android 15</option>
                                        </select>
                                        <small class="form-hint">Select your device's Android version</small>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Profile Screenshot *</label>
                                        <input type="file" id="profile-screenshot" required class="form-input" accept="image/*">
                                        <small class="form-hint">Upload a screenshot of your game profile showing your Game ID</small>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Additional Notes</label>
                                        <textarea id="phase1-notes" class="form-textarea" rows="3" placeholder="Any additional information or notes"></textarea>
                                    </div>

                                    <div class="step-actions">
                                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                                            Cancel
                                        </button>
                                        <button type="submit" class="btn-primary">
                                            <i class="fas fa-check"></i>
                                            Submit Phase 1
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        document.getElementById('phase1-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitPhase1Verification(task.id, modal);
        });
    }

    nextStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step-item').forEach(step => {
            step.classList.remove('active');
        });

        // Show the target step
        const targetStep = document.getElementById(`step-${stepNumber}`);
        if (targetStep) {
            targetStep.classList.add('active');
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

            // Check completion count
            const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, taskId);
            console.log('🏆 Completion count:', completionCount);

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
            const stats = await window.firestoreManager.getUserCompletionStats(this.currentUser.uid);

            // Update completion count
            const completionElement = document.getElementById('quest-completions');
            if (completionElement) {
                completionElement.textContent = stats.totalCompletions;
            }

            // Update total earned
            const earnedElement = document.getElementById('total-earned');
            if (earnedElement) {
                earnedElement.textContent = `₱${stats.totalRewardsEarned}`;
            }

            console.log('Completion stats loaded:', stats);
        } catch (error) {
            console.error('Error loading completion stats:', error);
        }
    }

    // Restart quest function
    async restartQuest(taskId) {
        try {
            console.log('🔄 Restarting quest:', taskId);

            // Close the modal first
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.remove();
            }

            // Check if user has reached completion limit
            const completionCount = await window.firestoreManager.getUserQuestCompletionCount(this.currentUser.uid, taskId);
            const task = await window.firestoreManager.getTask(taskId);
            const maxCompletions = task?.maxCompletions || 1;

            if (completionCount >= maxCompletions) {
                this.showToast(`You have reached the maximum completions (${maxCompletions}) for this quest.`, 'error');
                return;
            }

            // Clear any existing task status - set to 'available' to allow restart
            await window.firestoreManager.updateTaskStatus(taskId, 'available', this.currentUser.uid);

            // Clear stored start time from localStorage
            const startTimeKey = `task_start_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(startTimeKey);
            console.log(`🗑️ Cleared start time from localStorage: ${startTimeKey}`);

            // Clear expired flag from localStorage
            const expiredKey = `task_expired_${taskId}_${this.currentUser.uid}`;
            localStorage.removeItem(expiredKey);
            console.log(`🗑️ Cleared expired flag from localStorage: ${expiredKey}`);

            // Also clear any existing verifications for this task to start fresh
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);

            for (const verification of taskVerifications) {
                // Delete old verifications to start completely fresh
                await window.firestoreManager.deleteVerification(verification.id);
                console.log('🗑️ Deleted old verification:', verification.id);
            }

            this.showToast(`Quest restarted! You can now begin again with fresh timer. (${completionCount}/${maxCompletions} completions)`, 'success');

            // Reload tasks to update the UI
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error restarting quest:', error);
            this.showToast('Failed to restart quest: ' + error.message, 'error');
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
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">Phase 2 Verification - ${task.title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <form id="phase2-form" class="modal-form">
                    <div class="form-group">
                        <h4 class="form-label">Phase 2 Requirements</h4>
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <pre class="text-sm text-gray-700 whitespace-pre-wrap">${task.phase2Requirements || 'Please provide proof of task completion.'}</pre>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Game ID *</label>
                        <input type="text" id="game-id-phase2" required class="form-input" placeholder="Enter your Game ID">
                        <small class="form-hint">Same Game ID from Phase 1</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Completion Screenshot *</label>
                        <input type="file" id="completion-screenshot" required class="form-input" accept="image/*">
                        <small class="form-hint">Upload screenshot showing task completion</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Additional Proof Screenshots</label>
                        <input type="file" id="additional-screenshots" class="form-input" accept="image/*" multiple>
                        <small class="form-hint">Optional: Additional screenshots for verification</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Completion Notes</label>
                        <textarea id="phase2-notes" class="form-textarea" rows="3" placeholder="Describe how you completed the task"></textarea>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                            </svg>
                            Submit Phase 2
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup form submission
        document.getElementById('phase2-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitPhase2Verification(task.id, modal);
        });
    }

    async submitPhase1Verification(taskId, modal) {
        try {
            console.log('🔄 Starting Phase 1 verification submission...');

            const gameId = document.getElementById('game-id').value.trim();
            const androidVersion = document.getElementById('android-version').value;
            const notes = document.getElementById('phase1-notes').value.trim();
            const screenshot = document.getElementById('profile-screenshot').files[0];

            console.log('📝 Form data:', { gameId, androidVersion, notes, screenshot: screenshot?.name });

            if (!gameId || !androidVersion || !screenshot) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

            // Show loading state
            this.showToast('📤 Uploading screenshot...', 'info');

            // Upload screenshot to Firebase Storage
            console.log('📤 Uploading screenshot...');
            const screenshotUrl = await this.uploadScreenshot(screenshot, `phase1_${taskId}_${this.currentUser.uid}`);
            console.log('✅ Screenshot uploaded:', screenshotUrl);

            const verificationData = {
                taskId: taskId,
                userId: this.currentUser.uid,
                phase: 'initial',
                status: 'pending',
                gameId: gameId,
                androidVersion: androidVersion,
                screenshots: [screenshotUrl],
                notes: notes || 'Phase 1 verification submitted',
                createdAt: new Date()
            };

            console.log('💾 Saving verification data...');
            await window.firestoreManager.createVerification(verificationData);
            console.log('✅ Verification data saved');

            // Update task status to pending
            await window.firestoreManager.updateTaskStatus(taskId, 'pending');

            this.showToast('✅ Phase 1 verification submitted successfully!', 'success');
            modal.remove();
            await this.loadTasks();

        } catch (error) {
            console.error('❌ Error submitting Phase 1 verification:', error);

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
            const gameId = document.getElementById('game-id-phase2').value.trim();
            const notes = document.getElementById('phase2-notes').value.trim();
            const completionScreenshot = document.getElementById('completion-screenshot').files[0];
            const additionalScreenshots = document.getElementById('additional-screenshots').files;

            if (!gameId || !completionScreenshot) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

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

            this.showToast('Phase 2 verification submitted successfully!', 'success');
            modal.remove();
            await this.loadTasks();

        } catch (error) {
            console.error('Error submitting Phase 2 verification:', error);
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

            // Use Supabase Storage with fallback
            try {
                console.log('📤 Uploading to Supabase Storage...');

                // Check if Supabase is properly configured
                if (!window.supabaseStorageManager || !window.supabaseClient) {
                    throw new Error('Supabase not properly configured');
                }

                // Extract phase and taskId from filename
                const parts = filename.split('_');
                const phase = parts[0];
                const taskId = parts[1];

                const downloadURL = await window.supabaseStorageManager.uploadVerificationImage(
                    file,
                    this.currentUser.uid,
                    taskId,
                    phase
                );

                console.log('✅ Screenshot uploaded successfully via Supabase:', downloadURL);
                return downloadURL;
            } catch (supabaseError) {
                console.error('❌ Supabase upload failed:', supabaseError);

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
        try {
            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                await this.waitForAuthentication();
            }

            const withdrawals = await window.firestoreManager.getWithdrawalsByUser(this.currentUser.uid);
            const verifications = await window.firestoreManager.getVerificationsByUser(this.currentUser.uid);

            // Combine and sort by date
            const history = [
                ...withdrawals.map(w => ({ ...w, type: 'withdrawal' })),
                ...verifications.filter(v => v.status === 'approved' && v.phase === 'final')
                    .map(v => ({ ...v, type: 'earning' }))
            ].sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate()));

            await this.renderWalletHistory(history);
        } catch (error) {
            console.error('Error loading wallet history:', error);
            this.showToast('Failed to load wallet history', 'error');
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
                        <p class="text-sm text-gray-500">${withdrawal.method.toUpperCase()} - ${withdrawal.account}</p>
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

    async loadActivityHistory() {
        try {
            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                await this.waitForAuthentication();
            }

            const [verifications, withdrawals] = await Promise.all([
                window.firestoreManager.getVerificationsByUser(this.currentUser.uid),
                window.firestoreManager.getWithdrawalsByUser(this.currentUser.uid)
            ]);

            // Combine and sort by date - ONLY user-initiated activities
            const activities = [
                ...verifications.map(v => ({ ...v, type: 'verification' })),
                ...withdrawals.map(w => ({ ...w, type: 'withdrawal' }))
            ].sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate()));

            this.renderActivityHistory(activities);
        } catch (error) {
            console.error('Error loading activity history:', error);
            this.showToast('Failed to load activity history', 'error');
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
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.style.opacity = '0.6';
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

        // INSTANT LOCAL CHECK - No database calls needed
        if (this.isSubmittingWithdrawal) {
            this.showToast('⏳ Please wait, withdrawal is being processed...', 'warning');
            return;
        }

        // Check cooldown period
        if (this.lastWithdrawalTime && (now - this.lastWithdrawalTime) < this.withdrawalCooldown) {
            const remainingTime = Math.ceil((this.withdrawalCooldown - (now - this.lastWithdrawalTime)) / 1000);
            this.showToast(`⏰ Please wait ${remainingTime} seconds before next withdrawal`, 'warning');
            return;
        }

        // Check if user account is disabled
        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.status === 'disabled') {
                    this.showToast('❌ Your account is disabled. You cannot make withdrawals.', 'error');
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking account status:', error);
            this.showToast('❌ Failed to verify account status', 'error');
            return;
        }

        // INSTANT UI BLOCKING - No async operations
        this.isSubmittingWithdrawal = true;
        this.lastWithdrawalTime = now;

        // Store in localStorage for persistence across page reloads
        localStorage.setItem('lastWithdrawalTime', now.toString());
        localStorage.setItem('isSubmittingWithdrawal', 'true');

        // INSTANT UI UPDATE
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.style.opacity = '0.6';
        }

        try {
            const amount = parseFloat(document.getElementById('withdrawal-amount').value);
            const method = document.getElementById('withdrawal-method').value;
            const account = document.getElementById('withdrawal-account').value;

            // Basic validation
            if (!amount || !method || !account) {
                this.showToast('❌ Please fill in all fields', 'error');
                return;
            }

            if (amount <= 0) {
                this.showToast('❌ Amount must be greater than 0', 'error');
                return;
            }

            // Show loading
            this.showLoading(true);

            // Check if user has sufficient balance
            const user = await window.firestoreManager.getUser(this.currentUser.uid);
            if (user.walletBalance < amount) {
                this.showToast('❌ Insufficient balance', 'error');
                return;
            }

            // Create withdrawal request
            const withdrawalId = await window.firestoreManager.createWithdrawal({
                userId: this.currentUser.uid,
                amount: amount,
                method: method,
                account: account
            });

            // Immediately decrease user's wallet balance
            await window.firestoreManager.updateWalletBalance(this.currentUser.uid, -amount);

            // Create notification for withdrawal submission
            await window.firestoreManager.createAdminNotification(this.currentUser.uid, {
                type: 'withdrawal_submitted',
                title: '💸 Withdrawal Request Submitted',
                message: `Your withdrawal request of ₱${amount} via ${method} has been submitted and is pending admin approval.`,
                data: { withdrawalId: withdrawalId, amount: amount, method: method }
            });

            this.showToast('✅ Withdrawal request submitted successfully! Balance updated.', 'success');
            this.closeWithdrawalModal();

            // Reload user data and wallet history to show updated balance
            await this.loadUserData();
            await this.loadWalletHistory();

        } catch (error) {
            console.error('Error submitting withdrawal:', error);
            this.showToast('❌ Failed to submit withdrawal: ' + error.message, 'error');
        } finally {
            // Reset flags and UI
            this.isSubmittingWithdrawal = false;
            this.showLoading(false);

            // Clear localStorage
            localStorage.removeItem('isSubmittingWithdrawal');

            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
                submitBtn.style.opacity = '1';
            }
        }
    }

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        modal.classList.add('hidden');
    }

    closeAllModals() {
        this.closeTaskModal();
        this.closeWithdrawalModal();
    }

    // Notifications
    async loadNotifications() {
        try {
            // Check if user is authenticated
            if (!this.currentUser) {
                console.log('User not authenticated yet, waiting...');
                await this.waitForAuthentication();
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
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showToast('Failed to load notifications', 'error');
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
        const date = notification.createdAt ? new Date(notification.createdAt.toDate()).toLocaleString() : 'Unknown';

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
                            <div class="auto-reject-task">Task: ${notification.data?.taskTitle || 'Unknown'}</div>
                            <div class="auto-reject-gameid">Game ID: ${notification.data?.gameId || 'Unknown'}</div>
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

    // Test Supabase Storage connectivity
    async testStorageConnectivity() {
        try {
            console.log('🔍 Testing Supabase Storage connectivity...');

            if (window.supabaseStorageManager) {
                console.log('✅ Supabase Storage Manager is available');
                console.log('✅ Supabase Storage is ready for uploads');
                return true;
            } else {
                console.warn('⚠️ Supabase Storage Manager not available');
                return false;
            }

        } catch (error) {
            console.error('❌ Supabase Storage connectivity test failed:', error);
            return false;
        }
    }

    // Notification popup methods
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
}

// Initialize dashboard handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardHandler = new DashboardHandler();
});
