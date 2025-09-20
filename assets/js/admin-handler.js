// Admin Page Handler
class AdminHandler {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.tasks = [];
        this.verifications = [];
        this.withdrawals = [];
        this.users = [];
        this.init();
    }

    init() {
        console.log('👑 Initializing Admin Handler...');

        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
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

    checkAuthState() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 User logged in:', user.email);
                this.currentUser = user;
                await this.checkAdminStatus();
                if (this.isAdmin) {
                    this.setupEventListeners();
                    this.setupTabNavigation();
                    await this.loadAdminData();

                    // Fallback: ensure data is loaded after a short delay
                    setTimeout(async () => {
                        if (this.tasks.length === 0) {
                            console.log('🔄 Retrying admin data load...');
                            await this.loadAdminData();
                        }
                    }, 1000);
                }
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
                if (!this.isAdmin) {
                    console.log('👤 User is not admin, redirecting to dashboard...');
                    window.location.href = '/dashboard/';
                }
            } else {
                console.log('👤 User document not found, redirecting to dashboard...');
                window.location.href = '/dashboard/';
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
            window.location.href = '/dashboard/';
        }
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.signOut();
        });

        // Switch to user view button
        document.getElementById('switch-to-user').addEventListener('click', () => {
            window.location.href = '/dashboard/';
        });

        // Refresh data button
        document.getElementById('refresh-data-btn').addEventListener('click', () => {
            this.refreshAllData();
        });

        // Admin tab navigation
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = btn.getAttribute('data-admin-tab');
                if (tabName) {
                    this.switchAdminTab(tabName);
                } else {
                    console.warn('No data-admin-tab attribute found on button:', btn);
                }
            });
        });

        // Dynamic event listeners for admin actions
        document.addEventListener('click', (e) => {
            console.log('Admin click event:', e.target);

            // Add task button
            if (e.target.id === 'add-task-btn' || e.target.closest('#add-task-btn')) {
                console.log('Add task button clicked');
                this.showAddTaskModal();
            }

            // Refresh tasks button
            if (e.target.id === 'refresh-tasks-btn' || e.target.closest('#refresh-tasks-btn')) {
                console.log('Refresh tasks button clicked');
                this.loadAdminTasks();
            }

            // Refresh users button
            if (e.target.id === 'refresh-users-btn' || e.target.closest('#refresh-users-btn')) {
                console.log('Refresh users button clicked');
                this.loadAdminUsers();
            }

            // Save settings button
            if (e.target.id === 'save-settings-btn' || e.target.closest('#save-settings-btn')) {
                console.log('Save settings button clicked');
                this.saveSettings();
            }

            // User activity button
            if (e.target.closest('.view-activity-btn')) {
                const userId = e.target.closest('.view-activity-btn').getAttribute('data-user-id');
                this.showUserActivity(userId);
            }

            // Close activity modal
            if (e.target.id === 'close-activity-modal') {
                this.closeUserActivityModal();
            }

            // Close activity modal when clicking overlay
            if (e.target.id === 'user-activity-modal') {
                this.closeUserActivityModal();
            }

            // Close balance modal when clicking overlay
            if (e.target.id === 'balance-modal') {
                this.closeBalanceModal();
            }

            // Activity tab buttons
            if (e.target.closest('.activity-tab-btn')) {
                const tabBtn = e.target.closest('.activity-tab-btn');
                const tabName = tabBtn.getAttribute('data-activity-tab');
                this.switchActivityTab(tabName);
            }

            // Refresh withdrawals button
            if (e.target.id === 'refresh-withdrawals-btn' || e.target.closest('#refresh-withdrawals-btn')) {
                console.log('Refresh withdrawals button clicked');
                this.loadAdminWithdrawals();
            }

            // Refresh Immutable links button
            if (e.target.id === 'refresh-immutable-links-btn' || e.target.closest('#refresh-immutable-links-btn')) {
                console.log('Refresh Immutable links button clicked');
                this.loadImmutableLinks();
            }

            // Refresh Quest completions button
            if (e.target.id === 'refresh-completions-btn' || e.target.closest('#refresh-completions-btn')) {
                console.log('Refresh Quest completions button clicked');
                this.loadQuestCompletions();
            }

            // Approve Immutable link button (only for immutable link cards)
            if ((e.target.classList.contains('approve-btn') && e.target.closest('.immutable-link-card')) ||
                e.target.closest('.immutable-link-card .approve-btn')) {
                const button = e.target.classList.contains('approve-btn') ? e.target : e.target.closest('.approve-btn');
                const userId = button.getAttribute('data-user-id');
                const taskId = button.getAttribute('data-task-id');
                console.log('🔍 Approve Immutable link button clicked:', userId, taskId);
                console.log('🔍 Button element:', button);
                console.log('🔍 Event target:', e.target);
                e.stopPropagation(); // Prevent other handlers from running
                this.approveImmutableLink(userId, taskId);
                return; // Exit early to prevent other handlers
            }

            // Reject Immutable link button (only for immutable link cards)
            if ((e.target.classList.contains('reject-btn') && e.target.closest('.immutable-link-card')) ||
                e.target.closest('.immutable-link-card .reject-btn')) {
                const button = e.target.classList.contains('reject-btn') ? e.target : e.target.closest('.reject-btn');
                const userId = button.getAttribute('data-user-id');
                const taskId = button.getAttribute('data-task-id');
                console.log('Reject Immutable link button clicked:', userId, taskId);
                e.stopPropagation(); // Prevent other handlers from running
                this.showRejectImmutableModal(userId, taskId);
                return; // Exit early to prevent other handlers
            }

            // Copy Immutable link button
            if (e.target.classList.contains('copy-link-btn') || e.target.closest('.copy-link-btn')) {
                const button = e.target.classList.contains('copy-link-btn') ? e.target : e.target.closest('.copy-link-btn');
                const link = button.getAttribute('data-link');
                navigator.clipboard.writeText(link).then(() => {
                    this.showToast('Immutable link copied to clipboard!', 'success');
                    // Visual feedback
                    const icon = button.querySelector('i');
                    const originalIcon = icon.className;
                    icon.className = 'fas fa-check';
                    button.style.background = '#10b981';
                    setTimeout(() => {
                        icon.className = originalIcon;
                        button.style.background = '#3b82f6';
                    }, 2000);
                }).catch(() => {
                    this.showToast('Failed to copy link', 'error');
                });
            }

            // Reset Immutable link button
            if ((e.target.classList.contains('reset-btn') && e.target.closest('.immutable-link-card')) ||
                e.target.closest('.immutable-link-card .reset-btn')) {
                const button = e.target.classList.contains('reset-btn') ? e.target : e.target.closest('.reset-btn');
                const userId = button.getAttribute('data-user-id');
                const taskId = button.getAttribute('data-task-id');
                console.log('🔍 Reset Immutable link button clicked:', userId, taskId);
                this.resetImmutableLinkApproval(userId, taskId);
            }

            // Manage balance button
            if (e.target.classList.contains('manage-balance-btn') || e.target.closest('.manage-balance-btn')) {
                const button = e.target.classList.contains('manage-balance-btn') ? e.target : e.target.closest('.manage-balance-btn');
                const userId = button.getAttribute('data-user-id');
                console.log('Manage balance button clicked for user:', userId);
                this.showBalanceModal(userId);
            }

            // Reject withdrawal button
            if (e.target.classList.contains('reject-withdrawal-btn') || e.target.closest('.reject-withdrawal-btn')) {
                const button = e.target.classList.contains('reject-withdrawal-btn') ? e.target : e.target.closest('.reject-withdrawal-btn');
                const withdrawalId = button.getAttribute('data-withdrawal-id');
                console.log('Reject withdrawal button clicked for withdrawal:', withdrawalId);
                this.showRejectModal(withdrawalId);
            }

            // Edit task button
            if (e.target.classList.contains('edit-task-btn') || e.target.closest('.edit-task-btn')) {
                const button = e.target.classList.contains('edit-task-btn') ? e.target : e.target.closest('.edit-task-btn');
                const taskId = button.getAttribute('data-task-id');
                console.log('Edit task button clicked for task:', taskId);
                this.editTask(taskId);
            }

            // Delete task button
            if (e.target.classList.contains('delete-task-btn') || e.target.closest('.delete-task-btn')) {
                const button = e.target.classList.contains('delete-task-btn') ? e.target : e.target.closest('.delete-task-btn');
                const taskId = button.getAttribute('data-task-id');
                console.log('Delete task button clicked for task:', taskId);
                this.deleteTask(taskId);
            }

            // Approve verification button (updated for new compact design)
            if (e.target.classList.contains('approve-btn') || e.target.closest('.approve-btn') ||
                e.target.classList.contains('compact-action-btn') && e.target.classList.contains('approve-btn') ||
                e.target.closest('.compact-action-btn.approve-btn')) {
                const button = e.target.classList.contains('approve-btn') ? e.target :
                    e.target.closest('.approve-btn') || e.target.closest('.compact-action-btn.approve-btn');
                const verificationId = button.getAttribute('data-verification-id');
                console.log('Approve verification button clicked:', verificationId);
                this.approveVerification(verificationId);
            }

            // Reject verification button (updated for new compact design)
            if ((e.target.classList.contains('reject-btn') && e.target.hasAttribute('data-verification-id')) ||
                e.target.closest('.reject-btn[data-verification-id]') ||
                (e.target.classList.contains('compact-action-btn') && e.target.classList.contains('reject-btn')) ||
                e.target.closest('.compact-action-btn.reject-btn')) {
                const button = e.target.classList.contains('reject-btn') ? e.target :
                    e.target.closest('.reject-btn') || e.target.closest('.compact-action-btn.reject-btn');
                const verificationId = button.getAttribute('data-verification-id');
                console.log('Reject verification button clicked:', verificationId);
                console.log('Button element:', button);
                console.log('Button attributes:', button.attributes);

                if (!verificationId) {
                    console.error('No verification ID found on reject button');
                    this.showToast('Error: No verification ID found', 'error');
                    return;
                }

                this.rejectVerification(verificationId);
            }

            // Approve withdrawal button
            if (e.target.classList.contains('approve-withdrawal-btn') || e.target.closest('.approve-withdrawal-btn')) {
                const button = e.target.classList.contains('approve-withdrawal-btn') ? e.target : e.target.closest('.approve-withdrawal-btn');
                const withdrawalId = button.getAttribute('data-withdrawal-id');
                this.approveWithdrawal(withdrawalId);
            }

            // Reject withdrawal button
            if (e.target.classList.contains('reject-withdrawal-btn') || e.target.closest('.reject-withdrawal-btn')) {
                const button = e.target.classList.contains('reject-withdrawal-btn') ? e.target : e.target.closest('.reject-withdrawal-btn');
                const withdrawalId = button.getAttribute('data-withdrawal-id');
                this.rejectWithdrawal(withdrawalId);
            }

            // Toggle user status button (disable/enable)
            if (e.target.classList.contains('toggle-status-btn') || e.target.closest('.toggle-status-btn')) {
                const button = e.target.classList.contains('toggle-status-btn') ? e.target : e.target.closest('.toggle-status-btn');
                const userId = button.getAttribute('data-user-id');
                console.log('Toggle status button clicked for user:', userId);
                this.toggleUserStatus(userId);
            }
        });

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Balance modal
        document.getElementById('close-balance-modal').addEventListener('click', () => {
            this.closeBalanceModal();
        });

        document.getElementById('cancel-balance').addEventListener('click', () => {
            this.closeBalanceModal();
        });

        document.getElementById('balance-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateUserBalance();
        });

        // Reject modal
        document.getElementById('close-reject-modal').addEventListener('click', () => {
            this.closeRejectModal();
        });

        document.getElementById('cancel-reject').addEventListener('click', () => {
            this.closeRejectModal();
        });

        document.getElementById('reject-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitRejection();
        });

        // Close modals when clicking overlay
        document.getElementById('balance-modal').addEventListener('click', (e) => {
            if (e.target.id === 'balance-modal') {
                this.closeBalanceModal();
            }
        });

        document.getElementById('reject-withdrawal-modal').addEventListener('click', (e) => {
            if (e.target.id === 'reject-withdrawal-modal') {
                this.closeRejectModal();
            }
        });

        // Immutable link rejection modal
        document.getElementById('close-reject-immutable-modal').addEventListener('click', () => {
            this.closeRejectImmutableModal();
        });

        document.getElementById('cancel-reject-immutable').addEventListener('click', () => {
            this.closeRejectImmutableModal();
        });

        document.getElementById('reject-immutable-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitImmutableRejection();
        });

        document.getElementById('reject-immutable-modal').addEventListener('click', (e) => {
            if (e.target.id === 'reject-immutable-modal') {
                this.closeRejectImmutableModal();
            }
        });

        // Withdrawal status filter
        document.getElementById('withdrawal-status-filter').addEventListener('change', (e) => {
            this.filterWithdrawals(e.target.value);
        });
    }

    setupTabNavigation() {
        // Default to overview tab
        this.switchAdminTab('overview');
    }

    switchAdminTab(tabName) {
        console.log('🔄 Switching to admin tab:', tabName);

        // Update admin tab buttons
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const tabButton = document.querySelector(`[data-admin-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        } else {
            console.warn(`Tab button with data-admin-tab="${tabName}" not found`);
        }

        // Update admin tab content
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });

        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.remove('hidden');
            tabContent.classList.add('active');
        } else {
            console.warn(`Tab content with id="${tabName}-tab" not found`);
        }

        // Load admin tab data
        this.loadAdminTabData(tabName);
    }

    async refreshAllData() {
        console.log('🔄 Refreshing all admin data...');

        // Show loading state
        const refreshBtn = document.getElementById('refresh-data-btn');
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;

        try {
            await this.loadAdminData();
            console.log('✅ All admin data refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing admin data:', error);
        } finally {
            // Reset button state
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }

    loadAdminTabData(tabName) {
        switch (tabName) {
            case 'overview':
                this.loadOverviewData();
                break;
            case 'tasks-admin':
                this.loadAdminTasks();
                break;
            case 'verifications':
                this.loadTaskSubmissions();
                break;
            case 'withdrawals':
                this.loadWithdrawals();
                break;
            case 'immutable-links':
                this.loadImmutableLinks();
                break;
            case 'quest-completions':
                this.loadQuestCompletions();
                break;
            case 'users':
                this.loadAdminUsers();
                break;
            case 'timers':
                this.loadAdminTimerView();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async loadOverviewData() {
        try {
            console.log('📊 Loading overview data...');

            // Load recent activity
            await this.loadRecentActivity();

            console.log('✅ Overview data loaded');
        } catch (error) {
            console.error('❌ Error loading overview data:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const activityList = document.getElementById('recent-activity-list');
            if (!activityList) return;

            // Get recent verifications and withdrawals
            const [verificationsSnapshot, withdrawalsSnapshot] = await Promise.all([
                db.collection('verifications').orderBy('createdAt', 'desc').limit(5).get(),
                db.collection('withdrawals').orderBy('createdAt', 'desc').limit(5).get()
            ]);

            const activities = [];

            // Process verifications
            verificationsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                activities.push({
                    type: 'verification',
                    text: `New verification submitted for task`,
                    time: data.createdAt?.toDate() || new Date(),
                    icon: 'fas fa-check-circle'
                });
            });

            // Process withdrawals
            withdrawalsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                activities.push({
                    type: 'withdrawal',
                    text: `Withdrawal request: ₱${data.amount}`,
                    time: data.createdAt?.toDate() || new Date(),
                    icon: 'fas fa-money-bill-wave'
                });
            });

            // Sort by time and take latest 5
            activities.sort((a, b) => b.time - a.time);
            const recentActivities = activities.slice(0, 5);

            if (recentActivities.length === 0) {
                activityList.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-history text-4xl mb-4"></i>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }

            activityList.innerHTML = recentActivities.map(activity => {
                // Determine icon color based on activity type
                let iconClass = 'text-blue-500';

                if (activity.type === 'verification') {
                    iconClass = 'text-blue-500'; // Task submissions use blue
                } else if (activity.type === 'withdrawal') {
                    iconClass = 'text-purple-500'; // Withdrawals use purple
                }

                return `
                    <div class="activity-item-admin">
                        <div class="activity-icon-admin ${iconClass}">
                            <i class="${activity.icon}"></i>
                        </div>
                        <div class="activity-content-admin">
                            <div class="activity-title-admin">${activity.text}</div>
                            <div class="activity-meta-admin">
                                <span class="activity-date-admin">${activity.time.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Error loading recent activity:', error);
        }
    }

    async loadAdminData() {
        const loadingModal = this.showLoadingModal('Loading Admin Data', 'Please wait while we fetch all admin data...');

        try {
            await Promise.all([
                this.loadAdminTasks(),
                this.loadAdminVerifications(),
                this.loadAdminWithdrawals(),
                this.loadAdminUsers(),
                this.loadImmutableLinks(),
                this.loadStats()
            ]);
        } finally {
            this.hideLoadingModal(loadingModal);
        }
    }

    toggleTimeLimitType() {
        const timeLimitType = document.getElementById('time-limit-type').value;
        const durationInput = document.getElementById('task-duration');
        const hintElement = document.getElementById('duration-hint');

        switch (timeLimitType) {
            case 'minutes':
                durationInput.max = 1440; // 24 hours in minutes
                durationInput.value = 60; // Default to 1 hour
                hintElement.textContent = 'How many minutes users have to complete this task (max 1440 minutes = 24 hours)';
                break;
            case 'hours':
                durationInput.max = 168; // 7 days in hours
                durationInput.value = 24; // Default to 1 day
                hintElement.textContent = 'How many hours users have to complete this task (max 168 hours = 7 days)';
                break;
            case 'days':
            default:
                durationInput.max = 365;
                durationInput.value = 7;
                hintElement.textContent = 'How many days users have to complete this task';
                break;
        }
    }

    toggleEditTimeLimitType() {
        const timeLimitType = document.getElementById('edit-time-limit-type').value;
        const durationInput = document.getElementById('edit-task-duration');
        const hintElement = document.getElementById('edit-duration-hint');

        switch (timeLimitType) {
            case 'minutes':
                durationInput.max = 1440; // 24 hours in minutes
                hintElement.textContent = 'How many minutes users have to complete this task (max 1440 minutes = 24 hours)';
                break;
            case 'hours':
                durationInput.max = 168; // 7 days in hours
                hintElement.textContent = 'How many hours users have to complete this task (max 168 hours = 7 days)';
                break;
            case 'days':
            default:
                durationInput.max = 365;
                hintElement.textContent = 'How many days users have to complete this task';
                break;
        }
    }

    initializeEditTimeLimitType(task) {
        const timeLimitTypeSelect = document.getElementById('edit-time-limit-type');
        const durationInput = document.getElementById('edit-task-duration');

        if (task.userTimeLimit) {
            // Convert minutes back to the most appropriate unit
            const minutes = task.userTimeLimit;

            if (minutes < 1440) { // Less than 24 hours
                timeLimitTypeSelect.value = 'minutes';
                durationInput.value = minutes;
            } else if (minutes < 10080) { // Less than 7 days
                timeLimitTypeSelect.value = 'hours';
                durationInput.value = Math.floor(minutes / 60);
            } else {
                timeLimitTypeSelect.value = 'days';
                durationInput.value = Math.floor(minutes / (24 * 60));
            }
        } else {
            // Default to days if no userTimeLimit is set
            timeLimitTypeSelect.value = 'days';
            durationInput.value = task.duration || 7;
        }

        console.log('🔍 InitializeEditTimeLimitType Debug:', {
            taskId: task.id,
            userTimeLimit: task.userTimeLimit,
            duration: task.duration,
            finalDurationValue: durationInput.value,
            finalTimeLimitType: timeLimitTypeSelect.value
        });

        // Trigger the toggle function to update the form
        this.toggleEditTimeLimitType();
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
            // Handle regular Date or string
            else {
                deadlineDate = new Date(deadline);
            }

            const now = new Date();
            const diffMs = deadlineDate - now;

            if (diffMs <= 0) {
                return 'Expired';
            }

            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                const remainingHours = diffHours % 24;
                const remainingMinutes = diffMinutes % 60;

                if (remainingHours > 0) {
                    return `${diffDays}d ${remainingHours}h`;
                } else if (remainingMinutes > 0) {
                    return `${diffDays}d ${remainingMinutes}m`;
                } else {
                    return `${diffDays}d`;
                }
            } else if (diffHours > 0) {
                const minutes = diffMinutes % 60;
                if (minutes > 0) {
                    return `${diffHours}h ${minutes}m`;
                } else {
                    return `${diffHours}h`;
                }
            } else {
                return `${diffMinutes}m`;
            }
        } catch (error) {
            console.error('Error calculating deadline display:', error, deadline);
            return 'Error';
        }
    }

    formatDateForInput(deadline) {
        try {
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
                return '';
            }

            // Format as YYYY-MM-DD for date input
            return deadlineDate.toISOString().split('T')[0];
        } catch (error) {
            console.error('Error formatting date for input:', error);
            return '';
        }
    }

    formatTimeForInput(deadline) {
        try {
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
                return '23:59';
            }

            // Format as HH:MM for time input
            const hours = deadlineDate.getHours().toString().padStart(2, '0');
            const minutes = deadlineDate.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formatting time for input:', error);
            return '23:59';
        }
    }

    async loadStats() {
        try {
            console.log('📊 Loading admin stats...');

            // Load users count (exclude admin accounts)
            const usersSnapshot = await db.collection('users').get();
            const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const regularUsers = allUsers.filter(user => !user.isAdmin);
            const totalUsers = regularUsers.length;
            document.getElementById('total-users').textContent = totalUsers;

            // Load tasks count
            const tasksSnapshot = await db.collection('tasks').get();
            const totalTasks = tasksSnapshot.docs.length;
            document.getElementById('total-tasks').textContent = totalTasks;

            // Load pending verifications count
            const verificationsSnapshot = await db.collection('verifications')
                .where('status', '==', 'pending').get();
            const pendingVerifications = verificationsSnapshot.docs.length;
            document.getElementById('pending-verifications').textContent = pendingVerifications;

            // Load pending withdrawals count
            const withdrawalsSnapshot = await db.collection('withdrawals')
                .where('status', '==', 'pending').get();
            const pendingWithdrawals = withdrawalsSnapshot.docs.length;
            document.getElementById('pending-withdrawals').textContent = pendingWithdrawals;

            console.log('✅ Admin stats loaded:', {
                totalUsers,
                totalTasks,
                pendingVerifications,
                pendingWithdrawals
            });

        } catch (error) {
            console.error('❌ Error loading admin stats:', error);
        }
    }

    async loadAdminTasks() {
        const loadingModal = this.showLoadingModal('Loading Tasks', 'Please wait while we fetch the latest task data...');

        try {
            console.log('Loading admin tasks...');

            // Check if firestoreManager is available
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                this.showToast('Database connection not available', 'error');
                this.tasks = [];
                this.renderAdminTasks([]);
                return;
            }

            const tasks = await window.firestoreManager.getAllTasks();
            console.log('Admin tasks loaded:', tasks);
            this.tasks = tasks || []; // Store tasks in instance variable
            this.renderAdminTasks(tasks);
        } catch (error) {
            console.error('Error loading admin tasks:', error);
            this.showToast('Failed to load tasks: ' + error.message, 'error');
            this.tasks = []; // Ensure tasks array is always defined
            this.renderAdminTasks([]);
        } finally {
            this.hideLoadingModal(loadingModal);
        }
    }

    renderAdminTasks(tasks) {
        const container = document.getElementById('admin-tasks-list');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 mb-4">No tasks available</p>
                    <div class="space-x-4">
                        <button id="add-task-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                            <i class="fas fa-plus mr-2"></i>Add First Task
                        </button>
                        <button id="refresh-tasks-btn" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
                            <i class="fas fa-refresh mr-2"></i>Refresh
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${tasks.map(task => this.createAdminTaskCard(task)).join('')}
            </div>
        `;
    }

    createAdminTaskCard(task) {
        const statusColor = task.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200';
        const statusIcon = task.status === 'active' ? 'fas fa-check-circle' : 'fas fa-pause-circle';

        // Format user time limit
        const formatUserTimeLimit = (userTimeLimit) => {
            if (!userTimeLimit) return 'No Limit';
            const minutes = userTimeLimit;
            if (minutes < 60) return `${minutes}m`;
            if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
            return `${Math.floor(minutes / 1440)}d`;
        };

        // Format difficulty with stars
        const formatDifficulty = (difficulty) => {
            const stars = {
                'easy': '⭐',
                'medium': '⭐⭐',
                'hard': '⭐⭐⭐',
                'expert': '⭐⭐⭐⭐'
            };
            return stars[difficulty] || '⭐⭐';
        };

        return `
            <div class="task-card-modern admin-task-card">
                <div class="task-card-header">
                    ${task.banner ? `
                        <img src="${task.banner}" alt="${task.title}" class="task-banner">
                    ` : `
                        <div class="task-hexagon-icon">
                            ${task.title.charAt(0).toUpperCase()}
                        </div>
                    `}
                    <div class="task-status-overlay">
                        <span class="task-status-badge status-available">
                            <i class="fas fa-play"></i> ${task.status.toUpperCase()}
                        </span>
                    </div>
                    ${task.deadline ? `
                        <div class="task-deadline-timer" style="background: rgba(239, 68, 68, 0.9);">
                            <i class="fas fa-clock"></i>
                            <span class="deadline-text">${this.calculateDeadlineDisplay(task.deadline)}</span>
                        </div>
                    ` : ''}
                    ${task.androidVersion ? `
                        <div class="task-requirement-badge">
                            <i class="fas fa-mobile-alt"></i>
                            Android ${task.androidVersion}+
                        </div>
                    ` : `
                        <div class="task-requirement-badge">
                            <i class="fas fa-mobile-alt"></i>
                            Android 14+
                        </div>
                    `}
                    ${task.difficulty ? `
                        <div class="task-difficulty-badge">
                            ${formatDifficulty(task.difficulty)}
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
                            <span class="duration-text">${formatUserTimeLimit(task.userTimeLimit)}</span>
                        </div>
                        <div class="task-completion">
                            <i class="fas fa-trophy"></i>
                            <span class="completion-text">${task.completionCount || 0}/${task.maxCompletions || 1}</span>
                        </div>
                    </div>
                    <div class="task-details-section">
                        <div class="task-detail-item">
                            <span class="detail-label">Max Completions:</span>
                            <span class="detail-value">${task.maxCompletions || 1}</span>
                        </div>
                        <div class="task-detail-item">
                            <span class="detail-label">Difficulty:</span>
                            <span class="detail-value">${formatDifficulty(task.difficulty || 'medium')} ${(task.difficulty || 'Medium').charAt(0).toUpperCase() + (task.difficulty || 'Medium').slice(1)}</span>
                        </div>
                        <div class="task-detail-item">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${new Date(task.createdAt?.toDate()).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="task-action-section">
                        <button class="task-action-btn btn-primary edit-task-btn" data-task-id="${task.id}">
                            <i class="fas fa-edit"></i>Edit
                        </button>
                        <button class="task-action-btn btn-danger delete-task-btn" data-task-id="${task.id}">
                            <i class="fas fa-trash"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadAdminVerifications() {
        const loadingModal = this.showLoadingModal('Loading Verifications', 'Please wait while we fetch the latest verification data...');

        try {
            console.log('Loading admin verifications...');
            const verifications = await window.firestoreManager.getAllVerifications();
            console.log('Admin verifications loaded:', verifications);
            this.verifications = verifications || []; // Store verifications in instance variable
            this.renderAdminVerifications(verifications);
        } catch (error) {
            console.error('Error loading admin verifications:', error);
            this.showToast('Failed to load verifications', 'error');
            this.verifications = []; // Ensure verifications array is always defined
        } finally {
            this.hideLoadingModal(loadingModal);
        }
    }

    renderAdminVerifications(verifications) {
        const container = document.getElementById('verifications-list');
        if (!container) return;

        if (verifications.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-check-circle text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No verifications submitted yet</p>
                </div>
            `;
            return;
        }

        // Group verifications by task and user
        const groupedVerifications = this.groupVerifications(verifications);

        container.innerHTML = Object.entries(groupedVerifications).map(([key, group]) => {
            return this.createVerificationGroup(group);
        }).join('');
    }

    groupVerifications(verifications) {
        const groups = {};

        verifications.forEach(verification => {
            const key = `${verification.userId}-${verification.taskId}`;
            if (!groups[key]) {
                groups[key] = {
                    userId: verification.userId,
                    taskId: verification.taskId,
                    verifications: []
                };
            }
            groups[key].verifications.push(verification);
        });

        return groups;
    }

    createVerificationGroup(group) {
        const initialVerification = group.verifications.find(v => v.phase === 'initial');
        const finalVerification = group.verifications.find(v => v.phase === 'final');

        return `
            <div class="compact-verification-group">
                <div class="verification-header">
                    <div class="verification-meta">
                        <h4 class="verification-title">User Verification</h4>
                        <div class="verification-ids">
                            <span class="verification-id">User: ${group.userId}</span>
                            <span class="verification-id">Task: ${group.taskId}</span>
                        </div>
                    </div>
                    <div class="verification-date">
                        ${new Date(initialVerification?.createdAt?.toDate()).toLocaleDateString()}
                    </div>
                </div>

                <div class="verification-phases">
                    ${this.createVerificationCard('Initial', initialVerification)}
                    ${this.createVerificationCard('Final', finalVerification)}
                </div>

                <div class="verification-actions">
                    ${this.createVerificationActions(initialVerification, finalVerification)}
                </div>
            </div>
        `;
    }

    createVerificationCard(title, verification) {
        if (!verification) {
            return `
                <div class="compact-phase-card empty">
                    <div class="phase-header">
                        <h5 class="phase-title">${title}</h5>
                        <span class="phase-status empty">Not Submitted</span>
                    </div>
                </div>
            `;
        }

        const statusConfig = this.getVerificationStatusConfig(verification.status);

        const isAutoRejected = verification.autoRejected || false;

        return `
            <div class="compact-phase-card ${isAutoRejected ? 'auto-rejected' : ''}">
                <div class="phase-header">
                    <h5 class="phase-title">${title}</h5>
                    <span class="phase-status ${statusConfig.badgeClass}">${statusConfig.label}</span>
                    ${isAutoRejected ? '<span class="auto-reject-indicator"><i class="fas fa-robot"></i></span>' : ''}
                </div>
                
                <div class="phase-details">
                    <div class="detail-row">
                        <span class="detail-label">Game ID:</span>
                        <span class="detail-value">${verification.gameId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Android:</span>
                        <span class="detail-value">${verification.androidVersion}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${new Date(verification.createdAt?.toDate()).toLocaleDateString()}</span>
                    </div>
                </div>

                ${verification.screenshots && verification.screenshots.length > 0 ? `
                    <div class="phase-screenshots">
                        <div class="screenshots-header">
                            <span class="screenshots-count">${verification.screenshots.length} Screenshot${verification.screenshots.length > 1 ? 's' : ''}</span>
                        </div>
                        <div class="screenshots-grid">
                            ${verification.screenshots.map((screenshot, index) => `
                                <div class="screenshot-thumb" onclick="window.adminHandler.openImageModal('${screenshot}', 'Screenshot ${index + 1}')">
                                    <img src="${screenshot}" 
                                         alt="Screenshot ${index + 1}" 
                                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='">
                                    <div class="screenshot-overlay">
                                        <i class="fas fa-search-plus"></i>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${verification.profileScreenshot ? `
                    <div class="phase-screenshots">
                        <div class="screenshots-header">
                            <span class="screenshots-count">Profile Screenshot</span>
                        </div>
                        <div class="screenshots-grid">
                            <div class="screenshot-thumb" onclick="window.adminHandler.openImageModal('${verification.profileScreenshot}', 'Profile Screenshot')">
                                <img src="${verification.profileScreenshot}" 
                                     alt="Profile Screenshot" 
                                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='">
                                <div class="screenshot-overlay">
                                    <i class="fas fa-search-plus"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${verification.stageScreenshot ? `
                    <div class="mb-1">
                        <p class="text-xs font-medium text-gray-700 mb-1">Stage:</p>
                        <div class="relative group inline-block">
                            <img src="${verification.stageScreenshot}" 
                                 alt="Stage Screenshot" 
                                 class="w-12 h-12 object-cover rounded border cursor-pointer hover:shadow-md transition-shadow"
                                 onclick="window.adminHandler.openImageModal('${verification.stageScreenshot}', 'Stage Screenshot')"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='">
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 rounded flex items-center justify-center">
                                <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"></i>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createVerificationActions(initialVerification, finalVerification) {
        const actions = [];

        if (initialVerification && initialVerification.status === 'pending') {
            actions.push(`
                <button class="compact-action-btn approve-btn" data-verification-id="${initialVerification.id}">
                    <i class="fas fa-check"></i>
                    <span>Approve Initial</span>
                </button>
                <button class="compact-action-btn reject-btn" data-verification-id="${initialVerification.id}">
                    <i class="fas fa-times"></i>
                    <span>Reject Initial</span>
                </button>
            `);
        }

        if (finalVerification && finalVerification.status === 'pending') {
            actions.push(`
                <button class="compact-action-btn approve-btn" data-verification-id="${finalVerification.id}">
                    <i class="fas fa-check"></i>
                    <span>Approve Final</span>
                </button>
                <button class="compact-action-btn reject-btn" data-verification-id="${finalVerification.id}">
                    <i class="fas fa-times"></i>
                    <span>Reject Final</span>
                </button>
            `);
        }

        return actions.join('');
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

    async loadAdminWithdrawals() {
        const loadingModal = this.showLoadingModal('Loading Withdrawals', 'Please wait while we fetch the latest withdrawal data...');

        try {
            console.log('Loading admin withdrawals...');
            const withdrawals = await window.firestoreManager.getAllWithdrawals();
            console.log('Admin withdrawals loaded:', withdrawals);
            this.withdrawals = withdrawals || []; // Store withdrawals in instance variable
            this.renderAdminWithdrawals(withdrawals);
        } catch (error) {
            console.error('Error loading admin withdrawals:', error);
            this.showToast('Failed to load withdrawals', 'error');
            this.withdrawals = []; // Ensure withdrawals array is always defined
        } finally {
            this.hideLoadingModal(loadingModal);
        }
    }

    renderAdminWithdrawals(withdrawals) {
        const container = document.getElementById('withdrawals-list');
        if (!container) return;

        if (withdrawals.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-money-bill-wave text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No withdrawal requests yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = withdrawals.map(withdrawal => {
            return this.createWithdrawalCard(withdrawal);
        }).join('');
    }

    createWithdrawalCard(withdrawal) {
        const statusConfig = this.getWithdrawalStatusConfig(withdrawal.status);

        return `
            <div class="border rounded-lg p-6 mb-4 bg-white">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900">Withdrawal Request</h4>
                        <p class="text-sm text-gray-500">User ID: ${withdrawal.userId}</p>
                        <p class="text-sm text-gray-500">Amount: ₱${withdrawal.amount}</p>
                        <p class="text-sm text-gray-500">Method: ${withdrawal.method.toUpperCase()}</p>
                        <p class="text-sm text-gray-500">Account: ${withdrawal.account}</p>
                        ${withdrawal.rejectionReason ? `
                            <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <p class="text-sm text-red-700"><strong>Rejection Reason:</strong></p>
                                <p class="text-sm text-red-600">${withdrawal.rejectionReason}</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="text-right">
                        <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                        <p class="text-sm text-gray-500 mt-2">
                            ${new Date(withdrawal.createdAt?.toDate()).toLocaleString()}
                        </p>
                    </div>
                </div>

                ${withdrawal.status === 'pending' ? `
                    <div class="flex space-x-4">
                        <button class="approve-withdrawal-btn btn-success" data-withdrawal-id="${withdrawal.id}">
                            Mark as Paid
                        </button>
                        <button class="reject-withdrawal-btn btn-danger" data-withdrawal-id="${withdrawal.id}">
                            Reject
                        </button>
                    </div>
                ` : ''}
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

    showAddTaskModal() {
        console.log('Creating add task modal...');

        // Remove any existing modals first
        const existingModal = document.getElementById('add-task-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'add-task-modal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()" style="cursor: pointer;"></div>
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">Add New Task</h3>
                    <button id="close-add-task-modal" class="modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <form id="add-task-form" class="modal-form">
                    <div class="form-group">
                        <label class="form-label">Task Title *</label>
                        <input type="text" id="task-title" required class="form-input" placeholder="Enter task title">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reward Amount (₱) *</label>
                        <input type="number" id="task-reward" required class="form-input" placeholder="Enter reward amount" min="1" step="0.01">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Banner Image URL</label>
                        <input type="url" id="task-banner" class="form-input" placeholder="https://example.com/banner.jpg">
                        <small class="form-hint">Optional: URL to task banner image</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="task-description" class="form-textarea" rows="3" placeholder="Enter detailed task description"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Instructions</label>
                        <textarea id="task-instructions" class="form-textarea" rows="6" placeholder="Enter detailed step-by-step instructions for users. Use numbered lists for clarity:

1. First step
2. Second step
3. Third step

Include specific requirements like:
- Game ID format
- Screenshot requirements
- Stage completion criteria"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Phase 1 Requirements</label>
                        <textarea id="task-phase1-requirements" class="form-textarea" rows="3" placeholder="Enter Phase 1 verification requirements:

Example:
- Game ID (input field)
- Upload Profile Screenshot
- Account level requirements"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Phase 2 Requirements</label>
                        <textarea id="task-phase2-requirements" class="form-textarea" rows="3" placeholder="Enter Phase 2 completion requirements:

Example:
- Same Game ID (auto-filled)
- Screenshot proof of stage completion
- Specific achievement screenshots"></textarea>
                    </div>

                    <div class="form-group">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-shield-alt text-blue-600 mr-2"></i>
                                <h4 class="text-blue-800 font-semibold">Firefox + LeechBlock Configuration</h4>
                            </div>
                            <p class="text-blue-700 text-sm">
                                Configure Firefox browser with LeechBlock extension for Immutable link capture
                            </p>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Require Firefox + LeechBlock Setup</label>
                        <div class="flex items-center space-x-4">
                            <label class="flex items-center">
                                <input type="radio" name="require-dns-setup" value="true" checked class="mr-2">
                                <span>Yes - Users must install Firefox + LeechBlock before capturing Immutable link</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="require-dns-setup" value="false" class="mr-2">
                                <span>No - Skip Firefox + LeechBlock setup step</span>
                            </label>
                        </div>
                        <small class="form-hint">Firefox + LeechBlock setup prevents auto-redirect and allows users to capture Immutable links</small>
                    </div>

                    <div class="form-group" id="dns-config-section">
                        <label class="form-label">Immutable Login URL to Block</label>
                        <input type="text" id="dns-server-address" class="form-input" 
                            placeholder="https://auth.immutable.com" value="https://auth.immutable.com">
                        <small class="form-hint">The Immutable login URL that users need to block using LeechBlock extension</small>
                    </div>

                    <div class="form-group" id="dns-instructions-section">
                        <label class="form-label">Firefox + LeechBlock Setup Instructions</label>
                        <textarea id="dns-setup-instructions" class="form-textarea" rows="6" 
                            placeholder="Enter custom Firefox + LeechBlock setup instructions (optional). Leave empty to use default instructions.

Default instructions include:
1. Install Firefox browser
2. Install LeechBlock NG extension
3. Access LeechBlock options through Extensions menu
4. Configure Block Set 1 with domain: auth.immutable.com
5. Set time periods to 'All Day' for all days
6. Set block method to 'Default Page'
7. Save settings and test the blocking"></textarea>
                        <small class="form-hint">Custom instructions will override the default step-by-step Firefox + LeechBlock setup guide</small>
                    </div>

                    <div class="form-group" id="immutable-app-section">
                        <label class="form-label">Immutable App Information</label>
                        <div class="space-y-3">
                            <div>
                                <label class="form-label">App Name</label>
                                <input type="text" id="immutable-app-name" class="form-input" 
                                    placeholder="Battle of Souls" value="Battle of Souls">
                            </div>
                            <div>
                                <label class="form-label">Connect Button Text</label>
                                <input type="text" id="immutable-connect-text" class="form-input" 
                                    placeholder="Connect to Immutable" value="Connect to Immutable">
                            </div>
                            <div>
                                <label class="form-label">Link Validation Pattern</label>
                                <input type="text" id="immutable-link-pattern" class="form-input" 
                                    placeholder="immutable" value="immutable">
                                <small class="form-hint">Text that must be present in the captured link for validation</small>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Difficulty Level</label>
                        <select id="task-difficulty" class="form-select">
                            <option value="easy">⭐ Easy</option>
                            <option value="medium" selected>⭐⭐ Medium</option>
                            <option value="hard">⭐⭐⭐ Hard</option>
                            <option value="expert">⭐⭐⭐⭐ Expert</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">User Time Limit</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Time Limit Type</label>
                                <select id="time-limit-type" class="form-select" onchange="window.adminHandler.toggleTimeLimitType()">
                                    <option value="days">Days</option>
                                    <option value="hours">Hours</option>
                                    <option value="minutes">Minutes</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Duration</label>
                                <input type="number" id="task-duration" class="form-input" placeholder="Enter duration" min="1" max="365" value="7">
                            </div>
                        </div>
                        <small class="form-hint" id="duration-hint">How many days users have to complete this task</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Task Deadline</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">End Date *</label>
                                <input type="date" id="task-deadline-date" required class="form-input">
                            </div>
                            <div class="form-group">
                                <label class="form-label">End Time *</label>
                                <input type="time" id="task-deadline-time" required class="form-input" value="23:59">
                            </div>
                        </div>
                        <small class="form-hint">When this task will no longer be available to users</small>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Android Version</label>
                            <select id="task-android-version" class="form-select">
                                <option value="10">Android 10</option>
                                <option value="11">Android 11</option>
                                <option value="12">Android 12</option>
                                <option value="13">Android 13</option>
                                <option value="14" selected>Android 14</option>
                                <option value="15">Android 15</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="task-status" class="form-select">
                                <option value="active" selected>Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" id="cancel-add-task" class="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Task
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('Modal appended to DOM:', modal);
        console.log('Modal visibility:', modal.style.display, modal.style.visibility, modal.style.opacity);

        // Setup event listeners
        document.getElementById('close-add-task-modal').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('cancel-add-task').addEventListener('click', () => {
            modal.remove();
        });

        // Add overlay click event listener for better modal closing
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                modal.remove();
            });
        }

        // Setup DNS configuration visibility toggle
        const dnsRadioButtons = document.querySelectorAll('input[name="require-dns-setup"]');
        const dnsConfigSection = document.getElementById('dns-config-section');
        const dnsInstructionsSection = document.getElementById('dns-instructions-section');
        const immutableAppSection = document.getElementById('immutable-app-section');

        function toggleDNSConfig() {
            const requireFirefoxSetup = document.querySelector('input[name="require-dns-setup"]:checked').value === 'true';
            dnsConfigSection.style.display = requireFirefoxSetup ? 'block' : 'none';
            dnsInstructionsSection.style.display = requireFirefoxSetup ? 'block' : 'none';
            immutableAppSection.style.display = requireFirefoxSetup ? 'block' : 'none';
        }

        dnsRadioButtons.forEach(radio => {
            radio.addEventListener('change', toggleDNSConfig);
        });

        // Initial state
        toggleDNSConfig();

        document.getElementById('add-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const success = await this.addTask();
            if (success !== false) {
                modal.remove();
            }
        });
    }

    async addTask() {
        try {
            const title = document.getElementById('task-title').value.trim();
            const reward = parseFloat(document.getElementById('task-reward').value);
            const banner = document.getElementById('task-banner').value.trim();
            const description = document.getElementById('task-description').value.trim();
            const instructions = document.getElementById('task-instructions').value.trim();
            const phase1Requirements = document.getElementById('task-phase1-requirements').value.trim();
            const phase2Requirements = document.getElementById('task-phase2-requirements').value.trim();
            const difficulty = document.getElementById('task-difficulty').value;
            const timeLimitType = document.getElementById('time-limit-type').value;
            const duration = parseInt(document.getElementById('task-duration').value);
            const androidVersion = parseInt(document.getElementById('task-android-version').value);
            const status = document.getElementById('task-status').value;

            // Calculate user time limit in minutes for consistent storage
            let userTimeLimit = null;
            if (timeLimitType === 'minutes') {
                userTimeLimit = duration;
            } else if (timeLimitType === 'hours') {
                userTimeLimit = duration * 60;
            } else if (timeLimitType === 'days') {
                userTimeLimit = duration * 24 * 60;
            }

            console.log('🔍 AddTask Debug:', {
                timeLimitType,
                duration,
                userTimeLimit,
                calculatedMinutes: userTimeLimit
            });

            // Firefox + LeechBlock Setup Configuration
            const requireFirefoxSetup = document.querySelector('input[name="require-dns-setup"]:checked').value === 'true';
            const immutableUrlToBlock = document.getElementById('dns-server-address').value.trim();
            const firefoxSetupInstructions = document.getElementById('dns-setup-instructions').value.trim();
            const immutableAppName = document.getElementById('immutable-app-name').value.trim();
            const immutableConnectText = document.getElementById('immutable-connect-text').value.trim();
            const immutableLinkPattern = document.getElementById('immutable-link-pattern').value.trim();

            // Get deadline data
            const deadlineDate = document.getElementById('task-deadline-date').value;
            const deadlineTime = document.getElementById('task-deadline-time').value;

            if (!deadlineDate || !deadlineTime) {
                this.showToast('Please set a task deadline', 'error');
                return false;
            }

            // Create deadline timestamp
            const deadline = new Date(`${deadlineDate}T${deadlineTime}`);

            // Cap user time limit to never exceed task deadline
            if (userTimeLimit) {
                const now = new Date();
                const remainingMinutesUntilDeadline = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60)));

                // Cap user time limit to task deadline (with 1 minute buffer)
                userTimeLimit = Math.min(userTimeLimit, Math.max(1, remainingMinutesUntilDeadline - 1));

                console.log('🕐 Admin: Capped user time limit to task deadline:', {
                    original: duration,
                    deadlineMinutes: remainingMinutesUntilDeadline,
                    finalUserTimeLimit: userTimeLimit
                });
            }

            if (!title || !reward || reward <= 0) {
                this.showToast('Please fill in all required fields with valid values', 'error');
                return false;
            }

            this.showLoading(true);

            await window.firestoreManager.createTask({
                title,
                reward,
                banner: banner || null,
                description: description || null,
                instructions: instructions || null,
                phase1Requirements: phase1Requirements || null,
                phase2Requirements: phase2Requirements || null,
                difficulty,
                duration,
                userTimeLimit: userTimeLimit, // Store in minutes for consistent calculation
                androidVersion,
                status,
                deadline: firebase.firestore.Timestamp.fromDate(deadline),
                // Firefox + LeechBlock Setup Configuration
                requireDNSSetup: requireFirefoxSetup,
                dnsConfig: requireFirefoxSetup ? {
                    serverAddress: immutableUrlToBlock || 'https://auth.immutable.com',
                    customInstructions: firefoxSetupInstructions || null,
                    immutableApp: {
                        name: immutableAppName || 'Battle of Souls',
                        connectText: immutableConnectText || 'Connect to Immutable',
                        linkPattern: immutableLinkPattern || 'immutable'
                    }
                } : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Task added successfully!', 'success');
            await this.loadAdminTasks();
            return true;

        } catch (error) {
            console.error('Error adding task:', error);
            this.showToast('Failed to add task: ' + error.message, 'error');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    editTask(taskId) {
        console.log('Creating edit task modal for task:', taskId);

        // Ensure tasks are loaded
        if (!this.tasks || this.tasks.length === 0) {
            this.showToast('Tasks not loaded yet. Please wait...', 'error');
            return;
        }

        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            this.showToast('Task not found', 'error');
            return;
        }

        // Remove any existing modals first
        const existingModal = document.getElementById('edit-task-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'edit-task-modal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">Edit Task</h3>
                    <button id="close-edit-task-modal" class="modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <form id="edit-task-form" class="modal-form">
                    <div class="form-group">
                        <label class="form-label">Task Title *</label>
                        <input type="text" id="edit-task-title" required class="form-input" value="${task.title}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reward Amount (₱) *</label>
                        <input type="number" id="edit-task-reward" required class="form-input" value="${task.reward}" min="1" step="0.01">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Banner Image URL</label>
                        <input type="url" id="edit-task-banner" class="form-input" value="${task.banner || ''}" placeholder="https://example.com/banner.jpg">
                        <small class="form-hint">Optional: URL to task banner image</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="edit-task-description" class="form-textarea" rows="3" placeholder="Enter detailed task description">${task.description || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Instructions</label>
                        <textarea id="edit-task-instructions" class="form-textarea" rows="6" placeholder="Enter detailed step-by-step instructions for users">${task.instructions || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Phase 1 Requirements</label>
                        <textarea id="edit-task-phase1-requirements" class="form-textarea" rows="3" placeholder="Enter Phase 1 verification requirements">${task.phase1Requirements || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Phase 2 Requirements</label>
                        <textarea id="edit-task-phase2-requirements" class="form-textarea" rows="3" placeholder="Enter Phase 2 completion requirements">${task.phase2Requirements || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Difficulty Level</label>
                        <select id="edit-task-difficulty" class="form-select">
                            <option value="easy" ${task.difficulty === 'easy' ? 'selected' : ''}>⭐ Easy</option>
                            <option value="medium" ${task.difficulty === 'medium' ? 'selected' : ''}>⭐⭐ Medium</option>
                            <option value="hard" ${task.difficulty === 'hard' ? 'selected' : ''}>⭐⭐⭐ Hard</option>
                            <option value="expert" ${task.difficulty === 'expert' ? 'selected' : ''}>⭐⭐⭐⭐ Expert</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">User Time Limit</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Time Limit Type</label>
                                <select id="edit-time-limit-type" class="form-select" onchange="window.adminHandler.toggleEditTimeLimitType()">
                                    <option value="days">Days</option>
                                    <option value="hours">Hours</option>
                                    <option value="minutes">Minutes</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Duration</label>
                                <input type="number" id="edit-task-duration" class="form-input" placeholder="Enter duration" min="1" max="365">
                            </div>
                        </div>
                        <small class="form-hint" id="edit-duration-hint">How many days users have to complete this task</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Task Deadline</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">End Date *</label>
                                <input type="date" id="edit-task-deadline-date" required class="form-input" value="${task.deadline ? this.formatDateForInput(task.deadline) : ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">End Time *</label>
                                <input type="time" id="edit-task-deadline-time" required class="form-input" value="${task.deadline ? this.formatTimeForInput(task.deadline) : '23:59'}">
                            </div>
                        </div>
                        <small class="form-hint">When this task will no longer be available to users</small>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Android Version</label>
                            <select id="edit-task-android-version" class="form-select">
                                <option value="10" ${task.androidVersion === 10 ? 'selected' : ''}>Android 10</option>
                                <option value="11" ${task.androidVersion === 11 ? 'selected' : ''}>Android 11</option>
                                <option value="12" ${task.androidVersion === 12 ? 'selected' : ''}>Android 12</option>
                                <option value="13" ${task.androidVersion === 13 ? 'selected' : ''}>Android 13</option>
                                <option value="14" ${task.androidVersion === 14 ? 'selected' : ''}>Android 14</option>
                                <option value="15" ${task.androidVersion === 15 ? 'selected' : ''}>Android 15</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="edit-task-status" class="form-select">
                                <option value="active" ${task.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${task.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" id="cancel-edit-task" class="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17,21 17,13 7,13 7,21"></polyline>
                                <polyline points="7,3 7,8 15,8"></polyline>
                            </svg>
                            Update Task
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('Edit modal appended to DOM:', modal);
        console.log('Edit modal visibility:', modal.style.display, modal.style.visibility, modal.style.opacity);

        // Setup event listeners
        document.getElementById('close-edit-task-modal').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('cancel-edit-task').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateTask(taskId);
            modal.remove();
        });

        // Initialize time limit type based on existing task data
        this.initializeEditTimeLimitType(task);
    }

    async updateTask(taskId) {
        try {
            const title = document.getElementById('edit-task-title').value.trim();
            const reward = parseFloat(document.getElementById('edit-task-reward').value);
            const banner = document.getElementById('edit-task-banner').value.trim();
            const description = document.getElementById('edit-task-description').value.trim();
            const instructions = document.getElementById('edit-task-instructions').value.trim();
            const phase1Requirements = document.getElementById('edit-task-phase1-requirements').value.trim();
            const phase2Requirements = document.getElementById('edit-task-phase2-requirements').value.trim();
            const difficulty = document.getElementById('edit-task-difficulty').value;
            const timeLimitType = document.getElementById('edit-time-limit-type').value;
            const duration = parseInt(document.getElementById('edit-task-duration').value);
            const androidVersion = parseInt(document.getElementById('edit-task-android-version').value);
            const status = document.getElementById('edit-task-status').value;

            // Calculate user time limit in minutes for consistent storage
            let userTimeLimit = null;
            if (timeLimitType === 'minutes') {
                userTimeLimit = duration;
            } else if (timeLimitType === 'hours') {
                userTimeLimit = duration * 60;
            } else if (timeLimitType === 'days') {
                userTimeLimit = duration * 24 * 60;
            }

            console.log('🔍 UpdateTask Debug:', {
                taskId,
                timeLimitType,
                duration,
                userTimeLimit,
                calculatedMinutes: userTimeLimit
            });

            // Get deadline data
            const deadlineDate = document.getElementById('edit-task-deadline-date').value;
            const deadlineTime = document.getElementById('edit-task-deadline-time').value;

            if (!deadlineDate || !deadlineTime) {
                this.showToast('Please set a task deadline', 'error');
                return;
            }

            // Create deadline timestamp
            const deadline = new Date(`${deadlineDate}T${deadlineTime}`);

            // Cap user time limit to never exceed task deadline
            if (userTimeLimit) {
                const now = new Date();
                const remainingMinutesUntilDeadline = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60)));

                // Cap user time limit to task deadline (with 1 minute buffer)
                userTimeLimit = Math.min(userTimeLimit, Math.max(1, remainingMinutesUntilDeadline - 1));

                console.log('🕐 Admin: Capped user time limit to task deadline (update):', {
                    original: duration,
                    deadlineMinutes: remainingMinutesUntilDeadline,
                    finalUserTimeLimit: userTimeLimit
                });
            }

            if (!title || !reward || reward <= 0) {
                this.showToast('Please fill in all required fields with valid values', 'error');
                return;
            }

            this.showLoading(true);

            await window.firestoreManager.updateTask(taskId, {
                title,
                reward,
                banner: banner || null,
                description: description || null,
                instructions: instructions || null,
                phase1Requirements: phase1Requirements || null,
                phase2Requirements: phase2Requirements || null,
                difficulty,
                duration,
                userTimeLimit: userTimeLimit, // Store in minutes for consistent calculation
                androidVersion,
                status,
                deadline: firebase.firestore.Timestamp.fromDate(deadline),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Task updated successfully!', 'success');
            await this.loadAdminTasks();

        } catch (error) {
            console.error('Error updating task:', error);
            this.showToast('Failed to update task: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteTask(taskId) {
        // Ensure tasks are loaded
        if (!this.tasks || this.tasks.length === 0) {
            this.showToast('Tasks not loaded yet. Please wait...', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading(true);
            await window.firestoreManager.deleteTask(taskId);
            this.showToast('Task deleted successfully!', 'success');
            await this.loadAdminTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showToast('Failed to delete task: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async approveVerification(verificationId) {
        // Ensure verifications are loaded
        if (!this.verifications || this.verifications.length === 0) {
            this.showToast('Verifications not loaded yet. Please wait...', 'error');
            return;
        }

        try {
            const verification = this.verifications.find(v => v.id === verificationId);
            if (!verification) {
                this.showToast('Verification not found', 'error');
                return;
            }

            // Find and set loading state for the approve button
            const approveButton = document.querySelector(`[data-verification-id="${verificationId}"].approve-btn, [data-verification-id="${verificationId}"] .approve-btn`);
            if (approveButton) {
                this.setButtonLoading(approveButton, true, 'Approving...');
            }

            const loadingModal = this.showLoadingModal('Approving Verification', 'Please wait while we process the verification approval...');
            this.showLoading(true);

            // Check for Game ID mismatch if this is a final verification BEFORE approving
            if (verification.phase === 'final') {
                console.log('🔍 Checking Game ID mismatch for final verification...');
                const gameIdMismatch = await this.checkGameIdMismatch(verification.userId, verification.taskId, verification.gameId);
                if (gameIdMismatch) {
                    console.log('❌ Game ID mismatch detected, auto-rejecting...');
                    await this.autoRejectVerification(verificationId, 'Game ID mismatch detected. The Game ID in your final verification does not match your initial verification.');
                    return;
                }
                console.log('✅ Game ID match confirmed, proceeding with approval...');
            }

            await window.firestoreManager.updateVerification(verificationId, {
                status: 'approved',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update task status based on verification phase
            if (verification.phase === 'initial') {
                // Phase 1 approved - user can now proceed to Firefox + LeechBlock setup
                console.log('🔍 Approving initial verification, updating task status to unlocked...');
                console.log('🔍 User ID:', verification.userId, 'Task ID:', verification.taskId);
                await window.firestoreManager.updateTaskStatus(verification.taskId, 'unlocked', verification.userId);
                console.log('✅ Task status updated to unlocked');

                // Create notification for user
                const task = this.tasks.find(t => t.id === verification.taskId);
                const taskTitle = task ? task.title : 'Unknown Task';

                await window.firestoreManager.createAdminNotification(verification.userId, {
                    type: 'verification_approved',
                    title: '✅ Initial Verification Approved',
                    message: `Your initial verification for "${taskTitle}" has been approved! You can now proceed to Firefox + LeechBlock setup.`,
                    data: { taskId: verification.taskId, taskTitle: taskTitle, phase: 'initial' }
                });
            } else if (verification.phase === 'final') {
                // Final verification approved - credit user's wallet and mark complete
                const task = this.tasks.find(t => t.id === verification.taskId);
                if (task) {
                    await window.firestoreManager.updateWalletBalance(verification.userId, task.reward);
                    await window.firestoreManager.updateTaskStatus(verification.taskId, 'complete', verification.userId);

                    // Record quest completion
                    await window.firestoreManager.recordQuestCompletion(verification.userId, verification.taskId, {
                        reward: task.reward,
                        verificationId: verificationId,
                        completionType: 'final_verification'
                    });

                    // Create notification for user
                    await window.firestoreManager.createAdminNotification(verification.userId, {
                        type: 'verification_approved',
                        title: '🎉 Task Completed!',
                        message: `Congratulations! Your final verification for "${task.title}" has been approved! You've earned ₱${task.reward}.`,
                        data: { taskId: verification.taskId, taskTitle: task.title, phase: 'final', reward: task.reward }
                    });
                }
            }

            this.showToast('Verification approved successfully!', 'success');
            await this.loadAdminVerifications();

        } catch (error) {
            console.error('Error approving verification:', error);
            this.showToast('Failed to approve verification: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            const approveButton = document.querySelector(`[data-verification-id="${verificationId}"].approve-btn, [data-verification-id="${verificationId}"] .approve-btn`);
            if (approveButton) {
                this.setButtonLoading(approveButton, false);
            }
            this.hideLoadingModal(loadingModal);
            this.showLoading(false);
        }
    }

    async rejectVerification(verificationId) {
        try {
            // Find and set loading state for the reject button
            const rejectButton = document.querySelector(`[data-verification-id="${verificationId}"].reject-btn, [data-verification-id="${verificationId}"] .reject-btn`);
            if (rejectButton) {
                this.setButtonLoading(rejectButton, true, 'Rejecting...');
            }

            const loadingModal = this.showLoadingModal('Rejecting Verification', 'Please wait while we process the verification rejection...');
            this.showLoading(true);

            // Get verification details first
            const verification = await window.firestoreManager.getVerification(verificationId);
            if (!verification) {
                this.showToast('Verification not found', 'error');
                return;
            }

            // Update verification status
            await window.firestoreManager.updateVerification(verificationId, {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update task status to rejected
            console.log('🚫 Admin rejecting verification:', {
                verificationId: verificationId,
                taskId: verification.taskId,
                userId: verification.userId,
                phase: verification.phase,
                status: verification.status
            });

            // For final verification rejections, set status to 'rejected_resubmission' so user can resubmit final
            // For initial verification rejections, set status to 'rejected' so user can restart
            if (verification.phase === 'final') {
                await window.firestoreManager.updateTaskStatus(verification.taskId, 'rejected_resubmission', verification.userId);
                console.log('✅ Set task status to rejected_resubmission for final verification resubmission');
            } else {
                await window.firestoreManager.updateTaskStatus(verification.taskId, 'rejected', verification.userId);
                console.log('✅ Set task status to rejected for initial verification');
            }

            // Get task details for notification
            const task = await window.firestoreManager.getTask(verification.taskId);
            const taskTitle = task ? task.title : 'Unknown Task';

            // Create notification for user
            const notificationMessage = verification.phase === 'final'
                ? `Your final verification for "${taskTitle}" has been rejected. You can resubmit your final verification from Phase 2.`
                : `Your initial verification for "${taskTitle}" has been rejected. Please review the requirements and restart your application.`;

            await window.firestoreManager.createAdminNotification(verification.userId, {
                type: 'verification_rejected',
                title: '❌ Verification Rejected',
                message: notificationMessage,
                data: {
                    taskId: verification.taskId,
                    taskTitle: taskTitle,
                    phase: verification.phase,
                    verificationId: verificationId
                }
            });

            this.showToast('Verification rejected and user notified', 'info');
            await this.loadAdminVerifications();

        } catch (error) {
            console.error('Error rejecting verification:', error);
            this.showToast('Failed to reject verification: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            const rejectButton = document.querySelector(`[data-verification-id="${verificationId}"].reject-btn, [data-verification-id="${verificationId}"] .reject-btn`);
            if (rejectButton) {
                this.setButtonLoading(rejectButton, false);
            }
            this.hideLoadingModal(loadingModal);
            this.showLoading(false);
        }
    }

    async approveWithdrawal(withdrawalId) {
        // Ensure withdrawals are loaded
        if (!this.withdrawals || this.withdrawals.length === 0) {
            this.showToast('Withdrawals not loaded yet. Please wait...', 'error');
            return;
        }

        try {
            const withdrawal = this.withdrawals.find(w => w.id === withdrawalId);
            if (!withdrawal) {
                this.showToast('Withdrawal not found', 'error');
                return;
            }

            // Find and set loading state for the approve withdrawal button
            const approveButton = document.querySelector(`[data-withdrawal-id="${withdrawalId}"].approve-withdrawal-btn, [data-withdrawal-id="${withdrawalId}"] .approve-withdrawal-btn`);
            if (approveButton) {
                this.setButtonLoading(approveButton, true, 'Approving...');
            }

            const loadingModal = this.showLoadingModal('Approving Withdrawal', 'Please wait while we process the withdrawal approval...');
            this.showLoading(true);

            // Update withdrawal status using the proper method
            await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'approved');

            // Create notification for withdrawal approval
            await window.firestoreManager.createAdminNotification(withdrawal.userId, {
                type: 'withdrawal_approved',
                title: '✅ Withdrawal Approved',
                message: `Your withdrawal request of ₱${withdrawal.amount} has been approved and processed. The payment has been sent to your ${withdrawal.method} account.`,
                data: { withdrawalId: withdrawalId, amount: withdrawal.amount, method: withdrawal.method }
            });
            this.showToast('Withdrawal marked as paid!', 'success');
            await this.loadAdminWithdrawals();

        } catch (error) {
            console.error('Error approving withdrawal:', error);
            this.showToast('Failed to approve withdrawal: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            const approveButton = document.querySelector(`[data-withdrawal-id="${withdrawalId}"].approve-withdrawal-btn, [data-withdrawal-id="${withdrawalId}"] .approve-withdrawal-btn`);
            if (approveButton) {
                this.setButtonLoading(approveButton, false);
            }
            this.hideLoadingModal(loadingModal);
            this.showLoading(false);
        }
    }

    async rejectWithdrawal(withdrawalId) {
        try {
            const withdrawal = this.withdrawals.find(w => w.id === withdrawalId);
            if (!withdrawal) {
                this.showToast('Withdrawal not found', 'error');
                return;
            }

            // Find and set loading state for the reject withdrawal button
            const rejectButton = document.querySelector(`[data-withdrawal-id="${withdrawalId}"].reject-withdrawal-btn, [data-withdrawal-id="${withdrawalId}"] .reject-withdrawal-btn`);
            if (rejectButton) {
                this.setButtonLoading(rejectButton, true, 'Rejecting...');
            }

            const loadingModal = this.showLoadingModal('Rejecting Withdrawal', 'Please wait while we process the withdrawal rejection...');
            this.showLoading(true);

            // Update withdrawal status (this will handle refund logic automatically)
            await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'rejected', 'Admin rejected withdrawal');

            this.showToast('Withdrawal rejected and amount refunded to user!', 'success');
            await this.loadAdminWithdrawals();

        } catch (error) {
            console.error('Error rejecting withdrawal:', error);
            this.showToast('Failed to reject withdrawal: ' + error.message, 'error');
        } finally {
            // Reset button loading state
            const rejectButton = document.querySelector(`[data-withdrawal-id="${withdrawalId}"].reject-withdrawal-btn, [data-withdrawal-id="${withdrawalId}"] .reject-withdrawal-btn`);
            if (rejectButton) {
                this.setButtonLoading(rejectButton, false);
            }
            this.hideLoadingModal(loadingModal);
            this.showLoading(false);
        }
    }

    // Withdrawal filtering
    filterWithdrawals(status) {
        const withdrawals = this.withdrawals || [];
        let filteredWithdrawals = withdrawals;

        if (status !== 'all') {
            filteredWithdrawals = withdrawals.filter(withdrawal => withdrawal.status === status);
        }

        this.renderAdminWithdrawals(filteredWithdrawals);
    }

    // Immutable Link Management
    async approveImmutableLink(userId, taskId) {
        try {
            console.log('🔍 Approving immutable link for user:', userId, 'task:', taskId);
            this.showLoading(true);

            await window.firestoreManager.approveImmutableLink(userId, taskId);

            // Create notification for user
            const task = this.tasks.find(t => t.id === taskId);
            const taskTitle = task ? task.title : 'Unknown Task';

            await window.firestoreManager.createAdminNotification(userId, {
                type: 'immutable_link_approved',
                title: '✅ Immutable Link Approved',
                message: `Your Immutable link for "${taskTitle}" has been approved! You can now proceed to play the game stages.`,
                data: { taskId: taskId, taskTitle: taskTitle }
            });

            this.showToast('Immutable link approved successfully!', 'success');
            await this.loadImmutableLinks();

        } catch (error) {
            console.error('Error approving Immutable link:', error);
            this.showToast('Failed to approve Immutable link: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async resetImmutableLinkApproval(userId, taskId) {
        try {
            console.log('🔍 Resetting immutable link approval for user:', userId, 'task:', taskId);
            this.showLoading(true);

            await window.firestoreManager.resetImmutableLinkApproval(userId, taskId);

            this.showToast('Immutable link approval reset successfully!', 'success');
            await this.loadImmutableLinks();

        } catch (error) {
            console.error('Error resetting Immutable link approval:', error);
            this.showToast('Failed to reset Immutable link approval: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async showRejectImmutableModal(userId, taskId) {
        try {
            const link = this.immutableLinks.find(l => l.userId === userId && l.taskId === taskId);
            if (!link) {
                this.showToast('Immutable link not found', 'error');
                return;
            }

            document.getElementById('reject-immutable-user-email').value = link.user.email;
            document.getElementById('reject-immutable-task-title').value = link.task.title;
            document.getElementById('reject-immutable-link').value = link.immutableLink;
            document.getElementById('reject-immutable-reason').value = '';

            const modal = document.getElementById('reject-immutable-modal');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            this.currentRejectImmutableUserId = userId;
            this.currentRejectImmutableTaskId = taskId;

        } catch (error) {
            console.error('Error loading Immutable link for rejection:', error);
            this.showToast('Failed to load Immutable link data', 'error');
        }
    }

    closeRejectImmutableModal() {
        const modal = document.getElementById('reject-immutable-modal');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        document.getElementById('reject-immutable-form').reset();
        this.currentRejectImmutableUserId = null;
        this.currentRejectImmutableTaskId = null;
    }

    async submitImmutableRejection() {
        if (!this.currentRejectImmutableUserId || !this.currentRejectImmutableTaskId) {
            this.showToast('No Immutable link selected', 'error');
            return;
        }

        try {
            const reason = document.getElementById('reject-immutable-reason').value.trim();
            if (!reason) {
                this.showToast('Please provide a rejection reason', 'error');
                return;
            }

            this.showLoading(true);

            await window.firestoreManager.rejectImmutableLink(
                this.currentRejectImmutableUserId,
                this.currentRejectImmutableTaskId,
                reason
            );

            // Create notification for user
            const link = this.immutableLinks.find(l =>
                l.userId === this.currentRejectImmutableUserId &&
                l.taskId === this.currentRejectImmutableTaskId
            );

            if (link) {
                await window.firestoreManager.createAdminNotification(this.currentRejectImmutableUserId, {
                    type: 'immutable_link_rejected',
                    title: '❌ Immutable Link Rejected',
                    message: `Your Immutable link for "${link.task.title}" has been rejected. Reason: ${reason}. Please generate a new link and resubmit.`,
                    data: {
                        taskId: this.currentRejectImmutableTaskId,
                        taskTitle: link.task.title,
                        reason: reason
                    }
                });
            }

            this.showToast('Immutable link rejected and user notified!', 'success');
            this.closeRejectImmutableModal();
            await this.loadImmutableLinks();

        } catch (error) {
            console.error('Error rejecting Immutable link:', error);
            this.showToast('Failed to reject Immutable link: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Balance management modal
    async showBalanceModal(userId) {
        try {
            const user = await window.firestoreManager.getUser(userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            document.getElementById('balance-user-email').value = user.email;
            document.getElementById('balance-questa-id').value = this.generateQuestaId(userId);
            document.getElementById('balance-current-amount').value = user.walletBalance || 0;
            document.getElementById('balance-action').value = '';
            document.getElementById('balance-amount').value = '';
            document.getElementById('balance-reason').value = '';

            const modal = document.getElementById('balance-modal');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            // Store current user ID for the form
            this.currentBalanceUserId = userId;

        } catch (error) {
            console.error('Error loading user for balance management:', error);
            this.showToast('Failed to load user data', 'error');
        }
    }

    closeBalanceModal() {
        const modal = document.getElementById('balance-modal');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        document.getElementById('balance-form').reset();
        this.currentBalanceUserId = null;
    }

    async updateUserBalance() {
        if (!this.currentBalanceUserId) {
            this.showToast('No user selected', 'error');
            return;
        }

        try {
            const action = document.getElementById('balance-action').value;
            const amount = parseFloat(document.getElementById('balance-amount').value);
            const reason = document.getElementById('balance-reason').value;

            if (!action || !amount || amount < 0) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

            this.showLoading(true);

            const user = await window.firestoreManager.getUser(this.currentBalanceUserId);
            let newBalance = user.walletBalance || 0;

            switch (action) {
                case 'add':
                    newBalance += amount;
                    break;
                case 'subtract':
                    newBalance -= amount;
                    break;
                case 'set':
                    newBalance = amount;
                    break;
            }

            // Update user balance with proper admin reason and metadata
            const changeAmount = newBalance - (user.walletBalance || 0);
            console.log('🔧 Admin balance adjustment:', {
                userId: this.currentBalanceUserId,
                action: action,
                amount: amount,
                changeAmount: changeAmount,
                oldBalance: user.walletBalance || 0,
                newBalance: newBalance,
                reason: reason
            });

            await window.firestoreManager.updateWalletBalance(
                this.currentBalanceUserId,
                changeAmount,
                'admin_balance_adjustment',
                {
                    action: action,
                    amount: amount,
                    oldBalance: user.walletBalance || 0,
                    newBalance: newBalance,
                    reason: reason,
                    adminId: this.currentUser?.uid || 'unknown',
                    adminEmail: this.currentUser?.email || 'unknown'
                }
            );

            // Create notification for user
            await window.firestoreManager.createAdminNotification(this.currentBalanceUserId, {
                type: 'balance_change',
                title: '💰 Balance Updated',
                message: `Your wallet balance has been ${action === 'add' ? 'increased' : action === 'subtract' ? 'decreased' : 'set'} by ₱${amount}. New balance: ₱${newBalance}`,
                data: {
                    action: action,
                    amount: amount,
                    oldBalance: user.walletBalance || 0,
                    newBalance: newBalance,
                    reason: reason
                }
            });

            this.showToast(`Balance updated successfully! New balance: ₱${newBalance}`, 'success');
            this.closeBalanceModal();
            await this.loadAdminUsers();

        } catch (error) {
            console.error('Error updating user balance:', error);
            this.showToast('Failed to update balance: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Withdrawal rejection modal
    async showRejectModal(withdrawalId) {
        try {
            const withdrawal = this.withdrawals.find(w => w.id === withdrawalId);
            if (!withdrawal) {
                this.showToast('Withdrawal not found', 'error');
                return;
            }

            const user = await window.firestoreManager.getUser(withdrawal.userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            document.getElementById('reject-user-email').value = user.email;
            document.getElementById('reject-questa-id').value = this.generateQuestaId(withdrawal.userId);
            document.getElementById('reject-amount').value = withdrawal.amount;
            document.getElementById('reject-reason').value = '';

            const modal = document.getElementById('reject-withdrawal-modal');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            // Store current withdrawal ID for the form
            this.currentRejectWithdrawalId = withdrawalId;

        } catch (error) {
            console.error('Error loading withdrawal for rejection:', error);
            this.showToast('Failed to load withdrawal data', 'error');
        }
    }

    closeRejectModal() {
        const modal = document.getElementById('reject-withdrawal-modal');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        document.getElementById('reject-form').reset();
        this.currentRejectWithdrawalId = null;
    }

    async submitRejection() {
        if (!this.currentRejectWithdrawalId) {
            this.showToast('No withdrawal selected', 'error');
            return;
        }

        try {
            const reason = document.getElementById('reject-reason').value.trim();
            if (!reason) {
                this.showToast('Please provide a rejection reason', 'error');
                return;
            }

            this.showLoading(true);

            const withdrawal = this.withdrawals.find(w => w.id === this.currentRejectWithdrawalId);
            if (!withdrawal) {
                this.showToast('Withdrawal not found', 'error');
                return;
            }

            // Update withdrawal status with rejection reason
            await window.firestoreManager.updateWithdrawal(this.currentRejectWithdrawalId, {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectionReason: reason
            });

            // Refund the amount back to user's wallet balance
            await window.firestoreManager.updateWalletBalance(withdrawal.userId, withdrawal.amount);

            // Create notification for user
            await window.firestoreManager.createAdminNotification(withdrawal.userId, {
                type: 'withdrawal_rejected',
                title: '❌ Withdrawal Rejected',
                message: `Your withdrawal request of ₱${withdrawal.amount} has been rejected. Reason: ${reason}. The amount has been refunded to your wallet.`,
                data: {
                    withdrawalId: withdrawal.id,
                    amount: withdrawal.amount,
                    reason: reason,
                    method: withdrawal.method
                }
            });

            this.showToast('Withdrawal rejected and amount refunded to user!', 'success');
            this.closeRejectModal();
            await this.loadAdminWithdrawals();

        } catch (error) {
            console.error('Error rejecting withdrawal:', error);
            this.showToast('Failed to reject withdrawal: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
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

    // Show loading spinner
    showLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            if (show) {
                spinner.classList.remove('hidden');
            } else {
                spinner.classList.add('hidden');
            }
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Auto hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 5000);
    }


    // Modern loading modal functions
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
                <h3 class="loading-title">${title}</h3>
                <p class="loading-message">${message}</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Show modal with animation
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

    openImageModal(imageUrl, title) {
        // Remove any existing image modal
        const existingModal = document.getElementById('image-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        modal.innerHTML = `
            <div class="image-modal-container">
                <div class="image-modal-content">
                    <!-- Header -->
                    <div class="image-modal-header">
                        <div class="image-modal-title">
                            <i class="fas fa-image text-blue-600 mr-2"></i>
                            <span>${title}</span>
                        </div>
                        <div class="image-modal-controls">
                            <button id="zoom-out" class="image-modal-btn image-modal-btn-secondary">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <button id="zoom-in" class="image-modal-btn image-modal-btn-secondary">
                                <i class="fas fa-search-plus"></i>
                            </button>
                            <button id="reset-zoom" class="image-modal-btn image-modal-btn-primary">
                                <i class="fas fa-expand-arrows-alt"></i>
                            </button>
                            <button id="close-image-modal" class="image-modal-btn image-modal-btn-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Image Container -->
                    <div class="image-modal-body">
                        <div class="image-container">
                            <img id="modal-image" src="${imageUrl}" 
                                 alt="${title}" 
                                 class="modal-image"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='">
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="image-modal-footer">
                        <div class="image-modal-actions">
                            <a href="${imageUrl}" target="_blank" class="image-modal-action-btn image-modal-action-primary">
                                <i class="fas fa-external-link-alt"></i>
                                <span>Open in New Tab</span>
                            </a>
                            <button onclick="navigator.clipboard.writeText('${imageUrl}')" class="image-modal-action-btn image-modal-action-secondary">
                                <i class="fas fa-copy"></i>
                                <span>Copy URL</span>
                            </button>
                        </div>
                        <div class="image-modal-hint">
                            <i class="fas fa-info-circle text-blue-500 mr-1"></i>
                            <span>Click image to zoom • Mouse wheel to zoom</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(modal);

        // Debug log
        console.log('Image modal created and added to DOM:', modal);

        // Close modal handlers
        const closeBtn = modal.querySelector('#close-image-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Zoom functionality
        const image = modal.querySelector('#modal-image');
        let currentZoom = 1;
        const zoomStep = 0.2;
        const minZoom = 0.5;
        const maxZoom = 3;

        const updateZoom = () => {
            image.style.transform = `scale(${currentZoom})`;
        };

        // Zoom buttons
        modal.querySelector('#zoom-in').addEventListener('click', () => {
            currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
            updateZoom();
        });

        modal.querySelector('#zoom-out').addEventListener('click', () => {
            currentZoom = Math.max(currentZoom - zoomStep, minZoom);
            updateZoom();
        });

        modal.querySelector('#reset-zoom').addEventListener('click', () => {
            currentZoom = 1;
            updateZoom();
        });

        // Mouse wheel zoom
        modal.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
            } else {
                currentZoom = Math.max(currentZoom - zoomStep, minZoom);
            }
            updateZoom();
        });

        // Click to zoom
        image.addEventListener('click', () => {
            currentZoom = currentZoom === 1 ? 2 : 1;
            updateZoom();
        });
    }

    async loadAdminUsers() {
        try {
            console.log('Loading admin users...');
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                this.showToast('Database connection not available', 'error');
                this.users = [];
                this.renderAdminUsers([]);
                return;
            }
            const allUsers = await window.firestoreManager.getAllUsers();

            // Filter out admin accounts from user management
            const regularUsers = allUsers.filter(user => !user.isAdmin && user.id !== this.currentUser?.uid);

            console.log('Admin users loaded:', regularUsers);
            this.users = regularUsers || [];
            this.renderAdminUsers(regularUsers);
        } catch (error) {
            console.error('Error loading admin users:', error);
            this.showToast('Failed to load users: ' + error.message, 'error');
            this.users = [];
            this.renderAdminUsers([]);
        }
    }

    async loadImmutableLinks() {
        try {
            console.log('Loading Immutable links...');
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                this.showToast('Database connection not available', 'error');
                this.immutableLinks = [];
                this.renderImmutableLinks([]);
                return;
            }

            // Get all immutable links (pending, approved, rejected)
            const allLinks = await window.firestoreManager.getAllImmutableLinks();
            console.log('All Immutable links loaded:', allLinks);
            this.immutableLinks = allLinks || [];
            this.renderImmutableLinks(allLinks);
        } catch (error) {
            console.error('Error loading Immutable links:', error);
            this.showToast('Failed to load Immutable links: ' + error.message, 'error');
            this.immutableLinks = [];
            this.renderImmutableLinks([]);
        }
    }

    async loadQuestCompletions() {
        try {
            console.log('Loading quest completions...');
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                this.showToast('Database connection not available', 'error');
                this.renderQuestCompletions([]);
                this.renderQuestLimits([]);
                return;
            }

            const completions = await window.firestoreManager.getAllQuestCompletions();
            const tasks = await window.firestoreManager.getTasksWithCompletionLimits();

            console.log('Quest completions loaded:', completions);
            console.log('Tasks with limits loaded:', tasks);

            this.renderQuestCompletions(completions);
            await this.renderQuestLimits(tasks);
        } catch (error) {
            console.error('Error loading quest completions:', error);
            this.showToast('Failed to load quest completions: ' + error.message, 'error');
            this.renderQuestCompletions([]);
            await this.renderQuestLimits([]);
        }
    }

    renderQuestCompletions(completions) {
        const completionsList = document.getElementById('quest-completions-list');
        if (!completionsList) return;

        if (!completions || completions.length === 0) {
            completionsList.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-trophy text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No quest completions yet</p>
                </div>
            `;
            return;
        }

        // Group completions by user and task
        const groupedCompletions = this.groupCompletionsByUserAndTask(completions);

        completionsList.innerHTML = Object.values(groupedCompletions).map(group =>
            this.createUserCompletionGroup(group)
        ).join('');
    }

    groupCompletionsByUserAndTask(completions) {
        const groups = {};

        completions.forEach(completion => {
            const key = `${completion.userId}_${completion.taskId}`;

            if (!groups[key]) {
                groups[key] = {
                    userId: completion.userId,
                    taskId: completion.taskId,
                    user: completion.user,
                    task: completion.task,
                    completions: [],
                    completionCount: 0,
                    maxCompletions: completion.task?.maxCompletions || 1
                };
            }

            groups[key].completions.push(completion);
            groups[key].completionCount++;
        });

        return groups;
    }

    createUserCompletionGroup(group) {
        const userEmail = group.user?.email || 'Unknown';
        const taskTitle = group.task?.title || 'Unknown Task';
        const completionCount = group.completionCount;
        const maxCompletions = group.maxCompletions;

        return `
            <div class="user-completion-group" style="
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                margin-bottom: 20px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
                <div class="group-header" style="
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div class="group-info">
                        <h4 class="group-title" style="
                            margin: 0 0 12px 0;
                            font-size: 20px;
                            font-weight: 700;
                            color: #1e293b;
                            letter-spacing: -0.025em;
                        ">${taskTitle}</h4>
                        <div class="user-info" style="display: flex; gap: 16px; align-items: center;">
                            <span class="user-email" style="
                                color: #64748b;
                                font-size: 15px;
                                font-weight: 500;
                            ">${userEmail}</span>
                            <span class="questa-id" style="
                                background: #e2e8f0;
                                color: #475569;
                                padding: 4px 12px;
                                border-radius: 20px;
                                font-size: 13px;
                                font-weight: 600;
                                letter-spacing: 0.025em;
                            ">${this.generateQuestaId(group.userId)}</span>
                        </div>
                    </div>
                    <div class="completion-count">
                        <span class="count-badge" style="
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            color: white;
                            padding: 10px 20px;
                            border-radius: 25px;
                            font-weight: 700;
                            font-size: 15px;
                            box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
                            letter-spacing: 0.025em;
                        ">${completionCount}/${maxCompletions}</span>
                    </div>
                </div>
                
                <div class="completion-activities" style="padding: 20px; background: #fafbfc;">
                    ${group.completions.map(completion => this.createCompletionActivity(completion)).join('')}
                </div>
            </div>
        `;
    }

    createCompletionActivity(completion) {
        const completedDate = completion.completedAt ? new Date(completion.completedAt.toDate()).toLocaleString() : 'Unknown';

        return `
            <div class="completion-activity" style="
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0, 0, 0, 0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 2px rgba(0, 0, 0, 0.05)'">
                <div class="activity-details" style="display: flex; gap: 20px; align-items: center;">
                    <span class="reward-earned" style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        padding: 6px 16px;
                        border-radius: 20px;
                        font-weight: 700;
                        font-size: 14px;
                        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
                        letter-spacing: 0.025em;
                    ">₱${completion.reward || 0}</span>
                    <span class="completion-type" style="
                        color: #475569;
                        font-size: 15px;
                        font-weight: 600;
                        text-transform: capitalize;
                        letter-spacing: 0.025em;
                    ">${completion.completionType || 'Final Verification'}</span>
                </div>
                <div class="activity-time" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    font-size: 13px;
                    font-weight: 500;
                ">
                    <i class="fas fa-clock" style="color: #94a3b8;"></i>
                    <span>${completedDate}</span>
                </div>
            </div>
        `;
    }

    async renderQuestLimits(tasks) {
        const limitsList = document.getElementById('quest-limits-list');
        if (!limitsList) return;

        console.log(`🔍 Rendering quest limits for ${tasks ? tasks.length : 0} tasks`);

        if (!tasks || tasks.length === 0) {
            limitsList.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-gray-500">No active quests found</p>
                </div>
            `;
            return;
        }

        // Log all tasks being processed
        tasks.forEach(task => {
            console.log(`📋 Task: ${task.title}, maxCompletions: ${task.maxCompletions || 'not set'}`);
        });

        // Create quest limit cards with completion counts
        const questLimitCards = await Promise.all(
            tasks.map(task => this.createQuestLimitCard(task))
        );

        limitsList.innerHTML = questLimitCards.join('');
    }

    async createQuestLimitCard(task) {
        // Get completion count for this task
        const completionCount = await window.firestoreManager.getQuestCompletionCount(task.id);

        // Set default maxCompletions if not set
        const maxCompletions = task.maxCompletions || 1;

        return `
            <div class="quest-limit-card" style="
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                margin-bottom: 20px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
                <div style="
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="flex: 1;">
                        <h5 style="
                            margin: 0 0 8px 0;
                            font-size: 18px;
                            font-weight: 700;
                            color: #1e293b;
                            letter-spacing: -0.025em;
                        ">${task.title}</h5>
                        <p style="
                            margin: 0 0 8px 0;
                            font-size: 14px;
                            color: #64748b;
                            font-weight: 500;
                        ">Reward: ₱${task.reward}</p>
                    </div>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    ">
                        <div style="
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        ">
                            <label style="
                                font-size: 13px;
                                font-weight: 600;
                                color: #475569;
                                margin: 0;
                            ">Max Completions:</label>
                            <input type="number" 
                                   id="limit-${task.id}" 
                                   style="
                                       width: 80px;
                                       padding: 8px 12px;
                                       border: 2px solid #e2e8f0;
                                       border-radius: 8px;
                                       text-align: center;
                                       font-weight: 600;
                                       font-size: 14px;
                                       color: #1e293b;
                                       background: #f8fafc;
                                       transition: all 0.2s ease;
                                   "
                                   onfocus="this.style.borderColor='#3b82f6'; this.style.background='white'"
                                   onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'"
                                   value="${maxCompletions}" 
                                   min="1" 
                                   max="100">
                        </div>
                        <button onclick="window.adminHandler.updateQuestLimit('${task.id}')" 
                                style="
                                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                                    color: white;
                                    padding: 10px 20px;
                                    border: none;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    font-size: 14px;
                                    cursor: pointer;
                                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                                    transition: all 0.2s ease;
                                "
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.4)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.3)'">
                            Update
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async updateQuestLimit(taskId) {
        try {
            const limitInput = document.getElementById(`limit-${taskId}`);
            const newLimit = parseInt(limitInput.value);

            if (isNaN(newLimit) || newLimit < 1) {
                this.showToast('Please enter a valid limit (minimum 1)', 'error');
                return;
            }

            await window.firestoreManager.updateTaskMaxCompletions(taskId, newLimit);
            this.showToast(`Quest limit updated to ${newLimit} completions`, 'success');

            // Reload quest limits to show updated completion counts
            await this.loadQuestCompletions();

        } catch (error) {
            console.error('Error updating quest limit:', error);
            this.showToast('Failed to update quest limit: ' + error.message, 'error');
        }
    }

    // Check for Game ID mismatch between initial and final verifications
    async checkGameIdMismatch(userId, taskId, finalGameId) {
        try {
            console.log('🔍 Checking Game ID mismatch for user:', userId, 'task:', taskId, 'final Game ID:', finalGameId);

            // Get all verifications for this user and task
            const verifications = await window.firestoreManager.getVerificationsByUser(userId);
            console.log('📋 All user verifications:', verifications.length);

            const taskVerifications = verifications.filter(v => v.taskId === taskId);
            console.log('📋 Task verifications:', taskVerifications.length);

            // Find the initial verification
            const initialVerification = taskVerifications.find(v => v.phase === 'initial' && v.status === 'approved');

            if (!initialVerification) {
                console.log('❌ No approved initial verification found');
                console.log('Available verifications:', taskVerifications.map(v => ({ phase: v.phase, status: v.status, gameId: v.gameId })));
                return false;
            }

            const initialGameId = initialVerification.gameId;
            console.log('🎮 Initial Game ID:', initialGameId);
            console.log('🎮 Final Game ID:', finalGameId);
            console.log('🎮 Game IDs match:', initialGameId === finalGameId);

            // Compare Game IDs (trim whitespace and normalize)
            const normalizedInitial = initialGameId ? initialGameId.toString().trim() : '';
            const normalizedFinal = finalGameId ? finalGameId.toString().trim() : '';

            console.log('🎮 Normalized Initial:', normalizedInitial);
            console.log('🎮 Normalized Final:', normalizedFinal);

            if (normalizedInitial && normalizedFinal && normalizedInitial !== normalizedFinal) {
                console.log('❌ Game ID mismatch detected!');
                console.log('❌ Initial:', normalizedInitial, 'vs Final:', normalizedFinal);
                return true;
            }

            console.log('✅ Game IDs match or one is empty');
            return false;
        } catch (error) {
            console.error('❌ Error checking Game ID mismatch:', error);
            return false;
        }
    }

    // Auto-reject verification with reason
    async autoRejectVerification(verificationId, reason) {
        try {
            console.log('🤖 Auto-rejecting verification:', verificationId, 'Reason:', reason);

            // Get verification details first
            const verification = this.verifications.find(v => v.id === verificationId);
            if (!verification) {
                console.error('❌ Verification not found for auto-rejection');
                this.showToast('Verification not found for auto-rejection', 'error');
                return;
            }

            // Update verification status to rejected
            await window.firestoreManager.updateVerification(verificationId, {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectionReason: reason,
                rejectedBy: 'system',
                autoRejected: true
            });

            // For final verification rejections, set status to 'rejected_resubmission' so user can resubmit final
            // For initial verification rejections, set status to 'rejected' so user can restart
            if (verification.phase === 'final') {
                await window.firestoreManager.updateTaskStatus(verification.taskId, 'rejected_resubmission', verification.userId);
                console.log('✅ Set task status to rejected_resubmission for final verification resubmission');
            } else {
                await window.firestoreManager.updateTaskStatus(verification.taskId, 'rejected', verification.userId);
                console.log('✅ Set task status to rejected for initial verification');
            }

            // Create notification for user about auto-rejection
            await window.firestoreManager.createAdminNotification(verification.userId, {
                type: 'verification_auto_rejected',
                title: 'Quest Verification Auto-Rejected',
                message: reason,
                data: {
                    taskId: verification.taskId,
                    taskTitle: verification.task?.title || 'Unknown Task',
                    verificationId: verificationId,
                    gameId: verification.gameId,
                    phase: verification.phase
                }
            });

            this.showToast(`🤖 Auto-rejected: ${reason}`, 'warning');
            await this.loadAdminVerifications();

            console.log('✅ Auto-rejection completed successfully');

        } catch (error) {
            console.error('❌ Error auto-rejecting verification:', error);
            this.showToast('Failed to auto-reject verification: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    createQuestCompletionCard(completion) {
        const completedDate = completion.completedAt ? new Date(completion.completedAt.toDate()).toLocaleString() : 'Unknown';
        const userEmail = completion.user?.email || 'Unknown';
        const taskTitle = completion.task?.title || 'Unknown Task';

        return `
            <div class="quest-completion-card">
                <div class="card-header">
                    <div class="header-left">
                        <div class="task-info">
                            <h4 class="task-title">${taskTitle}</h4>
                            <div class="user-info">
                                <span class="user-email">${userEmail}</span>
                                <span class="questa-id">${this.generateQuestaId(completion.userId)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="completion-time">
                            <i class="fas fa-clock"></i>
                            <span>${completedDate}</span>
                        </div>
                    </div>
                </div>

                <div class="card-content">
                    <div class="completion-details">
                        <div class="reward-info">
                            <span class="reward-label">Reward Earned</span>
                            <span class="reward-amount">₱${completion.reward || 0}</span>
                        </div>
                        <div class="completion-type">
                            <span class="type-label">Type</span>
                            <span class="type-value">${completion.completionType || 'Final Verification'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderImmutableLinks(links) {
        const linksList = document.getElementById('immutable-links-list');
        if (!linksList) return;

        if (!links || links.length === 0) {
            linksList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-link"></i>
                    </div>
                    <h3 class="empty-state-title">No Immutable Links</h3>
                    <p class="empty-state-description">No immutable links are currently pending review</p>
                </div>
            `;
            return;
        }

        linksList.innerHTML = links.map(link => this.createImmutableLinkCard(link)).join('');
    }

    createImmutableLinkCard(link) {
        console.log('🔍 Creating immutable link card for:', link);
        console.log('🔍 Link status:', link.status);
        console.log('🔍 ImmutableLinkApproved:', link.immutableLinkApproved);
        console.log('🔍 Should show buttons:', (link.status === 'pending' || link.status === 'pending_immutable_review' || (link.status === 'ready_for_phase2' && !link.immutableLinkApproved)));

        const submittedDate = link.updatedAt ? new Date(link.updatedAt.toDate()).toLocaleString() : 'Unknown';
        const userEmail = link.user?.email || 'Unknown';
        const taskTitle = link.task?.title || 'Unknown Task';
        const shortLink = link.immutableLink.length > 60 ? link.immutableLink.substring(0, 60) + '...' : link.immutableLink;

        // Determine status styling - simplified and consistent
        let statusClass = 'status-pending';
        let statusIcon = 'fas fa-hourglass-half';
        let statusText = 'Pending Review';

        // Check if link is approved (either explicitly approved or ready_for_phase2 with approval)
        const isApproved = link.status === 'approved' ||
            (link.status === 'ready_for_phase2' && link.immutableLinkApproved) ||
            link.immutableLinkApproved === true;

        if (isApproved) {
            statusClass = 'status-approved';
            statusIcon = 'fas fa-check-circle';
            statusText = 'Approved';
        } else if (link.status === 'rejected') {
            statusClass = 'status-rejected';
            statusIcon = 'fas fa-times-circle';
            statusText = 'Rejected';
        } else {
            // All other statuses are considered pending
            statusClass = 'status-pending';
            statusIcon = 'fas fa-hourglass-half';
            statusText = 'Pending Review';
        }

        return `
            <div class="immutable-link-card">
                <div class="card-header">
                    <div class="header-left">
                        <div class="task-info">
                            <h4 class="task-title">${taskTitle}</h4>
                            <div class="user-info">
                                <span class="user-email">${userEmail}</span>
                                <span class="questa-id">${this.generateQuestaId(link.userId)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="submission-time">
                            <i class="fas fa-clock"></i>
                            <span>${submittedDate}</span>
                        </div>
                        <div class="link-status">
                            <span class="status-badge ${statusClass}">
                                <i class="${statusIcon}"></i>
                                ${statusText}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="card-content">
                    <div class="link-section">
                        <div class="link-header">
                            <span class="link-label">Immutable Link</span>
                            <button class="copy-link-btn" data-link="${link.immutableLink}" title="Copy Link">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="link-preview">
                            <code class="link-text">${shortLink}</code>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    ${!isApproved && link.status !== 'rejected' ? `
                        <button class="action-btn approve-btn" data-user-id="${link.userId}" data-task-id="${link.taskId}">
                            <i class="fas fa-check"></i>
                            <span>Approve</span>
                        </button>
                        <button class="action-btn reject-btn" data-user-id="${link.userId}" data-task-id="${link.taskId}">
                            <i class="fas fa-times"></i>
                            <span>Reject</span>
                        </button>
                    ` : `
                        <div class="status-info">
                            <span class="status-text">${statusText} on ${isApproved ? (link.approvedAt ? new Date(link.approvedAt.toDate()).toLocaleString() : 'Unknown') : (link.rejectedAt ? new Date(link.rejectedAt.toDate()).toLocaleString() : 'Unknown')}</span>
                            ${isApproved ? `
                            <button class="action-btn reset-btn" data-user-id="${link.userId}" data-task-id="${link.taskId}">
                                <i class="fas fa-undo"></i>
                                <span>Reset</span>
                            </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Get user task timers for admin view - integrated with localStorage data
    async getUserTaskTimers(userId) {
        try {
            const tasks = await window.firestoreManager.getTasks();
            const activeTasks = tasks.filter(task => task.status === 'active');
            const userTimers = [];

            for (const task of activeTasks) {
                const taskStatus = await window.firestoreManager.getTaskStatusForUser(userId, task.id);

                // Check if user has started the task (any status other than 'available' or 'locked')
                const isTaskStarted = taskStatus.status &&
                    taskStatus.status !== 'available' &&
                    taskStatus.status !== 'locked' &&
                    taskStatus.status !== 'completed';

                if (isTaskStarted) {
                    // Get the actual start time from localStorage simulation
                    // In a real implementation, this would be stored in the database
                    let startTime;
                    let remainingTime = 'Unknown';
                    let isExpired = false;

                    // Try to get start time from task status first
                    if (taskStatus.startedAt) {
                        startTime = taskStatus.startedAt.toDate ? taskStatus.startedAt.toDate() : new Date(taskStatus.startedAt);
                    } else {
                        // Estimate start time based on current status
                        // This is where the integration issue occurs - we need to sync localStorage data
                        startTime = new Date(Date.now() - 60 * 60 * 1000); // Default: 1 hour ago
                        console.log(`⚠️ No startedAt for ${task.title}, estimating start time - integration needed`);
                    }

                    const now = new Date();

                    // Calculate remaining time based on user time limit
                    if (task.userTimeLimit) {
                        const userCompletionDeadline = new Date(startTime.getTime() + (task.userTimeLimit * 60 * 1000));
                        const timeLeft = userCompletionDeadline.getTime() - now.getTime();

                        if (timeLeft <= 0) {
                            remainingTime = 'Expired';
                            isExpired = true;
                        } else {
                            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                            if (days > 0) {
                                remainingTime = `${days}d ${hours}h`;
                            } else if (hours > 0) {
                                remainingTime = `${hours}h ${minutes}m`;
                            } else if (minutes > 0) {
                                remainingTime = `${minutes}m ${seconds}s`;
                            } else {
                                remainingTime = `${seconds}s`;
                            }
                        }
                    }

                    userTimers.push({
                        taskId: task.id,
                        taskTitle: task.title,
                        status: taskStatus.status,
                        startTime: startTime.toISOString(),
                        remainingTime: remainingTime,
                        isExpired: isExpired,
                        userTimeLimit: task.userTimeLimit,
                        taskDeadline: task.deadline,
                        needsSync: !taskStatus.startedAt // Flag to indicate if sync is needed
                    });
                }
            }

            return userTimers;
        } catch (error) {
            console.error('Error getting user task timers:', error);
            return [];
        }
    }

    // Load admin timer view
    async loadAdminTimerView() {
        try {
            console.log('Loading admin timer view...');
            this.showLoading(true);

            const allUsers = await window.firestoreManager.getAllUsers();
            const regularUsers = allUsers.filter(user => !user.isAdmin && user.id !== this.currentUser?.uid);

            // Get timer data for all users
            const userTimerData = [];
            console.log(`🔍 Checking ${regularUsers.length} users for active timers...`);

            for (const user of regularUsers) {
                const timers = await this.getUserTaskTimers(user.id);
                console.log(`👤 User ${user.email}: ${timers.length} active timers`);

                if (timers.length > 0) {
                    userTimerData.push({
                        user: user,
                        timers: timers
                    });
                }
            }

            console.log(`📊 Total users with active timers: ${userTimerData.length}`);

            this.renderAdminTimerView(userTimerData);
        } catch (error) {
            console.error('Error loading admin timer view:', error);
            this.showToast('Failed to load timer view: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Render admin timer view
    renderAdminTimerView(userTimerData) {
        const timerViewContainer = document.getElementById('admin-content');
        if (!timerViewContainer) return;

        if (!userTimerData || userTimerData.length === 0) {
            timerViewContainer.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-clock text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Active Timers</h3>
                    <p class="text-gray-500">No users currently have active task timers.</p>
                </div>
            `;
            return;
        }

        timerViewContainer.innerHTML = `
            <div class="timer-management-container">
                <div class="timer-header">
                    <div class="header-left">
                        <h2 class="section-title">Live Task Timers</h2>
                        <p class="section-subtitle">Monitor active user task timers in real-time</p>
                    </div>
                    <div class="header-actions">
                        <button onclick="window.adminHandler.refreshTimerView()" class="admin-action-btn">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                        <button onclick="window.adminHandler.startTimerAutoRefresh()" class="admin-action-btn">
                            <i class="fas fa-play"></i>
                            Auto Refresh
                        </button>
                        <button onclick="window.adminHandler.stopTimerAutoRefresh()" class="admin-action-btn">
                            <i class="fas fa-pause"></i>
                            Stop Auto
                        </button>
                    </div>
                </div>

                <div class="timers-grid">
                    ${userTimerData.map(userData => this.renderUserTimerCard(userData)).join('')}
                </div>
            </div>
        `;

        // Start auto-refresh for live updates
        this.startTimerAutoRefresh();
    }

    // Render individual user timer card
    renderUserTimerCard(userData) {
        const { user, timers } = userData;
        const totalTasks = timers.length;
        const expiredTasks = timers.filter(t => t.isExpired).length;
        const activeTasks = totalTasks - expiredTasks;

        return `
            <div class="user-timer-card">
                <div class="user-timer-header">
                    <div class="user-info">
                        <h3 class="user-name">${user.displayName || user.email}</h3>
                        <p class="user-email">${user.email}</p>
                    </div>
                    <div class="user-stats">
                        <span class="stat-item active">
                            <i class="fas fa-check-circle"></i>
                            ${activeTasks} Active
                        </span>
                        <span class="stat-item expired">
                            <i class="fas fa-clock"></i>
                            ${expiredTasks} Expired
                        </span>
                    </div>
                </div>

                <div class="timers-list">
                    ${timers.map(timer => this.renderTimerRow(timer, user.id)).join('')}
                </div>
            </div>
        `;
    }

    // Render individual timer row
    renderTimerRow(timer, userId) {
        const statusColors = {
            'pending': 'text-yellow-600 bg-yellow-100',
            'dns_setup': 'text-blue-600 bg-blue-100',
            'unlocked': 'text-green-600 bg-green-100',
            'complete': 'text-purple-600 bg-purple-100',
            'completed': 'text-purple-600 bg-purple-100'
        };

        const timeColors = timer.isExpired ? 'text-red-600 bg-red-100' :
            timer.remainingTime.includes('m') && !timer.remainingTime.includes('d') && !timer.remainingTime.includes('h') ? 'text-orange-600 bg-orange-100' :
                'text-green-600 bg-green-100';

        return `
            <div class="timer-row">
                <div class="timer-info">
                    <div class="timer-title-section">
                        <h4 class="timer-title">${timer.taskTitle}</h4>
                        <span class="timer-status ${statusColors[timer.status] || 'text-gray-600 bg-gray-100'}">
                            ${timer.status.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                    <div class="timer-details">
                        <span class="detail-item">Started: ${new Date(timer.startTime).toLocaleString()}</span>
                        <span class="detail-item">Limit: ${timer.userTimeLimit ? Math.floor(timer.userTimeLimit / 60) + 'h' : 'N/A'}</span>
                    </div>
                </div>
                <div class="timer-actions">
                    <span class="timer-countdown ${timeColors}">
                        ${timer.remainingTime}
                    </span>
                    ${timer.isExpired ? `
                        <button onclick="window.adminHandler.restartUserTask('${timer.taskId}', '${userId}')" 
                                class="restart-btn">
                            <i class="fas fa-redo"></i>
                            Restart
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Refresh timer view
    refreshTimerView() {
        this.loadAdminTimerView();
    }

    // Start auto-refresh for timers
    startTimerAutoRefresh() {
        if (this.timerRefreshInterval) {
            clearInterval(this.timerRefreshInterval);
        }

        this.timerRefreshInterval = setInterval(() => {
            this.loadAdminTimerView();
        }, 10000); // Refresh every 10 seconds

        this.showToast('Auto-refresh started (every 10 seconds)', 'info');
    }

    // Stop auto-refresh for timers
    stopTimerAutoRefresh() {
        if (this.timerRefreshInterval) {
            clearInterval(this.timerRefreshInterval);
            this.timerRefreshInterval = null;
            this.showToast('Auto-refresh stopped', 'info');
        }
    }

    // Restart user task from admin
    async restartUserTask(taskId, userId) {
        try {
            console.log(`Admin restarting task ${taskId} for user ${userId}`);

            // Clear task status
            await window.firestoreManager.updateTaskStatus(taskId, 'available', userId);

            // Clear any existing verifications
            const verifications = await window.firestoreManager.getVerificationsByUser(userId);
            const taskVerifications = verifications.filter(v => v.taskId === taskId);

            for (const verification of taskVerifications) {
                await window.firestoreManager.deleteVerification(verification.id);
            }

            // Create notification for user
            await window.firestoreManager.createAdminNotification(userId, {
                type: 'task_restarted',
                title: '🔄 Task Restarted by Admin',
                message: 'Your task has been restarted by an admin. You can now begin again.',
                data: { taskId: taskId }
            });

            this.showToast(`Task restarted for user successfully!`, 'success');
            this.loadAdminTimerView();
        } catch (error) {
            console.error('Error restarting user task:', error);
            this.showToast('Failed to restart task: ' + error.message, 'error');
        }
    }

    // Sync all user timers from localStorage to database
    async syncAllUserTimers() {
        try {
            console.log('🔄 Syncing all user timers to database...');
            this.showLoading(true);

            const allUsers = await window.firestoreManager.getAllUsers();
            const regularUsers = allUsers.filter(user => !user.isAdmin && user.id !== this.currentUser?.uid);

            let syncedCount = 0;

            for (const user of regularUsers) {
                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');

                for (const task of activeTasks) {
                    // Check if user has started this task
                    const taskStatus = await window.firestoreManager.getTaskStatusForUser(user.id, task.id);
                    const isTaskStarted = taskStatus.status &&
                        taskStatus.status !== 'available' &&
                        taskStatus.status !== 'locked' &&
                        taskStatus.status !== 'completed';

                    if (isTaskStarted && !taskStatus.startedAt) {
                        // This user has started a task but doesn't have start time in database
                        // We can't access their localStorage, so we'll estimate and mark for sync
                        await window.firestoreManager.updateTaskStatus(task.id, taskStatus.status, user.id, {
                            startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago estimate
                            timerSynced: false,
                            needsUserSync: true
                        });
                        syncedCount++;
                        console.log(`📡 Marked task ${task.title} for user ${user.email} as needing sync`);
                    }
                }
            }

            // Silently update timers without showing toast message
            console.log(`📊 Silently updated ${syncedCount} user timers`);
            this.loadAdminTimerView(); // Refresh the view

        } catch (error) {
            console.error('Error syncing user timers:', error);
            this.showToast('Failed to sync user timers: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Debug function to manually test timer detection
    async debugTimerDetection() {
        try {
            console.log('🔍 Debugging timer detection...');

            const allUsers = await window.firestoreManager.getAllUsers();
            const regularUsers = allUsers.filter(user => !user.isAdmin && user.id !== this.currentUser?.uid);

            console.log(`👥 Found ${regularUsers.length} regular users`);

            for (const user of regularUsers) {
                console.log(`\n👤 User: ${user.email} (${user.id})`);

                const tasks = await window.firestoreManager.getTasks();
                const activeTasks = tasks.filter(task => task.status === 'active');

                for (const task of activeTasks) {
                    const taskStatus = await window.firestoreManager.getTaskStatusForUser(user.id, task.id);
                    console.log(`  📋 ${task.title}: status="${taskStatus.status}"`);

                    // Simple check: if user has any status other than 'available' or 'locked', they started the task
                    const isTaskStarted = taskStatus.status &&
                        taskStatus.status !== 'available' &&
                        taskStatus.status !== 'locked' &&
                        taskStatus.status !== 'completed';

                    console.log(`    🎯 Should show timer: ${isTaskStarted}`);

                    if (isTaskStarted && task.userTimeLimit) {
                        console.log(`    ⏰ User time limit: ${task.userTimeLimit} minutes (${Math.floor(task.userTimeLimit / 60)} hours)`);
                    }
                }
            }
        } catch (error) {
            console.error('Error debugging timer detection:', error);
        }
    }

    renderAdminUsers(users) {
        const usersList = document.getElementById('users-list');
        if (!usersList) return;

        if (!users || users.length === 0) {
            usersList.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-users text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No users found</p>
                </div>
            `;
            return;
        }

        usersList.innerHTML = users.map(user => this.createUserCard(user)).join('');
    }

    createUserCard(user) {
        const statusConfig = this.getUserStatusConfig(user.status);
        const joinDate = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown';
        const questaId = this.generateQuestaId(user.id);

        return `
            <div class="user-card">
                <div class="user-card-header">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-info">
                        <div class="user-name">${user.displayName || user.email}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                
                <div class="user-stats">
                    <div class="user-stat">
                        <div class="stat-label">Balance</div>
                        <div class="stat-value">₱${user.walletBalance || 0}</div>
                    </div>
                    <div class="user-stat">
                        <div class="stat-label">Status</div>
                        <div class="stat-value ${statusConfig.class}">${statusConfig.text}</div>
                    </div>
                </div>
                
                <div class="user-actions">
                    <button class="user-action-btn primary view-activity-btn" data-user-id="${user.id}">
                        <i class="fas fa-eye"></i>
                        View Activity
                    </button>
                    <button class="user-action-btn ${statusConfig.status === 'disabled' ? 'success' : 'danger'} toggle-status-btn" data-user-id="${user.id}">
                        <i class="fas fa-${statusConfig.status === 'disabled' ? 'check' : 'ban'}"></i>
                        ${statusConfig.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button class="user-action-btn primary manage-balance-btn" data-user-id="${user.id}">
                        <i class="fas fa-wallet"></i>
                        Manage Balance
                    </button>
                </div>
            </div>
        `;
    }

    async showUserActivity(userId) {
        try {
            console.log('👤 Showing user activity for:', userId);

            // Get user data
            const user = await window.firestoreManager.getUser(userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            // Update modal with user info
            document.getElementById('activity-user-name').textContent = user.displayName || user.email;
            document.getElementById('activity-user-email').textContent = user.email;
            document.getElementById('activity-user-balance').textContent = `Balance: ₱${user.walletBalance || 0}`;

            // Load user activities
            await this.loadUserVerifications(userId);
            await this.loadUserWithdrawals(userId);

            // Show modal
            document.getElementById('user-activity-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';

        } catch (error) {
            console.error('❌ Error showing user activity:', error);
            this.showToast('Failed to load user activity: ' + error.message, 'error');
        }
    }

    closeUserActivityModal() {
        document.getElementById('user-activity-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    switchActivityTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.activity-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-activity-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.activity-tab-content').forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-activity`).classList.remove('hidden');
        document.getElementById(`${tabName}-activity`).classList.add('active');
    }

    async loadUserVerifications(userId) {
        try {
            const verifications = await window.firestoreManager.getVerificationsByUser(userId);
            const verificationsList = document.getElementById('user-verifications-list');

            if (!verificationsList) return;

            if (verifications.length === 0) {
                verificationsList.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-check-circle text-4xl mb-4"></i>
                        <p>No verifications found</p>
                    </div>
                `;
                return;
            }

            verificationsList.innerHTML = verifications.map(verification => {
                const statusConfig = this.getVerificationStatusConfig(verification.status);
                return `
                    <div class="activity-item">
                        <div class="activity-icon ${statusConfig.iconClass}">
                            <i class="fas ${statusConfig.icon}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">
                                <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                                ${verification.phase === 'initial' ? 'Phase 1' : 'Phase 2'} verification
                            </div>
                            <div class="activity-time">${verification.createdAt?.toDate().toLocaleString() || 'Unknown'}</div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Error loading user verifications:', error);
        }
    }

    async loadUserWithdrawals(userId) {
        try {
            const withdrawals = await window.firestoreManager.getWithdrawalsByUser(userId);
            const withdrawalsList = document.getElementById('user-withdrawals-list');

            if (!withdrawalsList) return;

            if (withdrawals.length === 0) {
                withdrawalsList.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-money-bill-wave text-4xl mb-4"></i>
                        <p>No withdrawals found</p>
                    </div>
                `;
                return;
            }

            withdrawalsList.innerHTML = withdrawals.map(withdrawal => {
                const statusConfig = this.getWithdrawalStatusConfig(withdrawal.status);
                return `
                    <div class="activity-item">
                        <div class="activity-icon ${statusConfig.iconClass}">
                            <i class="fas ${statusConfig.icon}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">
                                <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                                Withdrawal: ₱${withdrawal.amount}
                            </div>
                            <div class="activity-time">${withdrawal.createdAt?.toDate().toLocaleString() || 'Unknown'}</div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Error loading user withdrawals:', error);
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

    getUserStatusConfig(status) {
        // Handle undefined/null status - default to active
        const userStatus = status || 'active';

        switch (userStatus) {
            case 'active':
                return {
                    status: 'active',
                    text: 'Active',
                    class: 'text-green-600',
                    badgeClass: 'status-approved',
                    label: 'Active',
                    buttonClass: 'btn-danger',
                    buttonText: 'Disable Account'
                };
            case 'disabled':
                return {
                    status: 'disabled',
                    text: 'Disabled',
                    class: 'text-red-600',
                    badgeClass: 'status-rejected',
                    label: 'Disabled',
                    buttonClass: 'btn-success',
                    buttonText: 'Enable Account'
                };
            default:
                return {
                    status: 'active',
                    text: 'Active',
                    class: 'text-green-600',
                    badgeClass: 'status-approved',
                    label: 'Active',
                    buttonClass: 'btn-danger',
                    buttonText: 'Disable Account'
                };
        }
    }

    getVerificationStatusConfig(status) {
        switch (status) {
            case 'approved':
                return {
                    label: 'Approved',
                    badgeClass: 'status-approved',
                    icon: 'fa-check-circle',
                    iconClass: 'icon-success'
                };
            case 'rejected':
                return {
                    label: 'Rejected',
                    badgeClass: 'status-rejected',
                    icon: 'fa-times-circle',
                    iconClass: 'icon-danger'
                };
            case 'pending':
                return {
                    label: 'Pending',
                    badgeClass: 'status-pending',
                    icon: 'fa-clock',
                    iconClass: 'icon-warning'
                };
            default:
                return {
                    label: 'Unknown',
                    badgeClass: 'status-pending',
                    icon: 'fa-question-circle',
                    iconClass: 'icon-warning'
                };
        }
    }

    getWithdrawalStatusConfig(status) {
        switch (status) {
            case 'approved':
            case 'paid':
                return {
                    label: 'Paid',
                    badgeClass: 'status-approved',
                    icon: 'fa-check-circle',
                    iconClass: 'icon-success'
                };
            case 'rejected':
                return {
                    label: 'Rejected',
                    badgeClass: 'status-rejected',
                    icon: 'fa-times-circle',
                    iconClass: 'icon-danger'
                };
            case 'pending':
                return {
                    label: 'Pending',
                    badgeClass: 'status-pending',
                    icon: 'fa-clock',
                    iconClass: 'icon-warning'
                };
            default:
                return {
                    label: 'Unknown',
                    badgeClass: 'status-pending',
                    icon: 'fa-question-circle',
                    iconClass: 'icon-warning'
                };
        }
    }

    async toggleUserStatus(userId) {
        try {
            const user = this.users.find(u => u.id === userId);
            if (!user) {
                console.log('Available users:', this.users.map(u => ({ id: u.id, email: u.email })));
                console.log('Looking for userId:', userId);
                this.showToast('User not found', 'error');
                return;
            }

            const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
            const action = newStatus === 'disabled' ? 'disable' : 'enable';

            if (confirm(`Are you sure you want to ${action} this user's account?`)) {
                this.showLoading(true);

                await window.firestoreManager.updateUserStatus(userId, newStatus);

                this.showToast(`User account ${action}d successfully!`, 'success');
                await this.loadAdminUsers();

            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showToast('Failed to update user status: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Settings management
    async loadSettings() {
        try {
            console.log('⚙️ Loading settings...');

            // Load settings from Firestore
            const settingsDoc = await db.collection('settings').doc('app').get();
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();

                // Populate form fields
                document.getElementById('support-email').value = settings.supportEmail || 'support@example.com';
                document.getElementById('admin-email').value = settings.adminEmail || 'admin@example.com';
                document.getElementById('site-name').value = settings.siteName || 'Questa';
                document.getElementById('site-url').value = settings.siteUrl || '';
                document.getElementById('withdrawal-cooldown').value = settings.withdrawalCooldown || 300;
                document.getElementById('max-withdrawal').value = settings.maxWithdrawal || 10000;
            } else {
                // Set default values
                document.getElementById('support-email').value = 'support@example.com';
                document.getElementById('admin-email').value = 'admin@example.com';
                document.getElementById('site-name').value = 'Questa';
                document.getElementById('site-url').value = '';
                document.getElementById('withdrawal-cooldown').value = 300;
                document.getElementById('max-withdrawal').value = 10000;
            }

            console.log('✅ Settings loaded');
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            this.showToast('Failed to load settings: ' + error.message, 'error');
        }
    }

    async saveSettings() {
        try {
            console.log('💾 Saving settings...');

            const settings = {
                supportEmail: document.getElementById('support-email').value,
                adminEmail: document.getElementById('admin-email').value,
                siteName: document.getElementById('site-name').value,
                siteUrl: document.getElementById('site-url').value,
                withdrawalCooldown: parseInt(document.getElementById('withdrawal-cooldown').value),
                maxWithdrawal: parseFloat(document.getElementById('max-withdrawal').value),
                updatedAt: new Date()
            };

            // Validate settings
            if (!settings.supportEmail || !settings.adminEmail) {
                this.showToast('❌ Please fill in all required email fields', 'error');
                return;
            }

            if (settings.withdrawalCooldown < 0) {
                this.showToast('❌ Withdrawal cooldown must be 0 or greater', 'error');
                return;
            }

            if (settings.maxWithdrawal <= 0) {
                this.showToast('❌ Max withdrawal amount must be greater than 0', 'error');
                return;
            }

            // Save to Firestore
            await db.collection('settings').doc('app').set(settings);

            this.showToast('✅ Settings saved successfully!', 'success');
            console.log('✅ Settings saved');

        } catch (error) {
            console.error('❌ Error saving settings:', error);
            this.showToast('Failed to save settings: ' + error.message, 'error');
        }
    }

    // Enhanced Task Management
    async createTask(taskData) {
        try {
            console.log('📝 Creating new task...');

            const taskId = await window.firestoreManager.createTask(taskData);

            this.showToast('✅ Task created successfully!', 'success');
            await this.loadAdminTasks();

            return taskId;
        } catch (error) {
            console.error('❌ Error creating task:', error);
            this.showToast('Failed to create task: ' + error.message, 'error');
            throw error;
        }
    }

    async updateTask(taskId, taskData) {
        try {
            console.log('📝 Updating task...');

            await window.firestoreManager.updateTask(taskId, taskData);

            this.showToast('✅ Task updated successfully!', 'success');
            await this.loadAdminTasks();

        } catch (error) {
            console.error('❌ Error updating task:', error);
            this.showToast('Failed to update task: ' + error.message, 'error');
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            console.log('🗑️ Deleting task...');

            await window.firestoreManager.deleteTask(taskId);

            this.showToast('✅ Task deleted successfully!', 'success');
            await this.loadAdminTasks();

        } catch (error) {
            console.error('❌ Error deleting task:', error);
            this.showToast('Failed to delete task: ' + error.message, 'error');
            throw error;
        }
    }

    // Task Submission Management
    async loadTaskSubmissions() {
        try {
            console.log('📋 Loading task submissions...');

            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            this.renderTaskSubmissions(submissions);

        } catch (error) {
            console.error('❌ Error loading task submissions:', error);
            this.showToast('Failed to load submissions: ' + error.message, 'error');
        }
    }

    renderTaskSubmissions(submissions) {
        const container = document.getElementById('verifications-list');
        if (!container) return;

        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Submissions</h3>
                    <p class="text-gray-500">No task submissions to review yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = submissions.map(submission => `
            <div class="submission-card">
                <div class="submission-header">
                    <div class="submission-info">
                        <h4 class="submission-title">${submission.task?.title || 'Unknown Task'}</h4>
                        <p class="submission-user">${submission.user?.email || 'Unknown User'}</p>
                    </div>
                    <div class="submission-status">
                        <span class="status-badge status-${submission.status}">
                            ${this.getStatusIcon(submission.status)} ${submission.status.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <div class="submission-content">
                    <div class="submission-details">
                        <div class="detail-row">
                            <span class="detail-label">Reward:</span>
                            <span class="detail-value">₱${submission.task?.reward || 0}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Submitted:</span>
                            <span class="detail-value">${new Date(submission.created_at?.toDate()).toLocaleString()}</span>
                        </div>
                        ${submission.restart_count > 0 ? `
                            <div class="detail-row">
                                <span class="detail-label">Restarts:</span>
                                <span class="detail-value">${submission.restart_count}</span>
                            </div>
                        ` : ''}
                        ${submission.referrer_email ? `
                            <div class="detail-row">
                                <span class="detail-label">Referrer:</span>
                                <span class="detail-value">${submission.referrer_email}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${submission.proof_image_url ? `
                        <div class="proof-section">
                            <h5 class="proof-title">Proof Image:</h5>
                            <img src="${submission.proof_image_url}" alt="Proof" class="proof-image" onclick="window.adminHandler.showProofModal('${submission.proof_image_url}')">
                        </div>
                    ` : ''}
                    
                    ${submission.notes ? `
                        <div class="notes-section">
                            <h5 class="notes-title">User Notes:</h5>
                            <p class="notes-content">${submission.notes}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="submission-actions">
                    ${submission.status === 'pending_review' ? `
                        <button class="btn-approve" onclick="window.adminHandler.approveTaskSubmission('${submission.id}')">
                            <i class="fas fa-check"></i>
                            Approve
                        </button>
                        <button class="btn-reject" onclick="window.adminHandler.rejectTaskSubmission('${submission.id}')">
                            <i class="fas fa-times"></i>
                            Reject
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async approveTaskSubmission(submissionId) {
        try {
            console.log('✅ Approving task submission...');

            await window.firestoreManager.updateTaskSubmission(submissionId, 'approved');

            this.showToast('✅ Task submission approved!', 'success');
            await this.loadTaskSubmissions();

        } catch (error) {
            console.error('❌ Error approving submission:', error);
            this.showToast('Failed to approve submission: ' + error.message, 'error');
        }
    }

    async rejectTaskSubmission(submissionId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            console.log('❌ Rejecting task submission...');

            await window.firestoreManager.updateTaskSubmission(submissionId, 'rejected', reason);

            this.showToast('❌ Task submission rejected', 'info');
            await this.loadTaskSubmissions();

        } catch (error) {
            console.error('❌ Error rejecting submission:', error);
            this.showToast('Failed to reject submission: ' + error.message, 'error');
        }
    }

    // Withdrawal Management
    async loadWithdrawals() {
        try {
            console.log('💰 Loading withdrawals...');

            const withdrawals = await window.firestoreManager.getWithdrawals('all');
            this.renderWithdrawals(withdrawals);

        } catch (error) {
            console.error('❌ Error loading withdrawals:', error);
            this.showToast('Failed to load withdrawals: ' + error.message, 'error');
        }
    }

    renderWithdrawals(withdrawals) {
        const container = document.getElementById('withdrawals-list');
        if (!container) return;

        if (withdrawals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-money-bill-wave text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Withdrawals</h3>
                    <p class="text-gray-500">No withdrawal requests to review yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = withdrawals.map(withdrawal => `
            <div class="withdrawal-card">
                <div class="withdrawal-header">
                    <div class="withdrawal-info">
                        <h4 class="withdrawal-user">${withdrawal.user?.email || 'Unknown User'}</h4>
                        <p class="withdrawal-amount">₱${withdrawal.amount}</p>
                    </div>
                    <div class="withdrawal-status">
                        <span class="status-badge status-${withdrawal.status}">
                            ${this.getStatusIcon(withdrawal.status)} ${withdrawal.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <div class="withdrawal-content">
                    <div class="withdrawal-details">
                        <div class="detail-row">
                            <span class="detail-label">Method:</span>
                            <span class="detail-value">${withdrawal.method}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Account Name:</span>
                            <span class="detail-value">${withdrawal.account_name || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone Number:</span>
                            <span class="detail-value">${withdrawal.account_details}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested:</span>
                            <span class="detail-value">${new Date(withdrawal.created_at?.toDate()).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <div class="withdrawal-actions">
                    ${withdrawal.status === 'pending' ? `
                        <button class="btn-approve" onclick="window.adminHandler.approveWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-check"></i>
                            Approve
                        </button>
                        <button class="btn-reject" onclick="window.adminHandler.rejectWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-times"></i>
                            Reject
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async approveWithdrawal(withdrawalId) {
        try {
            console.log('✅ Approving withdrawal...');

            await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'approved');

            this.showToast('✅ Withdrawal approved!', 'success');
            await this.loadWithdrawals();

        } catch (error) {
            console.error('❌ Error approving withdrawal:', error);
            this.showToast('Failed to approve withdrawal: ' + error.message, 'error');
        }
    }

    async rejectWithdrawal(withdrawalId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            console.log('❌ Rejecting withdrawal...');

            // Get withdrawal data to restore balance
            const withdrawalDoc = await db.collection('withdrawals').doc(withdrawalId).get();
            if (!withdrawalDoc.exists) {
                this.showToast('Withdrawal not found', 'error');
                return;
            }

            const withdrawalData = withdrawalDoc.data();
            const userId = withdrawalData.user_id || withdrawalData.userId;
            const amount = withdrawalData.amount;

            if (!userId || !amount) {
                this.showToast('Invalid withdrawal data', 'error');
                return;
            }

            // Update withdrawal status
            await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'rejected', reason);

            // Restore user's balance
            await window.firestoreManager.updateWalletBalance(userId, amount);

            this.showToast('❌ Withdrawal rejected and balance restored!', 'success');
            await this.loadWithdrawals();

        } catch (error) {
            console.error('❌ Error rejecting withdrawal:', error);
            this.showToast('Failed to reject withdrawal: ' + error.message, 'error');
        }
    }

    // Utility Methods
    getStatusIcon(status) {
        const icons = {
            'pending_review': 'fas fa-hourglass-half',
            'approved': 'fas fa-check-circle',
            'rejected': 'fas fa-times-circle',
            'pending': 'fas fa-clock',
            'paid': 'fas fa-check-circle',
            'completed': 'fas fa-trophy'
        };
        return icons[status] || 'fas fa-question-circle';
    }

    showProofModal(imageUrl) {
        // Create and show proof image modal
        const modal = document.createElement('div');
        modal.className = 'proof-modal';
        modal.innerHTML = `
            <div class="proof-modal-overlay" onclick="this.parentElement.remove()">
                <div class="proof-modal-content" onclick="event.stopPropagation()">
                    <div class="proof-modal-header">
                        <h3>Proof Image</h3>
                        <button onclick="this.closest('.proof-modal').remove()" class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="proof-modal-body">
                        <img src="${imageUrl}" alt="Proof" class="proof-modal-image">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize admin handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminHandler = new AdminHandler();
});
