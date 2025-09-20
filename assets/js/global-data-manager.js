// Global Data Manager with Caching and Single Loading System
class GlobalDataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
        this.isLoading = false;
        this.loadingCallbacks = new Set();
        this.currentUser = null;
    }

    // Set current user
    setCurrentUser(user) {
        this.currentUser = user;
    }

    // Show global loading
    showGlobalLoading() {
        if (this.isLoading) return;

        this.isLoading = true;
        const loadingSpinner = document.getElementById('loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.classList.remove('hidden');
        }

        // Show loading in tasks area
        const tasksGrid = document.getElementById('tasks-grid');
        if (tasksGrid) {
            tasksGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="loading-spinner-icon">
                        <div class="spinner"></div>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Loading your dashboard...</h3>
                    <p class="text-gray-500">Please wait while we prepare your data</p>
                </div>
            `;
        }
    }

    // Hide global loading
    hideGlobalLoading() {
        this.isLoading = false;
        const loadingSpinner = document.getElementById('loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.classList.add('hidden');
        }

        // Notify all callbacks that loading is complete
        this.loadingCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in loading callback:', error);
            }
        });
        this.loadingCallbacks.clear();
    }

    // Add loading callback
    addLoadingCallback(callback) {
        this.loadingCallbacks.add(callback);
    }

    // Check if data is cached and valid
    isCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;

        const now = Date.now();
        return (now - cached.timestamp) < this.cacheTimeout;
    }

    // Get cached data
    getCached(key) {
        const cached = this.cache.get(key);
        return cached ? cached.data : null;
    }

    // Set cached data
    setCached(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Clear specific cache key
    clearCacheKey(key) {
        this.cache.delete(key);
    }

    // Load user data with caching
    async loadUserData(forceRefresh = false) {
        if (!this.currentUser) return null;

        const cacheKey = `user_${this.currentUser.uid}`;

        if (!forceRefresh && this.isCached(cacheKey)) {
            console.log('📦 Using cached user data');
            return this.getCached(cacheKey);
        }

        try {
            console.log('🔄 Loading user data from database');
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            const userData = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;

            if (userData) {
                this.setCached(cacheKey, userData);
            }

            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            return null;
        }
    }

    // Load tasks with caching
    async loadTasks(forceRefresh = false) {
        const cacheKey = 'tasks';

        if (!forceRefresh && this.isCached(cacheKey)) {
            console.log('📦 Using cached tasks');
            return this.getCached(cacheKey);
        }

        try {
            console.log('🔄 Loading tasks from database');
            const snapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .orderBy('created_at', 'desc')
                .get();

            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.setCached(cacheKey, tasks);
            return tasks;
        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }

    // Load user balance with caching
    async loadUserBalance(forceRefresh = false) {
        if (!this.currentUser) return 0;

        const cacheKey = `balance_${this.currentUser.uid}`;

        if (!forceRefresh && this.isCached(cacheKey)) {
            console.log('📦 Using cached balance');
            return this.getCached(cacheKey);
        }

        try {
            console.log('🔄 Loading user balance from database');
            const userData = await this.loadUserData(forceRefresh);
            const balance = userData ? userData.walletBalance || 0 : 0;

            this.setCached(cacheKey, balance);
            return balance;
        } catch (error) {
            console.error('Error loading user balance:', error);
            return 0;
        }
    }

    // Load all dashboard data
    async loadDashboardData(forceRefresh = false) {
        this.showGlobalLoading();

        try {
            const [userData, tasks, balance] = await Promise.all([
                this.loadUserData(forceRefresh),
                this.loadTasks(forceRefresh),
                this.loadUserBalance(forceRefresh)
            ]);

            return {
                userData,
                tasks,
                balance
            };
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            return {
                userData: null,
                tasks: [],
                balance: 0
            };
        } finally {
            // Hide loading after a short delay to ensure smooth transition
            setTimeout(() => {
                this.hideGlobalLoading();
            }, 500);
        }
    }

    // Refresh specific data
    async refreshUserData() {
        this.clearCacheKey(`user_${this.currentUser?.uid}`);
        this.clearCacheKey(`balance_${this.currentUser?.uid}`);
        return await this.loadUserData(true);
    }

    async refreshTasks() {
        this.clearCacheKey('tasks');
        return await this.loadTasks(true);
    }

    async refreshBalance() {
        this.clearCacheKey(`balance_${this.currentUser?.uid}`);
        return await this.loadUserBalance(true);
    }

    // Refresh all data
    async refreshAll() {
        this.clearCache();
        return await this.loadDashboardData(true);
    }

    // Update balance in cache
    updateBalance(newBalance) {
        if (this.currentUser) {
            const cacheKey = `balance_${this.currentUser.uid}`;
            this.setCached(cacheKey, newBalance);
        }
    }

    // Update user data in cache
    updateUserData(updates) {
        if (this.currentUser) {
            const cacheKey = `user_${this.currentUser.uid}`;
            const currentData = this.getCached(cacheKey);
            if (currentData) {
                const updatedData = { ...currentData, ...updates };
                this.setCached(cacheKey, updatedData);
            }
        }
    }
}

// Create global instance
window.globalDataManager = new GlobalDataManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalDataManager;
}
