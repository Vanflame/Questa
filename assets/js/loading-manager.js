// Global Loading Manager - Unified loading system for all database operations
class LoadingManager {
    constructor() {
        this.activeLoadings = new Map();
        this.loadingCounter = 0;
    }

    // Show loading modal with unique ID
    showLoading(title = 'Loading...', message = 'Please wait while we process your request', options = {}) {
        const loadingId = `loading_${++this.loadingCounter}_${Date.now()}`;

        // Remove existing loading modal if any
        const existingModal = document.querySelector('.loading-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create loading modal
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.id = loadingId;
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

        // Store loading reference
        this.activeLoadings.set(loadingId, {
            modal,
            title,
            message,
            startTime: Date.now(),
            ...options
        });

        return loadingId;
    }

    // Hide loading modal by ID
    hideLoading(loadingId) {
        const loading = this.activeLoadings.get(loadingId);
        if (loading) {
            loading.modal.classList.remove('show');
            setTimeout(() => {
                if (loading.modal.parentNode) {
                    loading.modal.parentNode.removeChild(loading.modal);
                }
                this.activeLoadings.delete(loadingId);
            }, 300);
        }
    }

    // Hide all loading modals
    hideAllLoadings() {
        this.activeLoadings.forEach((loading, loadingId) => {
            this.hideLoading(loadingId);
        });
    }

    // Show loading for database operations
    showDatabaseLoading(operation = 'Database Operation', message = 'Please wait while we process your request') {
        return this.showLoading(operation, message, { type: 'database' });
    }

    // Show loading for page refresh
    showPageLoading(message = 'Loading page...') {
        return this.showLoading('Loading', message, { type: 'page' });
    }

    // Show loading for authentication
    showAuthLoading(message = 'Authenticating...') {
        return this.showLoading('Authentication', message, { type: 'auth' });
    }

    // Show loading for file upload
    showUploadLoading(message = 'Uploading file...') {
        return this.showLoading('Uploading', message, { type: 'upload' });
    }

    // Show loading for task operations
    showTaskLoading(operation = 'Task Operation', message = 'Please wait while we process your task...') {
        return this.showLoading(operation, message, { type: 'task' });
    }

    // Show loading for withdrawal operations
    showWithdrawalLoading(message = 'Processing withdrawal...') {
        return this.showLoading('Processing Withdrawal', message, { type: 'withdrawal' });
    }

    // Show loading for admin operations
    showAdminLoading(operation = 'Admin Operation', message = 'Please wait while we process your request...') {
        return this.showLoading(operation, message, { type: 'admin' });
    }

    // Wrapper for async operations with automatic loading
    async withLoading(asyncFunction, title, message, options = {}) {
        const loadingId = this.showLoading(title, message, options);
        try {
            const result = await asyncFunction();
            return result;
        } finally {
            this.hideLoading(loadingId);
        }
    }

    // Wrapper for database operations
    async withDatabaseLoading(asyncFunction, operation, message) {
        return this.withLoading(asyncFunction, operation, message, { type: 'database' });
    }

    // Wrapper for page operations
    async withPageLoading(asyncFunction, message) {
        return this.withLoading(asyncFunction, 'Loading', message, { type: 'page' });
    }

    // Get loading statistics
    getLoadingStats() {
        return {
            activeCount: this.activeLoadings.size,
            loadings: Array.from(this.activeLoadings.entries()).map(([id, loading]) => ({
                id,
                title: loading.title,
                message: loading.message,
                duration: Date.now() - loading.startTime,
                type: loading.type
            }))
        };
    }
}

// Create global instance
window.loadingManager = new LoadingManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingManager;
}
