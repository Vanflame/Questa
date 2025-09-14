// Main Application Logic - Simplified for separate HTML files
class TaskEarnApp {
    constructor() {
        this.currentUser = null;
        this.tasks = [];
        this.taskStatuses = {};
    }

    async loadTasks() {
        try {
            console.log('Loading tasks...');

            // Check if firestoreManager is available
            if (!window.firestoreManager) {
                console.error('FirestoreManager not available');
                return [];
            }

            const tasks = await window.firestoreManager.getTasks();
            console.log('Tasks loaded:', tasks);
            this.tasks = tasks || [];
            return this.tasks;
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
            return [];
        }
    }

    async renderTasks() {
        const tasksGrid = document.getElementById('tasks-grid');
        if (!tasksGrid) return;

        if (this.tasks.length === 0) {
            tasksGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No tasks available</h3>
                    <p class="text-gray-500">Check back later for new tasks!</p>
                </div>
            `;
            return;
        }

        // Load task statuses for current user
        const currentUser = window.authManager?.getCurrentUser();
        if (!currentUser) return;

        const taskStatuses = {};
        for (const task of this.tasks) {
            taskStatuses[task.id] = await window.firestoreManager.getTaskStatusForUser(currentUser.uid, task.id);
        }

        this.taskStatuses = taskStatuses;

        tasksGrid.innerHTML = this.tasks.map(task => {
            const status = taskStatuses[task.id];
            return this.createTaskCard(task, status);
        }).join('');
    }

    createTaskCard(task, status) {
        const statusConfig = this.getStatusConfig(status.status);

        return `
            <div class="task-card ${statusConfig.class}" onclick="window.app.openTaskDetail('${task.id}')">
                <div class="relative">
                    <img src="${task.banner || '/placeholder-banner.jpg'}" alt="${task.title}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="absolute top-2 right-2">
                        <span class="status-badge ${statusConfig.badgeClass}">
                            ${statusConfig.icon} ${statusConfig.label}
                        </span>
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">${task.title}</h3>
                    <div class="flex justify-between items-center">
                        <span class="reward-amount">₱${task.reward}</span>
                        <button class="text-blue-600 hover:text-blue-800 font-medium">
                            ${status.status === 'locked' ? 'Start Task' : 'View Details'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusConfig(status) {
        switch (status) {
            case 'locked':
                return {
                    class: 'locked',
                    badgeClass: 'status-locked',
                    icon: '🔴',
                    label: 'Locked'
                };
            case 'pending':
                return {
                    class: 'pending',
                    badgeClass: 'status-pending',
                    icon: '🟡',
                    label: 'Pending'
                };
            case 'complete':
                return {
                    class: 'complete',
                    badgeClass: 'status-complete',
                    icon: '🟢',
                    label: 'Complete'
                };
            case 'unlocked':
                return {
                    class: '',
                    badgeClass: 'status-pending',
                    icon: '🟡',
                    label: 'Available'
                };
            default:
                return {
                    class: 'locked',
                    badgeClass: 'status-locked',
                    icon: '🔴',
                    label: 'Locked'
                };
        }
    }

    openTaskDetail(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const currentUser = window.authManager?.getCurrentUser();
        if (!currentUser) return;

        const status = this.taskStatuses[taskId];
        this.showTaskModal(task, status);
    }

    showTaskModal(task, status) {
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        const content = document.getElementById('task-modal-content');

        if (!modal || !title || !content) {
            console.log('Task detail functionality coming soon!');
            return;
        }

        title.textContent = task.title;
        content.innerHTML = this.createTaskModalContent(task, status);

        modal.classList.remove('hidden');
    }

    createTaskModalContent(task, status) {
        if (status.status === 'locked') {
            return this.createAndroidVersionCheck(task);
        } else if (status.status === 'pending' && status.phase === 'initial') {
            return this.createPendingInitialStatus(task, status);
        } else if (status.status === 'unlocked' || status.status === 'complete') {
            return this.createTaskInstructions(task, status);
        } else if (status.status === 'pending' && status.phase === 'final') {
            return this.createPendingFinalStatus(task, status);
        }
    }

    createAndroidVersionCheck(task) {
        // Directly proceed to initial verification since Android version will be captured there
        this.showInitialVerification(task.id);
        return '';
    }

    createPendingInitialStatus(task, status) {
        return `
            <div class="verification-phase pending">
                <div class="flex items-center mb-4">
                    <i class="fas fa-clock text-yellow-500 mr-2"></i>
                    <h4 class="font-semibold text-gray-900">Initial Verification Pending</h4>
                </div>
                <p class="text-gray-600 mb-4">
                    Your initial verification is being reviewed. You'll be notified once it's approved.
                </p>
                <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p class="text-sm text-yellow-800">
                        <strong>Status:</strong> Pending approval<br>
                        <strong>Submitted:</strong> ${new Date(status.createdAt?.toDate()).toLocaleString()}
                    </p>
                </div>
                <div class="mt-4">
                    <button onclick="window.app.closeTaskModal()" class="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
    }

    createTaskInstructions(task, status) {
        return `
            <div class="space-y-6">
                <div class="verification-phase completed">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <h4 class="font-semibold text-gray-900">Initial Verification Approved</h4>
                    </div>
                    <p class="text-gray-600">Great! You can now proceed with the task.</p>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 class="font-semibold text-gray-900 mb-4">Task Instructions</h4>
                    <ol class="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Activate DNS settings on your device</li>
                        <li>Copy the Immutable link provided below</li>
                        <li>Complete Stage 0–18 in the game</li>
                        <li>Take a screenshot showing your progress</li>
                    </ol>
                </div>

                ${status.status !== 'complete' ? this.createFinalVerificationForm(task) : this.createCompletedStatus(task)}
            </div>
        `;
    }

    createFinalVerificationForm(task) {
        return `
            <div class="verification-phase">
                <h4 class="font-semibold text-gray-900 mb-4">Final Verification</h4>
                <form id="final-verification-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Game ID</label>
                        <input type="text" id="final-game-id" required class="form-input" placeholder="Enter your Game ID">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Stage 0-18 Screenshot</label>
                        <div id="stage-upload-area" class="image-upload">
                            <input type="file" id="stage-screenshot" accept="image/*" class="hidden">
                            <div id="stage-upload-content">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                                <p class="text-gray-600">Click to upload screenshot</p>
                                <p class="text-xs text-gray-500">JPEG, PNG, WebP up to 5MB</p>
                            </div>
                        </div>
                        <div id="stage-preview" class="file-preview hidden"></div>
                    </div>

                    <div class="flex space-x-4">
                        <button type="submit" class="btn-primary">
                            Submit Final Verification
                        </button>
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    createCompletedStatus(task) {
        return `
            <div class="verification-phase completed">
                <div class="flex items-center mb-4">
                    <i class="fas fa-check-circle text-green-500 mr-2"></i>
                    <h4 class="font-semibold text-gray-900">Task Completed!</h4>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-md p-4">
                    <p class="text-green-800 mb-2">
                        <strong>Congratulations!</strong> You have successfully completed this task.
                    </p>
                    <p class="text-green-700">
                        <strong>Reward Earned:</strong> ₱${task.reward}
                    </p>
                </div>
                <div class="mt-4">
                    <button onclick="window.app.closeTaskModal()" class="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
    }

    createPendingFinalStatus(task, status) {
        return `
            <div class="verification-phase pending">
                <div class="flex items-center mb-4">
                    <i class="fas fa-clock text-yellow-500 mr-2"></i>
                    <h4 class="font-semibold text-gray-900">Final Verification Pending</h4>
                </div>
                <p class="text-gray-600 mb-4">
                    Your final verification is being reviewed. You'll receive your reward once approved.
                </p>
                <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p class="text-sm text-yellow-800">
                        <strong>Status:</strong> Pending approval<br>
                        <strong>Reward:</strong> ₱${task.reward}<br>
                        <strong>Submitted:</strong> ${new Date(status.createdAt?.toDate()).toLocaleString()}
                    </p>
                </div>
                <div class="mt-4">
                    <button onclick="window.app.closeTaskModal()" class="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
    }


    showInitialVerification(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const content = document.getElementById('task-modal-content');
        content.innerHTML = `
            <div class="verification-phase">
                <h4 class="font-semibold text-gray-900 mb-4">Initial Verification</h4>
                <p class="text-gray-600 mb-4">
                    Please provide your Game ID, Android version, and upload a profile screenshot showing your Game ID.
                </p>
                
                <form id="initial-verification-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Game ID</label>
                        <input type="text" id="initial-game-id" required class="form-input" placeholder="Enter your Game ID">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Profile Screenshot</label>
                        <div id="profile-upload-area" class="image-upload">
                            <input type="file" id="profile-screenshot" accept="image/*" class="hidden">
                            <div id="profile-upload-content">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                                <p class="text-gray-600">Click to upload screenshot</p>
                                <p class="text-xs text-gray-500">Must show Game ID in profile</p>
                            </div>
                        </div>
                        <div id="profile-preview" class="file-preview hidden"></div>
                    </div>

                    <div class="flex space-x-4">
                        <button type="submit" class="btn-primary">
                            Submit Initial Verification
                        </button>
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Setup form handlers
        this.setupInitialVerificationHandlers(taskId, androidVersion);
    }

    setupInitialVerificationHandlers(taskId, androidVersion) {
        // File upload handlers
        const profileUploadArea = document.getElementById('profile-upload-area');
        const profileInput = document.getElementById('profile-screenshot');
        const profilePreview = document.getElementById('profile-preview');

        profileUploadArea.addEventListener('click', () => profileInput.click());

        profileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                window.storageManager.validateImageFile(file);
                const preview = await window.storageManager.createImagePreview(file);

                profilePreview.innerHTML = `
                    <img src="${preview}" alt="Preview" class="max-w-full h-auto rounded-md">
                    <p class="text-sm text-gray-600 mt-2">${file.name} (${window.storageManager.formatFileSize(file.size)})</p>
                `;
                profilePreview.classList.remove('hidden');
                profileUploadArea.classList.add('has-image');
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });

        // Form submission
        document.getElementById('initial-verification-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitInitialVerification(taskId, androidVersion);
        });
    }

    async submitInitialVerification(taskId, androidVersion) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            const gameId = document.getElementById('initial-game-id').value;
            const profileFile = document.getElementById('profile-screenshot').files[0];

            if (!gameId || !profileFile) {
                this.showToast('Please fill in all fields', 'error');
                return;
            }

            this.showLoading(true);

            // Upload profile screenshot
            const profileScreenshot = await window.storageManager.uploadProfileScreenshot(
                profileFile, currentUser.uid, taskId
            );

            // Create verification record
            await window.firestoreManager.createVerification({
                userId: currentUser.uid,
                taskId: taskId,
                gameId: gameId,
                androidVersion: androidVersion,
                profileScreenshot: profileScreenshot,
                phase: 'initial'
            });

            this.showToast('Initial verification submitted successfully!', 'success');
            this.closeTaskModal();

            // Refresh tasks to update status
            await this.loadTasks();

        } catch (error) {
            console.error('Error submitting initial verification:', error);
            this.showToast('Failed to submit verification: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Initializing TaskEarnApp...');
    window.app = new TaskEarnApp();
    console.log('✅ TaskEarnApp initialized');
});

// Export for use in other modules
window.TaskEarnApp = TaskEarnApp;