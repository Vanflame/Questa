// Simplified Admin Handler - Removed hardcoded configurations
class AdminHandler {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.tasks = [];
        this.verifications = [];
        this.withdrawals = [];
        this.users = [];
        this.stats = {
            totalUsers: 0,
            totalTasks: 0,
            pendingVerifications: 0,
            pendingWithdrawals: 0
        };
        this.currentSearchTerm = '';
        this.verificationSearchTerm = '';
        this.withdrawalSearchTerm = '';
        this.userSearchTerm = '';
    }

    // Unique Reference Generation System
    generateUniqueReference(type) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const prefix = type === 'withdrawal' ? 'QW' : 'QV';
        return `${prefix}${timestamp.slice(-6)}${random}`;
    }

    async generateAndStoreReference(type, documentId) {
        try {
            const reference = this.generateUniqueReference(type);

            // Store the reference in the document
            const collection = type === 'withdrawal' ? 'withdrawals' : 'task_submissions';
            await db.collection(collection).doc(documentId).update({
                referenceNumber: reference,
                updatedAt: new Date()
            });

            return reference;
        } catch (error) {
            console.error(`Error generating reference for ${type}:`, error);
            return null;
        }
    }

    async init() {
        try {
            console.log('🔧 Initializing Admin Handler...');

            // Wait for auth manager to be available and user to be loaded
            await this.waitForAuth();

            if (!this.currentUser) {
                console.log('❌ No authenticated user found');
                window.location.href = '/login/';
                return;
            }

            console.log('👤 Current user:', this.currentUser.email);

            await this.checkAdminStatus();
            console.log('🔍 Admin status after check:', this.isAdmin);

            if (this.isAdmin) {
                console.log('✅ User is admin, setting up admin panel...');
                this.setupEventListeners();
                this.setupTabNavigation();
                await this.loadAdminData();
                console.log('✅ Admin Handler initialized successfully');
            } else {
                console.log('❌ User is not an admin, redirecting to dashboard');
                window.location.href = '/dashboard/';
            }
        } catch (error) {
            console.error('❌ Error initializing Admin Handler:', error);
            this.showToast('Failed to initialize admin panel', 'error');
        }
    }

    async waitForAuth() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait time

            // If auth manager is already available and user is loaded
            if (window.authManager && window.authManager.getCurrentUser()) {
                this.currentUser = window.authManager.getCurrentUser();
                resolve();
                return;
            }

            // Wait for auth manager to be available
            const checkAuth = () => {
                attempts++;

                if (attempts > maxAttempts) {
                    console.error('❌ Timeout waiting for authentication');
                    reject(new Error('Authentication timeout'));
                    return;
                }

                if (window.authManager) {
                    const user = window.authManager.getCurrentUser();
                    if (user) {
                        this.currentUser = user;
                        resolve();
                    } else {
                        // Wait a bit more for auth state to resolve
                        setTimeout(checkAuth, 100);
                    }
                } else {
                    // Wait for auth manager to be initialized
                    setTimeout(checkAuth, 100);
                }
            };

            checkAuth();
        });
    }

    async checkAdminStatus() {
        try {
            const user = await window.firestoreManager.getUser(this.currentUser.uid);
            this.isAdmin = user?.isAdmin || false;
            console.log('🔍 Admin status:', this.isAdmin);
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
        }
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.signOut();
        });

        // Switch to user view
        document.getElementById('switch-to-user')?.addEventListener('click', () => {
            window.location.href = '/dashboard/';
        });

        // Refresh data button
        document.getElementById('refresh-data-btn')?.addEventListener('click', () => {
            this.loadAdminData();
        });

        // Refresh verifications button
        document.getElementById('refresh-verifications-btn')?.addEventListener('click', () => {
            this.loadTaskSubmissions();
        });

        // Refresh withdrawals button
        document.getElementById('refresh-withdrawals-btn')?.addEventListener('click', () => {
            this.loadWithdrawals();
        });

        // User search functionality
        document.getElementById('user-search')?.addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        // User filters
        document.getElementById('user-status-filter')?.addEventListener('change', (e) => {
            this.filterUsers();
        });

        document.getElementById('user-sort-filter')?.addEventListener('change', (e) => {
            this.sortUsers();
        });

        // Verification search functionality
        document.getElementById('verification-search')?.addEventListener('input', (e) => {
            this.searchVerifications(e.target.value);
        });

        // Verification filters
        document.getElementById('verification-status-filter')?.addEventListener('change', (e) => {
            this.filterVerifications();
        });

        document.getElementById('verification-sort-filter')?.addEventListener('change', (e) => {
            this.sortVerifications();
        });

        // Withdrawal search functionality
        document.getElementById('withdrawal-search')?.addEventListener('input', (e) => {
            this.searchWithdrawals(e.target.value);
        });

        // Withdrawal filters
        document.getElementById('withdrawal-status-filter')?.addEventListener('change', (e) => {
            this.filterWithdrawals();
        });

        document.getElementById('withdrawal-sort-filter')?.addEventListener('change', (e) => {
            this.sortWithdrawals();
        });

        // Add task button
        document.getElementById('add-task-btn')?.addEventListener('click', () => {
            this.showAddTaskModal();
        });

        // Tab navigation
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-admin-tab');
                this.switchAdminTab(tab);
            });
        });

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Close buttons
        document.querySelectorAll('.close-btn, .modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });
    }

    setupTabNavigation() {
        this.switchAdminTab('overview');
    }

    async switchAdminTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);

        // Hide all tabs
        document.querySelectorAll('.admin-tab-content').forEach(tab => {
            tab.classList.add('hidden');
            console.log('📋 Hiding tab:', tab.id);
        });

        // Remove active class from all buttons
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        const selectedBtn = document.querySelector(`[data-admin-tab="${tabName}"]`);

        console.log('📋 Selected tab element:', selectedTab);
        console.log('📋 Selected button element:', selectedBtn);

        if (selectedTab) {
            selectedTab.classList.remove('hidden');
            console.log('✅ Tab shown:', selectedTab.id);
        } else {
            console.log('❌ Tab not found:', `${tabName}-tab`);
        }

        if (selectedBtn) {
            selectedBtn.classList.add('active');
            console.log('✅ Button activated:', selectedBtn);
        } else {
            console.log('❌ Button not found for tab:', tabName);
        }

        // Load tab-specific data
        switch (tabName) {
            case 'overview':
                await this.loadStats();
                await this.loadRecentActivity();
                break;
            case 'tasks-admin':
                await this.loadTasks();
                break;
            case 'verifications':
                await this.loadTaskSubmissions();
                break;
            case 'withdrawals':
                await this.loadWithdrawals();
                break;
            case 'users':
                await this.loadUsers();
                break;
        }
    }

    async loadAdminData() {
        try {
            console.log('📊 Loading admin data...');

            // First, let's see what collections exist in Firebase
            await this.listAllCollections();

            // Load tasks first, then other data
            await this.loadTasks();

            await Promise.all([
                this.loadStats(),
                this.loadTaskSubmissions(),
                this.loadWithdrawals(),
                this.loadUsers()
            ]);
            console.log('✅ Admin data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading admin data:', error);
            this.showToast('Failed to load admin data', 'error');
        }
    }

    async listAllCollections() {
        try {
            console.log('🔍 Listing all Firebase collections...');

            // Note: Firestore doesn't have a direct way to list collections from client side
            // But we can try to access common collection names and see what exists
            const commonCollections = [
                'users', 'Users', 'user', 'User',
                'tasks', 'Tasks', 'task', 'Task', 'quests', 'Quests',
                'submissions', 'Submissions', 'task_submissions', 'taskSubmissions',
                'withdrawals', 'Withdrawals', 'withdrawal', 'Withdrawal',
                'verifications', 'Verifications', 'verification', 'Verification',
                'balances', 'Balances', 'balance', 'Balance',
                'questStatuses', 'quest_statuses', 'taskStatuses', 'task_statuses',
                'immutableLinks', 'immutable_links', 'immutableLinks',
                'questCompletions', 'quest_completions', 'questCompletions',
                'liveTimers', 'live_timers', 'liveTimers',
                'settings', 'Settings', 'setting', 'Setting'
            ];

            const existingCollections = [];

            for (const collectionName of commonCollections) {
                try {
                    const snapshot = await db.collection(collectionName).limit(1).get();
                    if (!snapshot.empty) {
                        existingCollections.push({
                            name: collectionName,
                            count: snapshot.size,
                            firstDoc: snapshot.docs[0].data()
                        });
                        console.log(`✅ Collection found: ${collectionName} (${snapshot.size} documents)`);
                    }
                } catch (error) {
                    // Collection doesn't exist or error accessing it
                }
            }

            console.log('📋 All existing collections:', existingCollections);
            return existingCollections;
        } catch (error) {
            console.error('❌ Error listing collections:', error);
            return [];
        }
    }

    async loadStats() {
        try {
            console.log('📊 Loading stats...');

            if (!window.firestoreManager) {
                console.error('❌ FirestoreManager not available');
                return;
            }

            // Let's check what collections actually exist
            console.log('🔍 Checking Firebase collections...');

            // Try to get data from different possible collection names
            const [users, tasks, submissions, withdrawals] = await Promise.all([
                this.getUsersFromFirebase(),
                this.getTasksFromFirebase(),
                this.getSubmissionsFromFirebase(),
                this.getWithdrawalsFromFirebase()
            ]);

            // Filter for actual pending items
            const pendingSubmissions = submissions.filter(sub =>
                sub.status === 'pending_review' || sub.status === 'pending'
            );
            const pendingWithdrawals = withdrawals.filter(withdrawal =>
                withdrawal.status === 'pending'
            );

            console.log('📊 Stats data:', {
                users: users.length,
                tasks: tasks.length,
                submissions: submissions.length,
                withdrawals: withdrawals.length,
                pendingSubmissions: pendingSubmissions.length,
                pendingWithdrawals: pendingWithdrawals.length
            });

            this.stats = {
                totalUsers: users.length,
                totalTasks: tasks.length,
                pendingVerifications: pendingSubmissions.length,
                pendingWithdrawals: pendingWithdrawals.length
            };

            this.updateStatsDisplay();
            console.log('✅ Stats loaded and displayed');
        } catch (error) {
            console.error('❌ Error loading stats:', error);
        }
    }

    updateStatsDisplay() {
        document.getElementById('total-users').textContent = this.stats.totalUsers;
        document.getElementById('total-tasks').textContent = this.stats.totalTasks;
        document.getElementById('pending-verifications').textContent = this.stats.pendingVerifications;
        document.getElementById('pending-withdrawals').textContent = this.stats.pendingWithdrawals;
    }

    // Helper methods to check different collection names
    async getUsersFromFirebase() {
        try {
            console.log('🔍 Getting users from Firebase...');

            const snapshot = await db.collection('users').get();
            console.log(`✅ Found users in collection: users (${snapshot.size} documents)`);

            // Filter out admin users
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const regularUsers = allUsers.filter(user => !user.isAdmin);

            console.log(`📊 Filtered users: ${allUsers.length} total, ${regularUsers.length} regular users (excluded ${allUsers.length - regularUsers.length} admins)`);
            return regularUsers;
        } catch (error) {
            console.error('❌ Error getting users:', error);
            return [];
        }
    }

    async getTasksFromFirebase() {
        try {
            console.log('🔍 Getting tasks from Firebase...');

            // Use the firestore manager to get all tasks (including inactive ones)
            const tasks = await window.firestoreManager.getAllTasks();
            console.log(`✅ Found tasks: ${tasks.length} documents`);
            return tasks;
        } catch (error) {
            console.error('❌ Error getting tasks:', error);
            return [];
        }
    }

    async getSubmissionsFromFirebase() {
        try {
            console.log('🔍 Getting submissions from Firebase...');

            const snapshot = await db.collection('task_submissions').get();
            console.log(`✅ Found submissions in collection: task_submissions (${snapshot.size} documents)`);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('❌ Error getting submissions:', error);
            return [];
        }
    }

    async getWithdrawalsFromFirebase() {
        try {
            console.log('🔍 Getting withdrawals from Firebase...');

            const snapshot = await db.collection('withdrawals').get();
            console.log(`✅ Found withdrawals in collection: withdrawals (${snapshot.size} documents)`);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('❌ Error getting withdrawals:', error);
            return [];
        }
    }

    async loadRecentActivity() {
        try {
            console.log('📋 Loading recent activity...');
            const container = document.getElementById('recent-activity-list');
            if (!container) {
                console.log('❌ Recent activity container not found');
                return;
            }

            if (!window.firestoreManager) {
                console.error('❌ FirestoreManager not available for recent activity');
                return;
            }

            // Get recent submissions and withdrawals using our new methods
            const [submissions, withdrawals] = await Promise.all([
                this.getSubmissionsFromFirebase(),
                this.getWithdrawalsFromFirebase()
            ]);

            console.log('📋 Raw data:', { submissions: submissions.length, withdrawals: withdrawals.length });
            console.log('📋 Submissions:', submissions);
            console.log('📋 Withdrawals:', withdrawals);

            // Combine and sort by date
            const activities = [
                ...submissions.map(s => ({
                    type: 'submission',
                    id: s.id,
                    user: s.user?.email || s.userId || 'Unknown User',
                    userShortId: this.generateShortUserId(s.userId || s.user?.id),
                    task: s.task?.title || s.taskId || 'Unknown Task',
                    status: s.status,
                    date: s.created_at?.toDate ? s.created_at.toDate() : (s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.created_at || s.createdAt)),
                    amount: s.task?.reward || 0
                })),
                ...withdrawals.map(w => ({
                    type: 'withdrawal',
                    id: w.id,
                    user: w.user?.email || w.userId || 'Unknown User',
                    userShortId: this.generateShortUserId(w.userId || w.user?.id),
                    status: w.status,
                    date: w.created_at?.toDate ? w.created_at.toDate() : (w.createdAt?.toDate ? w.createdAt.toDate() : new Date(w.created_at || w.createdAt)),
                    amount: w.amount
                }))
            ].sort((a, b) => b.date - a.date).slice(0, 10); // Get last 10 activities

            console.log('📋 Processed activities:', activities.length, activities);

            if (activities.length === 0) {
                console.log('📋 No activities found, showing empty state');
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <h3>No Recent Activity</h3>
                        <p>No recent activity to display at the moment.</p>
                    </div>
                `;
                return;
            }

            console.log('📋 Rendering activities:', activities.length, activities);

            const html = activities.map(activity => {
                // Determine icon and color based on activity type and status
                let iconClass = 'text-blue-500';
                let icon = 'fa-info-circle';

                if (activity.type === 'submission') {
                    // Task submission activities
                    switch (activity.status) {
                        case 'approved':
                            iconClass = 'text-green-500';
                            icon = 'fa-check-circle';
                            break;
                        case 'rejected':
                            iconClass = 'text-red-500';
                            icon = 'fa-times-circle';
                            break;
                        case 'pending_review':
                            iconClass = 'text-yellow-500';
                            icon = 'fa-clock';
                            break;
                        case 'in_progress':
                            iconClass = 'text-blue-500';
                            icon = 'fa-play-circle';
                            break;
                        case 'completed':
                            iconClass = 'text-green-500';
                            icon = 'fa-trophy';
                            break;
                        default:
                            iconClass = 'text-blue-500';
                            icon = 'fa-tasks';
                            break;
                    }
                } else {
                    // Withdrawal activities
                    switch (activity.status) {
                        case 'approved':
                            iconClass = 'text-green-500';
                            icon = 'fa-check-circle';
                            break;
                        case 'rejected':
                            iconClass = 'text-red-500';
                            icon = 'fa-times-circle';
                            break;
                        case 'pending':
                            iconClass = 'text-purple-500';
                            icon = 'fa-money-bill-wave';
                            break;
                        default:
                            iconClass = 'text-purple-500';
                            icon = 'fa-money-bill-wave';
                            break;
                    }
                }

                return `
                    <div class="activity-item-admin">
                        <div class="activity-icon-admin ${iconClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="activity-content-admin">
                            <div class="activity-title-admin">
                                ${activity.type === 'submission' ? 'Task Submission' : 'Withdrawal Request'}
                            </div>
                            <div class="activity-details-admin">
                                <span class="activity-user">${activity.user}</span>
                                <span class="activity-user-id">• ID: ${activity.userShortId}</span>
                                ${activity.type === 'submission' ?
                        `<span class="activity-task">• ${activity.task}</span>` :
                        `<span class="activity-amount">• ₱${activity.amount}</span>`
                    }
                            </div>
                            <div class="activity-meta-admin">
                                <span class="activity-status-admin status-${activity.status}">${activity.status.replace('_', ' ').toUpperCase()}</span>
                                <span class="activity-date-admin">${activity.date.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            console.log('📋 Setting container HTML:', html);
            container.innerHTML = html;

            console.log('📋 Container after setting HTML:', container.innerHTML);
            console.log('📋 Container element:', container);

            console.log('✅ Recent activity loaded and displayed');
        } catch (error) {
            console.error('❌ Error loading recent activity:', error);
        }
    }

    async loadTasks() {
        try {
            this.tasks = await this.getTasksFromFirebase();
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showToast('Failed to load tasks', 'error');
        }
    }

    renderTasks() {
        const container = document.getElementById('admin-tasks-list');
        if (!container) {
            console.log('❌ Admin tasks list container not found');
            return;
        }

        console.log('📋 Rendering tasks:', this.tasks.length, this.tasks);

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <h3>No Tasks Found</h3>
                    <p>No tasks have been created yet. Create your first task to get started!</p>
                    <button class="btn btn-primary" onclick="adminHandler.showAddTaskModal()">
                        <i class="fas fa-plus"></i> Create Task
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => {
            console.log('🎨 ADMIN: Rendering enhanced task card for:', task.title, task.id);
            console.log('🔍 ADMIN: Task deadline data:', {
                deadline: task.deadline,
                deadlineString: task.deadline ? task.deadline.toString() : 'null',
                task_deadline_hours: task.task_deadline_hours,
                created_at: task.created_at,
                deadlineType: typeof task.deadline,
                taskTitle: task.title,
                taskId: task.id
            });

            // Check if task deadline has passed or is about to expire (same logic as user dashboard)
            let actualStatus = task.status;
            let isTaskEnded = false;
            let isTaskWarning = false;
            let hoursUntilDeadline = null;

            // Use the exact same deadline checking logic as user dashboard
            if (task.deadline) {
                const now = new Date();
                let deadlineDate;

                try {
                    // Handle Firestore Timestamp with toDate method
                    if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                        deadlineDate = task.deadline.toDate();
                    }
                    // Handle Firestore Timestamp with seconds/nanoseconds
                    else if (task.deadline.seconds && typeof task.deadline.seconds === 'number') {
                        deadlineDate = new Date(task.deadline.seconds * 1000);
                    }
                    // Handle regular Date object
                    else if (task.deadline instanceof Date) {
                        deadlineDate = task.deadline;
                    }
                    // Handle string or timestamp
                    else if (typeof task.deadline === 'string' || typeof task.deadline === 'number') {
                        deadlineDate = new Date(task.deadline);
                    }
                    else {
                        console.log('⚠️ ADMIN: Invalid deadline format for task:', task.id);
                    }

                    if (deadlineDate && !isNaN(deadlineDate.getTime())) {
                        isTaskEnded = now > deadlineDate;
                        hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                        console.log('🕐 ADMIN: Deadline calculation for task:', task.id, {
                            deadlineDate: deadlineDate.toISOString(),
                            currentTime: now.toISOString(),
                            isTaskEnded: isTaskEnded,
                            hoursUntilDeadline: hoursUntilDeadline.toFixed(2),
                            timeDifference: deadlineDate.getTime() - now.getTime()
                        });

                        // Check if task is within 1 hour of expiring (warning state)
                        if (!isTaskEnded && hoursUntilDeadline <= 1 && hoursUntilDeadline > 0) {
                            isTaskWarning = true;
                        }

                        if (isTaskEnded) {
                            actualStatus = 'ended';
                            console.log('🎯 ADMIN: Task deadline passed for task:', task.id, 'Deadline:', deadlineDate.toISOString());
                        } else if (isTaskWarning) {
                            console.log('⚠️ ADMIN: Task deadline warning for task:', task.id, 'Hours left:', hoursUntilDeadline.toFixed(2));
                        }
                    }
                } catch (error) {
                    console.error('❌ Admin: Error parsing deadline for task:', task.id, error);
                }
            }

            // Fallback: Also check task_deadline_hours + created_at if deadline field is not available
            if (!task.deadline && task.task_deadline_hours && task.created_at) {
                const now = new Date();
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
                        const taskDeadlineTime = new Date(taskCreatedAt.getTime() + (task.task_deadline_hours * 60 * 60 * 1000));
                        isTaskEnded = now > taskDeadlineTime;
                        hoursUntilDeadline = (taskDeadlineTime.getTime() - now.getTime()) / (1000 * 60 * 60);

                        // Check if task is within 1 hour of expiring (warning state)
                        if (!isTaskEnded && hoursUntilDeadline <= 1 && hoursUntilDeadline > 0) {
                            isTaskWarning = true;
                        }

                        if (isTaskEnded) {
                            actualStatus = 'ended';
                            console.log('🎯 ADMIN: Task deadline passed for task (fallback):', task.id, 'Created:', taskCreatedAt.toISOString());
                        } else if (isTaskWarning) {
                            console.log('⚠️ ADMIN: Task deadline warning for task (fallback):', task.id, 'Hours left:', hoursUntilDeadline.toFixed(2));
                        }
                    }
                } catch (error) {
                    console.error('❌ Admin: Error parsing created_at for task (fallback):', task.id, error);
                }
            }

            // Format user time limit
            const formatUserTimeLimit = (userTimeLimit) => {
                if (!userTimeLimit) return 'No Limit';
                const hours = userTimeLimit;
                if (hours < 1) return `${Math.floor(hours * 60)}m`;
                if (hours < 24) return `${hours}h`;
                return `${Math.floor(hours / 24)}d`;
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

            // Calculate deadline display (EXACT same as user dashboard)
            const calculateDeadlineDisplay = (deadline) => {
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
            };

            // Calculate precise time display for admin (same as user dashboard timer)
            const calculatePreciseTimeDisplay = (deadline) => {
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
                    console.error('Error calculating precise time display:', error, deadline);
                    return 'Error';
                }
            };

            const statusClass = actualStatus === 'ended' ? 'status-ended' :
                isTaskWarning ? 'status-warning' :
                    actualStatus === 'inactive' ? 'status-inactive' : 'status-active';
            const statusText = actualStatus === 'ended' ? 'ENDED' :
                isTaskWarning ? 'WARNING' :
                    actualStatus === 'inactive' ? 'INACTIVE' : 'ACTIVE';
            const statusIcon = actualStatus === 'ended' ? 'fas fa-times-circle' :
                isTaskWarning ? 'fas fa-exclamation-triangle' :
                    actualStatus === 'inactive' ? 'fas fa-pause-circle' : 'fas fa-check-circle';

            return `
                <div class="task-card-modern admin-task-card ${isTaskEnded ? 'ended-status' : ''}">
                    <div class="task-card-header">
                        ${task.background_image ? `
                            <img src="${task.background_image}" alt="${task.title || 'Task'}" class="task-banner">
                        ` : `
                                 <div class="task-hexagon-icon">
                                     ${(task.title || 'T').charAt(0).toUpperCase()}
                                 </div>
                        `}
                        <div class="task-status-overlay">
                            <span class="task-status-badge ${statusClass}">
                                <i class="${statusIcon}"></i> ${statusText}
                            </span>
                                </div>
                        ${task.deadline ? `
                            <div class="task-deadline-timer ${isTaskEnded ? 'expired' : isTaskWarning ? 'warning' : ''}" data-deadline="${task.deadline.toDate().toISOString()}">
                                <i class="fas fa-clock"></i>
                                <span class="deadline-text" data-task-id="${task.id}">${calculatePreciseTimeDisplay(task.deadline)}</span>
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
                        <h3 class="task-title">${task.title || 'Untitled Task'}</h3>
                            ${task.description ? `
                                <p class="task-description">${task.description}</p>
                            ` : ''}
                        </div>
                        <div class="task-info-section has-completion">
                            <div class="task-reward">
                                <i class="fas fa-coins"></i>
                                <span class="reward-amount">₱${task.reward || 0}</span>
                            </div>
                            <div class="task-duration">
                                <i class="fas fa-clock"></i>
                                <span class="duration-text" data-task-id="${task.id}" data-task-duration="" data-task-deadline="null">${formatUserTimeLimit(task.user_time_limit_hours)}</span>
                            </div>
                            <div class="task-completion">
                                <i class="fas fa-trophy"></i>
                                <span class="completion-text">${task.completionCount || 0}/${task.maxCompletions || 1}</span>
                            </div>
                        </div>
                        <div class="task-time-info">
                            <div class="task-deadline-info">
                                <i class="fas fa-calendar-alt"></i>
                                <span>Task Deadline: ${calculatePreciseTimeDisplay(task.deadline)}</span>
                            </div>
                            <div class="task-user-limit-info">
                                <i class="fas fa-user-clock"></i>
                                <span>Your Time Limit: ${formatUserTimeLimit(task.user_time_limit_hours)}</span>
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
                                <span class="detail-value">${task.createdAt ? new Date(task.createdAt.toDate()).toLocaleDateString() : 'Unknown'}</span>
                            </div>
                            <div class="task-detail-item">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value ${actualStatus === 'ended' ? 'text-red-600 font-bold' : actualStatus === 'active' ? (isTaskWarning ? 'text-yellow-600 font-bold' : 'text-green-600 font-bold') : 'text-gray-600'}">
                                    ${actualStatus === 'ended' ? '⚠️ ENDED' : actualStatus === 'active' ? (isTaskWarning ? '⚠️ WARNING' : '✅ ACTIVE') : '⏸️ INACTIVE'}
                                </span>
                            </div>
                            ${isTaskEnded ? `
                            <div class="task-detail-item">
                                <span class="detail-label">Deadline Status:</span>
                                <span class="detail-value text-red-600 font-bold">🔴 PASSED</span>
                            </div>
                            ` : isTaskWarning ? `
                            <div class="task-detail-item">
                                <span class="detail-label">Time Remaining:</span>
                                <span class="detail-value text-yellow-600 font-bold">⚠️ ${calculatePreciseTimeDisplay(task.deadline)} LEFT</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="task-action-section">
                            <button class="task-action-btn btn-primary" onclick="window.adminHandler.editTask('${task.id}')">
                                <i class="fas fa-edit"></i>Edit
                        </button>
                            <button class="task-action-btn btn-danger" onclick="window.adminHandler.deleteTask('${task.id}')">
                                <i class="fas fa-trash"></i>Delete
                        </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadTaskSubmissions() {
        try {
            const submissions = await this.getSubmissionsFromFirebase();
            await this.renderTaskSubmissions(submissions);
        } catch (error) {
            console.error('Error loading task submissions:', error);
            this.showToast('Failed to load submissions', 'error');
        }
    }

    async renderTaskSubmissions(submissions) {
        const container = document.getElementById('verifications-list');
        if (!container) {
            console.log('❌ Verifications list container not found');
            return;
        }

        // Store submissions for filtering
        this.verifications = submissions;

        // Apply filters and search
        let filteredSubmissions = this.getFilteredVerifications();

        console.log('📋 Rendering submissions:', filteredSubmissions.length, filteredSubmissions);

        if (filteredSubmissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-check"></i>
                    <h3>No Submissions Found</h3>
                    <p>No task submissions match your search criteria.</p>
                </div>
            `;
            return;
        }

        // Process submissions to get user info and task titles
        const processedSubmissions = await Promise.all(filteredSubmissions.map(async (submission) => {
            const userInfo = await this.getUserInfo(submission.userId || submission.user?.id);

            // Debug: Log the full submission object
            console.log('🔍 Processing submission:', submission.id, 'Full submission:', submission);
            console.log('📧 Referrer email in submission:', submission.referrer_email);

            // Get task title
            let taskTitle = 'Unknown Task';
            if (submission.task?.title) {
                taskTitle = submission.task.title;
                console.log('📋 Task title from submission.task:', taskTitle);
            } else if (submission.taskId || submission.task_id) {
                const taskId = submission.taskId || submission.task_id;
                // Try to find task in our tasks array
                console.log('🔍 Looking for task with ID:', taskId, 'in tasks array:', this.tasks?.length || 0, 'tasks');
                const task = this.tasks?.find(t => t.id === taskId);
                if (task?.title) {
                    taskTitle = task.title;
                    console.log('📋 Task title from tasks array:', taskTitle);
                } else {
                    console.log('❌ Task not found in tasks array. Available task IDs:', this.tasks?.map(t => t.id) || []);
                }
            } else {
                console.log('❌ No task ID found in submission:', submission);
            }

            return {
                ...submission,
                userEmail: userInfo.email,
                userShortId: userInfo.shortId,
                taskTitle
            };
        }));

        container.innerHTML = processedSubmissions.map(submission => `
            <div class="submission-card">
                <div class="submission-header">
                    <div class="submission-info">
                        <h4 class="submission-title">${submission.taskTitle}</h4>
                        <p class="submission-user">${submission.userEmail}</p>
                        <p class="submission-user-id">ID: ${submission.userShortId}</p>
                    </div>
                    <div class="submission-status">
                        <span class="status-badge status-${submission.status}">
                            <i class="${this.getStatusIcon(submission.status)}"></i> ${submission.status.replace('_', ' ').toUpperCase()}
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
                            <span class="detail-label">Reference:</span>
                            <span class="detail-value">${submission.referenceNumber || 'N/A'}</span>
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

    async loadWithdrawals() {
        try {
            const withdrawals = await this.getWithdrawalsFromFirebase();
            await this.renderWithdrawals(withdrawals);
        } catch (error) {
            console.error('Error loading withdrawals:', error);
            this.showToast('Failed to load withdrawals', 'error');
        }
    }

    async renderWithdrawals(withdrawals) {
        const container = document.getElementById('withdrawals-list');
        if (!container) {
            console.log('❌ Withdrawals list container not found');
            return;
        }

        // Store withdrawals for filtering
        this.withdrawals = withdrawals;

        // Apply filters and search
        let filteredWithdrawals = this.getFilteredWithdrawals();

        console.log('📋 Rendering withdrawals:', filteredWithdrawals.length, filteredWithdrawals);

        if (filteredWithdrawals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-money-bill-wave"></i>
                    <h3>No Withdrawals Found</h3>
                    <p>No withdrawal requests match your search criteria.</p>
                </div>
            `;
            return;
        }

        // Process withdrawals to get user info
        const processedWithdrawals = await Promise.all(filteredWithdrawals.map(async (withdrawal) => {
            const userInfo = await this.getUserInfo(withdrawal.userId || withdrawal.user?.id);

            // Format date properly
            let requestDate = 'Invalid Date';
            if (withdrawal.created_at?.toDate) {
                requestDate = withdrawal.created_at.toDate().toLocaleString();
            } else if (withdrawal.createdAt?.toDate) {
                requestDate = withdrawal.createdAt.toDate().toLocaleString();
            } else if (withdrawal.created_at) {
                requestDate = new Date(withdrawal.created_at).toLocaleString();
            } else if (withdrawal.createdAt) {
                requestDate = new Date(withdrawal.createdAt).toLocaleString();
            }

            return {
                ...withdrawal,
                userEmail: userInfo.email,
                userShortId: userInfo.shortId,
                requestDate
            };
        }));

        container.innerHTML = processedWithdrawals.map(withdrawal => `
            <div class="withdrawal-card">
                <div class="withdrawal-header">
                    <div class="withdrawal-info">
                        <h4 class="withdrawal-user">${withdrawal.userEmail}</h4>
                        <p class="withdrawal-user-id">ID: ${withdrawal.userShortId}</p>
                        <p class="withdrawal-amount">₱${withdrawal.amount}</p>
                    </div>
                    <div class="withdrawal-status">
                        <span class="status-badge status-${withdrawal.status}">
                            <i class="${this.getStatusIcon(withdrawal.status)}"></i> ${withdrawal.status.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div class="withdrawal-content">
                    <div class="withdrawal-details">
                        <div class="detail-row">
                            <span class="detail-label">Method:</span>
                            <span class="detail-value">${withdrawal.method || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Account Name:</span>
                            <span class="detail-value">${withdrawal.account_name || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone Number:</span>
                            <span class="detail-value">${withdrawal.account || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Reference:</span>
                            <span class="detail-value">${withdrawal.referenceNumber || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested:</span>
                            <span class="detail-value">${withdrawal.requestDate}</span>
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

    async loadUsers() {
        try {
            this.users = await this.getUsersFromFirebase();
            await this.renderUsers();
        } catch (error) {
            console.error('Error loading users:', error);
            this.showToast('Failed to load users', 'error');
        }
    }

    async renderUsers() {
        const container = document.getElementById('users-list');
        if (!container) {
            console.log('❌ Users list container not found');
            return;
        }

        console.log('📋 Rendering users:', this.users.length, this.users);

        // Apply filters and search
        let filteredUsers = this.getFilteredUsers();

        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Users Found</h3>
                    <p>No users match your search criteria.</p>
                </div>
            `;
            return;
        }

        // Get additional user data for each user
        const usersWithData = await Promise.all(filteredUsers.map(async (user) => {
            const userId = user.uid || user.id;

            // Get user's task submissions
            const submissions = await this.getUserSubmissions(userId);
            const completedTasks = submissions.filter(s => s.status === 'completed' || s.status === 'approved').length;
            const inProgressTasks = submissions.filter(s => s.status === 'in_progress' || s.status === 'pending_review').length;

            // Get user's withdrawal history
            const withdrawals = await this.getUserWithdrawals(userId);
            const totalWithdrawn = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + (w.amount || 0), 0);

            // Get user's current active tasks
            const activeTasks = await this.getUserActiveTasks(userId);

            return {
                ...user,
                completedTasks,
                inProgressTasks,
                totalWithdrawn,
                activeTasks,
                submissions,
                withdrawals
            };
        }));

        container.innerHTML = usersWithData.map(user => {
            const userShortId = this.generateShortUserId(user.id || user.uid);
            const statusClass = user.status === 'disabled' ? 'status-disabled' : 'status-active';
            const statusText = user.status === 'disabled' ? 'Disabled' : 'Active';

            return `
                <div class="user-card ${user.status === 'disabled' ? 'disabled-user' : ''}">
                    <div class="user-info">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <h4 class="user-name">${user.email}</h4>
                            <p class="user-id">ID: ${userShortId}</p>
                            <div class="user-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Balance:</span>
                                    <span class="stat-value">₱${user.walletBalance || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Completed:</span>
                                    <span class="stat-value">${user.completedTasks}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">In Progress:</span>
                                    <span class="stat-value">${user.inProgressTasks}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Withdrawn:</span>
                                    <span class="stat-value">₱${user.totalWithdrawn}</span>
                                </div>
                            </div>
                            <div class="user-status">
                                <span class="status-badge ${statusClass}">
                                    <i class="fas fa-${user.status === 'disabled' ? 'ban' : 'check-circle'}"></i>
                                    ${statusText}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="admin-action-btn primary" onclick="window.adminHandler.manageUserBalance('${user.uid || user.id}')">
                            <i class="fas fa-wallet"></i> Balance
                        </button>
                        <button class="admin-action-btn ${user.status === 'disabled' ? 'success' : 'warning'}" 
                                onclick="window.adminHandler.toggleUserStatus('${user.uid || user.id}', '${user.status}')">
                            <i class="fas fa-${user.status === 'disabled' ? 'check' : 'ban'}"></i>
                            ${user.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
                        <button class="admin-action-btn info" onclick="window.adminHandler.viewUserActivity('${user.uid || user.id}')">
                            <i class="fas fa-chart-line"></i> Activity
                        </button>
                        <button class="admin-action-btn secondary" onclick="window.adminHandler.viewUserTasks('${user.uid || user.id}')">
                            <i class="fas fa-tasks"></i> Tasks
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Task Management Methods
    showAddTaskModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Add New Task</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="add-task-form">
                        <div class="form-group">
                            <label class="form-label">Task Title</label>
                            <input type="text" id="task-title" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="task-description" class="form-textarea" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Instructions</label>
                            <textarea id="task-instructions" class="form-textarea" rows="4"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Reward (₱)</label>
                            <input type="number" id="task-reward" class="form-input" min="0" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Task Deadline</label>
                            <input type="datetime-local" id="task-deadline" class="form-input" required>
                            <small class="form-help">When this task will no longer be available</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">User Time Limit (hours)</label>
                            <input type="number" id="user-time-limit" class="form-input" min="1" max="168" value="24" required>
                            <small class="form-help">Time limit for user to complete task (1-168 hours)</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Require Referrer Email</label>
                            <input type="checkbox" id="task-requires-referrer" class="form-checkbox">
                            <div id="referrer-warning-section" style="display: none; margin-top: 0.5rem;">
                                <label class="form-label">Referrer Warning Message</label>
                                <textarea id="referrer-warning-message" class="form-textarea" rows="2" placeholder="Please contact your referrer for email provided...">Please contact your referrer for email provided</textarea>
                                <small class="form-help">This message will be shown to users when referrer email is required</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Restarts</label>
                            <input type="number" id="task-max-restarts" class="form-input" min="0" value="3">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Background Image URL</label>
                            <input type="url" id="task-background-image" class="form-input" 
                                   placeholder="https://example.com/task-background.jpg">
                            <small class="form-help">Optional: Background image for the task card header</small>
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
                            <label class="form-label">Task Status</label>
                            <select id="task-status" class="form-select">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                            <button type="button" class="btn-info" onclick="window.adminHandler.previewTask()">Preview</button>
                            <button type="submit" class="btn-primary">Create Task</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Toggle referrer warning section
        document.getElementById('task-requires-referrer').addEventListener('change', (e) => {
            const warningSection = document.getElementById('referrer-warning-section');
            warningSection.style.display = e.target.checked ? 'block' : 'none';
        });

        // Set default deadline to 24 hours from now
        const now = new Date();
        now.setHours(now.getHours() + 24);
        const defaultDeadline = now.toISOString().slice(0, 16);
        document.getElementById('task-deadline').value = defaultDeadline;

        // Handle form submission
        document.getElementById('add-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createTask();
        });
    }

    async createTask() {
        try {
            const taskDeadline = new Date(document.getElementById('task-deadline').value);
            const userTimeLimit = parseInt(document.getElementById('user-time-limit').value);
            const requiresReferrer = document.getElementById('task-requires-referrer').checked;
            const referrerWarningMessage = document.getElementById('referrer-warning-message').value.trim();

            // Calculate hours until deadline
            const now = new Date();
            const hoursUntilDeadline = Math.max(1, Math.ceil((taskDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

            // Ensure user time limit doesn't exceed task deadline
            const finalUserTimeLimit = Math.min(userTimeLimit, hoursUntilDeadline);

            const taskData = {
                title: document.getElementById('task-title').value.trim(),
                description: document.getElementById('task-description').value.trim(),
                instructions: document.getElementById('task-instructions').value.trim(),
                reward: parseFloat(document.getElementById('task-reward').value),
                background_image: document.getElementById('task-background-image').value.trim() || null,
                requires_referrer_email: requiresReferrer,
                referrer_warning_message: requiresReferrer ? referrerWarningMessage : null,
                max_restarts: parseInt(document.getElementById('task-max-restarts').value) || 3,
                difficulty: document.getElementById('task-difficulty').value,
                task_deadline: taskDeadline,
                task_deadline_hours: hoursUntilDeadline,
                user_time_limit_hours: finalUserTimeLimit,
                status: document.getElementById('task-status').value
            };

            await window.firestoreManager.createTask(taskData);
            this.showToast('Task created successfully!', 'success');
            document.querySelector('.modal').remove();

            // Switch to tasks tab and refresh
            this.switchAdminTab('tasks-admin');
            await this.loadTasks();
        } catch (error) {
            console.error('Error creating task:', error);
            this.showToast('Failed to create task', 'error');
        }
    }

    previewTask() {
        try {
            const taskData = {
                title: document.getElementById('task-title').value.trim() || 'Sample Task Title',
                description: document.getElementById('task-description').value.trim() || 'Sample task description...',
                instructions: document.getElementById('task-instructions').value.trim() || 'Sample task instructions...',
                reward: parseFloat(document.getElementById('task-reward').value) || 0,
                background_image: document.getElementById('task-background-image').value.trim() || null,
                requires_referrer_email: document.getElementById('task-requires-referrer').checked,
                referrer_warning_message: document.getElementById('referrer-warning-message').value.trim() || 'Please contact your referrer for email provided',
                max_restarts: parseInt(document.getElementById('task-max-restarts').value) || 3,
                task_deadline: new Date(document.getElementById('task-deadline').value),
                user_time_limit_hours: parseInt(document.getElementById('user-time-limit').value) || 24,
                status: document.getElementById('task-status').value
            };

            // Calculate hours until deadline
            const now = new Date();
            const hoursUntilDeadline = Math.max(1, Math.ceil((taskData.task_deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Task Preview</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="preview-container">
                            <h4>How this task will appear to users:</h4>
                            <div class="task-preview-card">
                                <div class="task-card-header" style="${taskData.background_image ? `background-image: url('${taskData.background_image}'); background-size: cover; background-position: center;` : ''}">
                                    <div class="task-hexagon-icon">
                                        ${taskData.background_image ?
                    `<img src="${taskData.background_image}" alt="Task" class="task-preview-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                             <div class="task-preview-fallback" style="display: none;">${taskData.title.charAt(0).toUpperCase()}</div>` :
                    taskData.title.charAt(0).toUpperCase()
                }
                                    </div>
                                    <div class="task-status-overlay">
                                        <span class="task-status-badge status-available">
                                            <i class="fas fa-play"></i> Available
                                        </span>
                                    </div>
                                    <div class="task-deadline-timer">
                                        <i class="fas fa-clock"></i>
                                        <span class="deadline-text">${hoursUntilDeadline}h remaining</span>
                                    </div>
                                </div>
                                <div class="task-card-content">
                                    <div class="task-title-section">
                                        <h3 class="task-title">${taskData.title}</h3>
                                        <p class="task-description">${taskData.description}</p>
                                    </div>
                                    <div class="task-info-section">
                                        <div class="task-reward">
                                            <i class="fas fa-coins"></i>
                                            <span class="reward-amount">₱${taskData.reward}</span>
                                        </div>
                                        <div class="task-duration">
                                            <i class="fas fa-clock"></i>
                                            <span class="duration-text">${taskData.user_time_limit_hours}h</span>
                                        </div>
                                        <div class="task-completion">
                                            <i class="fas fa-trophy"></i>
                                            <span class="completion-text">0/${taskData.max_restarts + 1}</span>
                                        </div>
                                    </div>
                                    <div class="task-time-info">
                                        <div class="task-deadline-info">
                                            <i class="fas fa-calendar-alt"></i>
                                            <span>Task Deadline: ${hoursUntilDeadline}h</span>
                                        </div>
                                        <div class="task-user-limit-info">
                                            <i class="fas fa-user-clock"></i>
                                            <span>Your Time Limit: ${taskData.user_time_limit_hours}h</span>
                                        </div>
                                    </div>
                                    <div class="task-details-section">
                                        <div class="task-detail-item">
                                            <span class="detail-label">Max Restarts:</span>
                                            <span class="detail-value">${taskData.max_restarts}</span>
                                        </div>
                                        ${taskData.requires_referrer_email ? `
                                            <div class="task-detail-item">
                                                <span class="detail-label">Referrer Required:</span>
                                                <span class="detail-value">Yes</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="task-actions">
                                        <button class="btn-primary" disabled>
                                            <i class="fas fa-play"></i>
                                            Start Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            ${taskData.requires_referrer_email ? `
                                <div class="referrer-warning-box" style="margin-top: 1rem;">
                                    <div class="referrer-warning-header">
                                        <div class="referrer-warning-icon">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div class="referrer-warning-title">
                                            <h4>Referrer Email Required</h4>
                                            <p>${taskData.referrer_warning_message}</p>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="task-instructions-preview" style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                                <h5 style="color: #1f2937; margin: 0 0 0.5rem 0;">
                                    <i class="fas fa-list"></i>
                                    Task Instructions
                                </h5>
                                <p style="color: #6b7280; margin: 0; white-space: pre-line;">${taskData.instructions}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close Preview</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error creating preview:', error);
            this.showToast('Failed to create preview', 'error');
        }
    }

    async editTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal edit-task-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Edit Task</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-task-form">
                            <div class="form-group">
                                <label class="form-label">Task Title</label>
                                <input type="text" id="edit-task-title" class="form-input" value="${task.title}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea id="edit-task-description" class="form-textarea" rows="3">${task.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Instructions</label>
                                <textarea id="edit-task-instructions" class="form-textarea" rows="4">${task.instructions || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Reward (₱)</label>
                                <input type="number" id="edit-task-reward" class="form-input" min="0" step="0.01" value="${task.reward || 0}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Task Deadline</label>
                                <input type="datetime-local" id="edit-task-deadline" class="form-input" value="${task.task_deadline ? new Date(task.task_deadline.toDate ? task.task_deadline.toDate() : task.task_deadline).toISOString().slice(0, 16) : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}" required>
                                <small class="form-help">When this task will no longer be available</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">User Time Limit (hours)</label>
                                <input type="number" id="edit-user-time-limit" class="form-input" min="1" max="168" value="${task.user_time_limit_hours || 24}" required>
                                <small class="form-help">Time limit for user to complete task (1-168 hours)</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Require Referrer Email</label>
                                <input type="checkbox" id="edit-task-requires-referrer" class="form-checkbox" ${task.requires_referrer_email ? 'checked' : ''}>
                                <div id="edit-referrer-warning-section" style="display: ${task.requires_referrer_email ? 'block' : 'none'}; margin-top: 0.5rem;">
                                    <label class="form-label">Referrer Warning Message</label>
                                    <textarea id="edit-referrer-warning-message" class="form-textarea" rows="2" placeholder="Please contact your referrer for email provided...">${task.referrer_warning_message || 'Please contact your referrer for email provided'}</textarea>
                                    <small class="form-help">This message will be shown to users when referrer email is required</small>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Max Restarts</label>
                                <input type="number" id="edit-task-max-restarts" class="form-input" min="0" value="${task.max_restarts || 3}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Background Image URL</label>
                                <input type="url" id="edit-task-background-image" class="form-input" 
                                       value="${task.background_image || ''}" 
                                       placeholder="https://example.com/task-background.jpg">
                                <small class="form-help">Optional: Background image for the task card header</small>
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
                                <label class="form-label">Task Status</label>
                                <select id="edit-task-status" class="form-select">
                                    <option value="active" ${task.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="inactive" ${task.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                                <button type="button" class="btn-info" onclick="window.adminHandler.previewEditTask()">Preview</button>
                                <button type="submit" class="btn-primary">Update Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Toggle referrer warning section
            document.getElementById('edit-task-requires-referrer').addEventListener('change', (e) => {
                const warningSection = document.getElementById('edit-referrer-warning-section');
                warningSection.style.display = e.target.checked ? 'block' : 'none';
            });

            // Handle form submission
            document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateTask(taskId);
            });
        } catch (error) {
            console.error('Error showing edit modal:', error);
            this.showToast('Failed to load edit form', 'error');
        }
    }

    async updateTask(taskId) {
        try {
            console.log('🔧 Admin: Starting task update for ID:', taskId);

            const taskDeadline = new Date(document.getElementById('edit-task-deadline').value);
            const userTimeLimit = parseInt(document.getElementById('edit-user-time-limit').value);
            const requiresReferrer = document.getElementById('edit-task-requires-referrer').checked;
            const referrerWarningMessage = document.getElementById('edit-referrer-warning-message').value.trim();
            const status = document.getElementById('edit-task-status').value;

            console.log('🔧 Admin: Form values:', {
                taskDeadline,
                userTimeLimit,
                requiresReferrer,
                referrerWarningMessage,
                status
            });

            // Calculate hours until deadline
            const now = new Date();
            const hoursUntilDeadline = Math.max(1, Math.ceil((taskDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

            // Ensure user time limit doesn't exceed task deadline
            const finalUserTimeLimit = Math.min(userTimeLimit, hoursUntilDeadline);

            const taskData = {
                title: document.getElementById('edit-task-title').value.trim(),
                description: document.getElementById('edit-task-description').value.trim(),
                instructions: document.getElementById('edit-task-instructions').value.trim(),
                reward: parseFloat(document.getElementById('edit-task-reward').value),
                background_image: document.getElementById('edit-task-background-image').value.trim() || null,
                requires_referrer_email: requiresReferrer,
                referrer_warning_message: requiresReferrer ? referrerWarningMessage : null,
                max_restarts: parseInt(document.getElementById('edit-task-max-restarts').value) || 3,
                difficulty: document.getElementById('edit-task-difficulty').value,
                task_deadline: taskDeadline,
                task_deadline_hours: hoursUntilDeadline,
                user_time_limit_hours: finalUserTimeLimit,
                status: status,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };

            console.log('🔧 Admin: Task data to be saved:', taskData);

            console.log('🔧 Admin: Updating task in database...');
            await db.collection('tasks').doc(taskId).update(taskData);
            console.log('🔧 Admin: Task updated successfully in database');

            this.showToast('Task updated successfully!', 'success');

            // Close the edit modal specifically
            const editModal = document.querySelector('.edit-task-modal');
            if (editModal) {
                editModal.remove();
            }

            console.log('🔧 Admin: Reloading admin tasks...');
            await this.loadTasks();
            console.log('🔧 Admin: Admin tasks reloaded');
        } catch (error) {
            console.error('Error updating task:', error);
            this.showToast('Failed to update task', 'error');
        }
    }

    previewEditTask() {
        try {
            const taskData = {
                title: document.getElementById('edit-task-title').value.trim() || 'Sample Task Title',
                description: document.getElementById('edit-task-description').value.trim() || 'Sample task description...',
                instructions: document.getElementById('edit-task-instructions').value.trim() || 'Sample task instructions...',
                reward: parseFloat(document.getElementById('edit-task-reward').value) || 0,
                background_image: document.getElementById('edit-task-background-image').value.trim() || null,
                requires_referrer_email: document.getElementById('edit-task-requires-referrer').checked,
                referrer_warning_message: document.getElementById('edit-referrer-warning-message').value.trim() || 'Please contact your referrer for email provided',
                max_restarts: parseInt(document.getElementById('edit-task-max-restarts').value) || 3,
                task_deadline: new Date(document.getElementById('edit-task-deadline').value),
                user_time_limit_hours: parseInt(document.getElementById('edit-user-time-limit').value) || 24,
                status: document.getElementById('edit-task-status').value
            };

            // Calculate hours until deadline
            const now = new Date();
            const hoursUntilDeadline = Math.max(1, Math.ceil((taskData.task_deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Task Preview</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="preview-container">
                            <h4>How this task will appear to users:</h4>
                            <div class="task-preview-card">
                                <div class="task-card-header" style="${taskData.background_image ? `background-image: url('${taskData.background_image}'); background-size: cover; background-position: center;` : ''}">
                                    <div class="task-hexagon-icon">
                                        ${taskData.background_image ?
                    `<img src="${taskData.background_image}" alt="Task" class="task-preview-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                             <div class="task-preview-fallback" style="display: none;">${taskData.title.charAt(0).toUpperCase()}</div>` :
                    taskData.title.charAt(0).toUpperCase()
                }
                                    </div>
                                    <div class="task-status-overlay">
                                        <span class="task-status-badge status-available">
                                            <i class="fas fa-play"></i> Available
                                        </span>
                                    </div>
                                    <div class="task-deadline-timer">
                                        <i class="fas fa-clock"></i>
                                        <span class="deadline-text">${hoursUntilDeadline}h remaining</span>
                                    </div>
                                </div>
                                <div class="task-card-content">
                                    <div class="task-title-section">
                                        <h3 class="task-title">${taskData.title}</h3>
                                        <p class="task-description">${taskData.description}</p>
                                    </div>
                                    <div class="task-info-section">
                                        <div class="task-reward">
                                            <i class="fas fa-coins"></i>
                                            <span class="reward-amount">₱${taskData.reward}</span>
                                        </div>
                                        <div class="task-duration">
                                            <i class="fas fa-clock"></i>
                                            <span class="duration-text">${taskData.user_time_limit_hours}h</span>
                                        </div>
                                        <div class="task-completion">
                                            <i class="fas fa-trophy"></i>
                                            <span class="completion-text">0/${taskData.max_restarts + 1}</span>
                                        </div>
                                    </div>
                                    <div class="task-time-info">
                                        <div class="task-deadline-info">
                                            <i class="fas fa-calendar-alt"></i>
                                            <span>Task Deadline: ${hoursUntilDeadline}h</span>
                                        </div>
                                        <div class="task-user-limit-info">
                                            <i class="fas fa-user-clock"></i>
                                            <span>Your Time Limit: ${taskData.user_time_limit_hours}h</span>
                                        </div>
                                    </div>
                                    <div class="task-details-section">
                                        <div class="task-detail-item">
                                            <span class="detail-label">Max Restarts:</span>
                                            <span class="detail-value">${taskData.max_restarts}</span>
                                        </div>
                                        ${taskData.requires_referrer_email ? `
                                            <div class="task-detail-item">
                                                <span class="detail-label">Referrer Required:</span>
                                                <span class="detail-value">Yes</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="task-actions">
                                        <button class="btn-primary" disabled>
                                            <i class="fas fa-play"></i>
                                            Start Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            ${taskData.requires_referrer_email ? `
                                <div class="referrer-warning-box" style="margin-top: 1rem;">
                                    <div class="referrer-warning-header">
                                        <div class="referrer-warning-icon">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div class="referrer-warning-title">
                                            <h4>Referrer Email Required</h4>
                                            <p>${taskData.referrer_warning_message}</p>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="task-instructions-preview" style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                                <h5 style="color: #1f2937; margin: 0 0 0.5rem 0;">
                                    <i class="fas fa-list"></i>
                                    Task Instructions
                                </h5>
                                <p style="color: #6b7280; margin: 0; white-space: pre-line;">${taskData.instructions}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close Preview</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error creating preview:', error);
            this.showToast('Failed to create preview', 'error');
        }
    }

    async deleteTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) {
                this.showToast('Task not found', 'error');
                return;
            }

            const confirmed = confirm(`Are you sure you want to delete the task "${task.title}"? This action cannot be undone.`);
            if (!confirmed) return;

            // Check if there are any active submissions for this task
            const submissions = await db.collection('task_submissions')
                .where('task_id', '==', taskId)
                .where('status', 'in', ['in_progress', 'pending_review'])
                .get();

            if (!submissions.empty) {
                this.showToast('Cannot delete task with active submissions. Please wait for all submissions to be completed or rejected.', 'error');
                return;
            }

            await db.collection('tasks').doc(taskId).delete();
            this.showToast('Task deleted successfully!', 'success');
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showToast('Failed to delete task', 'error');
        }
    }

    // Submission Management Methods
    async approveTaskSubmission(submissionId) {
        try {
            // Generate reference number for verification
            const reference = await this.generateAndStoreReference('verification', submissionId);

            await window.firestoreManager.updateTaskSubmissionStatus(submissionId, 'approved');
            this.showToast(`Submission approved successfully! Reference: ${reference}`, 'success');
            await this.loadTaskSubmissions();
            await this.loadStats();
        } catch (error) {
            console.error('Error approving submission:', error);
            this.showToast('Failed to approve submission', 'error');
        }
    }

    async rejectTaskSubmission(submissionId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (reason) {
            try {
                await window.firestoreManager.updateTaskSubmissionStatus(submissionId, 'rejected', reason);
                this.showToast('Submission rejected successfully!', 'success');
                await this.loadTaskSubmissions();
            } catch (error) {
                console.error('Error rejecting submission:', error);
                this.showToast('Failed to reject submission', 'error');
            }
        }
    }

    // Withdrawal Management Methods
    async approveWithdrawal(withdrawalId) {
        try {
            // Generate reference number for withdrawal
            const reference = await this.generateAndStoreReference('withdrawal', withdrawalId);

            await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'approved');
            this.showToast(`Withdrawal approved successfully! Reference: ${reference}`, 'success');
            await this.loadWithdrawals();
            await this.loadStats();
        } catch (error) {
            console.error('Error approving withdrawal:', error);
            this.showToast('Failed to approve withdrawal', 'error');
        }
    }

    async rejectWithdrawal(withdrawalId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (reason) {
            try {
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

                console.log('🚫 Rejecting withdrawal:', {
                    withdrawalId: withdrawalId,
                    userId: userId,
                    amount: amount,
                    reason: reason
                });

                // Update withdrawal status (this will handle refund logic automatically)
                await window.firestoreManager.updateWithdrawalStatus(withdrawalId, 'rejected', reason);

                console.log('✅ Withdrawal rejection completed');

                this.showToast(`Withdrawal rejected and balance restored!`, 'success');
                await this.loadWithdrawals();
                await this.loadStats(); // Update stats
            } catch (error) {
                console.error('Error rejecting withdrawal:', error);
                this.showToast('Failed to reject withdrawal', 'error');
            }
        }
    }

    // User Management Methods
    async manageUserBalance(userId) {
        try {
            const user = this.users.find(u => (u.uid || u.id) === userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            // Create user balance management modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Manage User Balance - ${user.email}</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="user-balance-form">
                            <div class="form-group">
                                <label class="form-label">Current Balance</label>
                                <div class="current-balance-display">
                                    <span class="balance-amount">₱${user.walletBalance || 0}</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">New Balance</label>
                                <input type="number" id="new-balance" class="form-input" 
                                       value="${user.walletBalance || 0}" 
                                       step="0.01" min="0" required>
                                <small class="form-help">Enter the new balance amount</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Reason for Change</label>
                                <textarea id="balance-reason" class="form-textarea" rows="3" 
                                          placeholder="Enter reason for balance adjustment..."></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Update Balance
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Handle form submission
            document.getElementById('user-balance-form').addEventListener('submit', async (e) => {
                e.preventDefault();

                const newBalance = parseFloat(document.getElementById('new-balance').value);
                const reason = document.getElementById('balance-reason').value.trim();

                if (isNaN(newBalance) || newBalance < 0) {
                    this.showToast('Please enter a valid balance amount', 'error');
                    return;
                }

                try {
                    // Get current user data to calculate change amount
                    const userDoc = await db.collection('users').doc(userId).get();
                    const currentBalance = userDoc.exists ? userDoc.data().walletBalance || 0 : 0;
                    const changeAmount = newBalance - currentBalance;

                    console.log('🔧 Admin balance adjustment (simple):', {
                        userId: userId,
                        currentBalance: currentBalance,
                        newBalance: newBalance,
                        changeAmount: changeAmount,
                        reason: reason
                    });

                    // Use the proper updateWalletBalance function to record transaction
                    await window.firestoreManager.updateWalletBalance(
                        userId,
                        changeAmount,
                        'admin_balance_adjustment',
                        {
                            action: changeAmount > 0 ? 'add' : changeAmount < 0 ? 'subtract' : 'set',
                            amount: Math.abs(changeAmount),
                            oldBalance: currentBalance,
                            newBalance: newBalance,
                            reason: reason || 'Admin adjustment',
                            adminId: this.currentUser?.uid || 'unknown',
                            adminEmail: this.currentUser?.email || 'unknown'
                        }
                    );

                    // Create notification for user
                    const action = changeAmount > 0 ? 'add' : changeAmount < 0 ? 'subtract' : 'set';
                    await window.firestoreManager.createAdminNotification(userId, {
                        type: 'balance_change',
                        title: '💰 Balance Updated',
                        message: `Your wallet balance has been ${action === 'add' ? 'increased' : action === 'subtract' ? 'decreased' : 'set'} by ₱${Math.abs(changeAmount)}. New balance: ₱${newBalance}`,
                        data: {
                            action: action,
                            amount: Math.abs(changeAmount),
                            oldBalance: currentBalance,
                            newBalance: newBalance,
                            reason: reason || 'Admin adjustment'
                        }
                    });

                    // Update local user data
                    const userIndex = this.users.findIndex(u => (u.uid || u.id) === userId);
                    if (userIndex !== -1) {
                        this.users[userIndex].walletBalance = newBalance;
                    }

                    // Refresh users display
                    await this.renderUsers();

                    this.showToast(`Balance updated to ₱${newBalance}`, 'success');
                    modal.remove();
                } catch (error) {
                    console.error('Error updating user balance:', error);
                    this.showToast('Failed to update balance', 'error');
                }
            });
        } catch (error) {
            console.error('Error managing user balance:', error);
            this.showToast('Failed to load balance management', 'error');
        }
    }

    // Utility Methods
    getStatusIcon(status) {
        const icons = {
            'pending': 'fas fa-clock',
            'pending_review': 'fas fa-hourglass-half',
            'approved': 'fas fa-check-circle',
            'rejected': 'fas fa-times-circle',
            'completed': 'fas fa-trophy',
            'in_progress': 'fas fa-play-circle'
        };
        return icons[status] || 'fas fa-question-circle';
    }

    showProofModal(imageUrl) {
        const modal = document.createElement('div');
        modal.className = 'modal proof-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-content proof-modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Proof Image</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <img src="${imageUrl}" alt="Proof" class="proof-modal-image">
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.remove());
    }

    async signOut() {
        try {
            await window.authManager.signOut();
            window.location.href = '/login/';
        } catch (error) {
            console.error('Error signing out:', error);
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


    async getUserEmail(userId) {
        try {
            if (!userId) return 'Unknown User';

            // Check if we already have this user in our users array
            const existingUser = this.users?.find(user => user.id === userId);
            if (existingUser?.email) {
                return existingUser.email;
            }

            // Fetch user from Firebase
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return userData.email || 'Unknown User';
            }

            return 'Unknown User';
        } catch (error) {
            console.error('Error fetching user email:', error);
            return 'Unknown User';
        }
    }

    generateShortUserId(userId) {
        if (!userId) return 'Q00000';

        // Generate a short ID based on the Firebase user ID
        // Take first 5 characters and convert to a more readable format
        const shortId = 'Q' + userId.substring(0, 5).toUpperCase();
        return shortId;
    }

    async getUserInfo(userId) {
        try {
            if (!userId) return { email: 'Unknown User', shortId: 'Q00000' };

            // Check if we already have this user in our users array
            const existingUser = this.users?.find(user => user.id === userId);
            if (existingUser?.email) {
                return {
                    email: existingUser.email,
                    shortId: this.generateShortUserId(userId)
                };
            }

            // Fetch user from Firebase
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return {
                    email: userData.email || 'Unknown User',
                    shortId: this.generateShortUserId(userId)
                };
            }

            return {
                email: 'Unknown User',
                shortId: this.generateShortUserId(userId)
            };
        } catch (error) {
            console.error('Error fetching user info:', error);
            return {
                email: 'Unknown User',
                shortId: this.generateShortUserId(userId)
            };
        }
    }

    // User Data Helper Methods
    async getUserSubmissions(userId) {
        try {
            const submissions = await db.collection('task_submissions')
                .where('user_id', '==', userId)
                .get();
            return submissions.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting user submissions:', error);
            return [];
        }
    }

    async getUserWithdrawals(userId) {
        try {
            const withdrawals = await db.collection('withdrawals')
                .where('user_id', '==', userId)
                .get();
            return withdrawals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting user withdrawals:', error);
            return [];
        }
    }

    async getUserActiveTasks(userId) {
        try {
            const submissions = await this.getUserSubmissions(userId);
            const activeSubmissions = submissions.filter(s =>
                s.status === 'in_progress' || s.status === 'pending_review'
            );

            // Get task details for active submissions
            const activeTasks = await Promise.all(activeSubmissions.map(async (submission) => {
                const taskDoc = await db.collection('tasks').doc(submission.task_id).get();
                return {
                    ...submission,
                    task: taskDoc.exists ? taskDoc.data() : null
                };
            }));

            return activeTasks;
        } catch (error) {
            console.error('Error getting user active tasks:', error);
            return [];
        }
    }

    // User Management Methods
    async toggleUserStatus(userId, currentStatus) {
        try {
            const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
            await db.collection('users').doc(userId).update({
                status: newStatus,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast(`User ${newStatus === 'disabled' ? 'disabled' : 'enabled'} successfully`, 'success');
            await this.loadUsers(); // Refresh users list
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showToast('Failed to update user status', 'error');
        }
    }

    async viewUserActivity(userId) {
        try {
            const user = this.users.find(u => (u.uid || u.id) === userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            const submissions = await this.getUserSubmissions(userId);
            const withdrawals = await this.getUserWithdrawals(userId);

            // Create activity modal
            this.showUserActivityModal(user, submissions, withdrawals);
        } catch (error) {
            console.error('Error viewing user activity:', error);
            this.showToast('Failed to load user activity', 'error');
        }
    }

    async viewUserTasks(userId) {
        try {
            const user = this.users.find(u => (u.uid || u.id) === userId);
            if (!user) {
                this.showToast('User not found', 'error');
                return;
            }

            const activeTasks = await this.getUserActiveTasks(userId);
            const allSubmissions = await this.getUserSubmissions(userId);

            // Create tasks modal
            this.showUserTasksModal(user, activeTasks, allSubmissions);
        } catch (error) {
            console.error('Error viewing user tasks:', error);
            this.showToast('Failed to load user tasks', 'error');
        }
    }

    showUserActivityModal(user, submissions, withdrawals) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>User Activity - ${user.email}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="activity-summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Submissions:</span>
                            <span class="summary-value">${submissions.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Completed Tasks:</span>
                            <span class="summary-value">${submissions.filter(s => s.status === 'completed' || s.status === 'approved').length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Withdrawals:</span>
                            <span class="summary-value">${withdrawals.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Withdrawn:</span>
                            <span class="summary-value">₱${withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + (w.amount || 0), 0)}</span>
                        </div>
                    </div>
                    <div class="activity-timeline">
                        <h3>Recent Activity</h3>
                        <div class="timeline">
                            ${[...submissions, ...withdrawals]
                .sort((a, b) => {
                    const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || a.createdAt);
                    const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || b.createdAt);
                    return dateB - dateA;
                })
                .slice(0, 20)
                .map(item => {
                    const date = item.created_at?.toDate ? item.created_at.toDate() : new Date(item.created_at || item.createdAt);
                    if (item.task_id) {
                        // Task submission
                        return `
                                            <div class="timeline-item">
                                                <div class="timeline-icon task-icon">
                                                    <i class="fas fa-tasks"></i>
                                                </div>
                                                <div class="timeline-content">
                                                    <h4>Task Submission</h4>
                                                    <p>Status: ${item.status}</p>
                                                    <span class="timeline-date">${date.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        `;
                    } else {
                        // Withdrawal
                        return `
                                            <div class="timeline-item">
                                                <div class="timeline-icon withdrawal-icon">
                                                    <i class="fas fa-money-bill-wave"></i>
                                                </div>
                                                <div class="timeline-content">
                                                    <h4>Withdrawal Request</h4>
                                                    <p>Amount: ₱${item.amount} | Status: ${item.status}</p>
                                                    <span class="timeline-date">${date.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        `;
                    }
                }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showUserTasksModal(user, activeTasks, allSubmissions) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>User Tasks - ${user.email}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tasks-summary">
                        <div class="summary-item">
                            <span class="summary-label">Active Tasks:</span>
                            <span class="summary-value">${activeTasks.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Submissions:</span>
                            <span class="summary-value">${allSubmissions.length}</span>
                        </div>
                    </div>
                    <div class="tasks-list">
                        <h3>Current Active Tasks</h3>
                        ${activeTasks.length === 0 ?
                '<p class="no-tasks">No active tasks</p>' :
                activeTasks.map(task => `
                                <div class="task-item">
                                    <div class="task-info">
                                        <h4>${task.task?.title || 'Unknown Task'}</h4>
                                        <p>Status: ${task.status}</p>
                                        <p>Started: ${task.created_at?.toDate ? task.created_at.toDate().toLocaleString() : 'Unknown'}</p>
                                    </div>
                                    <div class="task-actions">
                                        <span class="status-badge status-${task.status}">${task.status}</span>
                                    </div>
                                </div>
                            `).join('')
            }
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Search and Filter Methods
    searchUsers(searchTerm) {
        this.userSearchTerm = searchTerm.toLowerCase();
        this.renderUsers();
    }

    searchVerifications(searchTerm) {
        this.verificationSearchTerm = searchTerm.toLowerCase();
        this.renderTaskSubmissions(this.verifications);
    }

    searchWithdrawals(searchTerm) {
        this.withdrawalSearchTerm = searchTerm.toLowerCase();
        this.renderWithdrawals(this.withdrawals);
    }

    filterUsers() {
        this.renderUsers();
    }

    filterVerifications() {
        this.renderTaskSubmissions(this.verifications);
    }

    filterWithdrawals() {
        this.renderWithdrawals(this.withdrawals);
    }

    sortUsers() {
        this.renderUsers();
    }

    sortVerifications() {
        this.renderTaskSubmissions(this.verifications);
    }

    sortWithdrawals() {
        this.renderWithdrawals(this.withdrawals);
    }

    getFilteredUsers() {
        let filtered = [...this.users];

        // Apply search filter
        if (this.currentSearchTerm) {
            filtered = filtered.filter(user =>
                user.email && user.email.toLowerCase().includes(this.currentSearchTerm)
            );
        }

        // Apply status filter
        const statusFilter = document.getElementById('user-status-filter')?.value;
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(user => user.status === statusFilter);
        }

        // Apply sorting
        const sortBy = document.getElementById('user-sort-filter')?.value;
        if (sortBy) {
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return (a.email || '').localeCompare(b.email || '');
                    case 'balance':
                        return (b.walletBalance || 0) - (a.walletBalance || 0);
                    case 'created':
                        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                        return dateB - dateA;
                    default:
                        return 0;
                }
            });
        }

        return filtered;
    }

    getFilteredVerifications() {
        let filtered = [...this.verifications];

        // Apply search filter
        if (this.verificationSearchTerm) {
            filtered = filtered.filter(verification => {
                const userEmail = verification.user?.email || verification.userEmail || '';
                const referenceNumber = verification.referenceNumber || '';
                const taskTitle = verification.task?.title || '';
                const status = verification.status || '';

                return userEmail.toLowerCase().includes(this.verificationSearchTerm) ||
                    referenceNumber.toLowerCase().includes(this.verificationSearchTerm) ||
                    taskTitle.toLowerCase().includes(this.verificationSearchTerm) ||
                    status.toLowerCase().includes(this.verificationSearchTerm);
            });
        }

        // Apply status filter
        const statusFilter = document.getElementById('verification-status-filter')?.value;
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(verification => verification.status === statusFilter);
        }

        // Apply sorting
        const sortBy = document.getElementById('verification-sort-filter')?.value;
        if (sortBy) {
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'date':
                        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
                        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
                        return dateB - dateA;
                    case 'user':
                        const userA = a.user?.email || a.userEmail || '';
                        const userB = b.user?.email || b.userEmail || '';
                        return userA.localeCompare(userB);
                    case 'status':
                        return (a.status || '').localeCompare(b.status || '');
                    case 'reference':
                        return (a.referenceNumber || '').localeCompare(b.referenceNumber || '');
                    default:
                        return 0;
                }
            });
        }

        return filtered;
    }

    getFilteredWithdrawals() {
        let filtered = [...this.withdrawals];

        // Apply search filter
        if (this.withdrawalSearchTerm) {
            filtered = filtered.filter(withdrawal => {
                const userEmail = withdrawal.user?.email || withdrawal.userEmail || '';
                const referenceNumber = withdrawal.referenceNumber || '';
                const method = withdrawal.method || '';
                const account = withdrawal.account || '';
                const status = withdrawal.status || '';

                return userEmail.toLowerCase().includes(this.withdrawalSearchTerm) ||
                    referenceNumber.toLowerCase().includes(this.withdrawalSearchTerm) ||
                    method.toLowerCase().includes(this.withdrawalSearchTerm) ||
                    account.toLowerCase().includes(this.withdrawalSearchTerm) ||
                    status.toLowerCase().includes(this.withdrawalSearchTerm);
            });
        }

        // Apply status filter
        const statusFilter = document.getElementById('withdrawal-status-filter')?.value;
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(withdrawal => withdrawal.status === statusFilter);
        }

        // Apply sorting
        const sortBy = document.getElementById('withdrawal-sort-filter')?.value;
        if (sortBy) {
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'date':
                        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
                        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
                        return dateB - dateA;
                    case 'user':
                        const userA = a.user?.email || a.userEmail || '';
                        const userB = b.user?.email || b.userEmail || '';
                        return userA.localeCompare(userB);
                    case 'amount':
                        return (b.amount || 0) - (a.amount || 0);
                    case 'status':
                        return (a.status || '').localeCompare(b.status || '');
                    case 'reference':
                        return (a.referenceNumber || '').localeCompare(b.referenceNumber || '');
                    default:
                        return 0;
                }
            });
        }

        return filtered;
    }
}

// Initialize admin handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing Admin Handler...');
    window.adminHandler = new AdminHandler();
    window.adminHandler.init();
});
