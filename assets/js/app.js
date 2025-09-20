// Main Application Logic - Simplified for separate HTML files
class TaskEarnApp {
    constructor() {
        this.currentUser = null;
        this.tasks = [];
        this.taskStatuses = {};
    }

    async loadTasks() {
        return await window.loadingManager.withPageLoading(async () => {
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
        }, 'Loading tasks...', 'Please wait while we load your available tasks...');
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
            <div class="modern-task-card ${statusConfig.class}" onclick="window.app.openTaskDetail('${task.id}')">
                <div class="task-card-header">
                    <div class="task-image-container">
                        <img src="${task.banner || '/placeholder-banner.jpg'}" alt="${task.title}" class="task-image">
                        <div class="task-overlay">
                            <div class="task-status-badge ${statusConfig.badgeClass}">
                                <i class="${statusConfig.icon}"></i>
                                <span>${statusConfig.label}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="task-card-content">
                    <div class="task-title-section">
                        <h3 class="task-title">${task.title}</h3>
                        <p class="task-description">${task.description || 'Complete this task to earn rewards'}</p>
                    </div>
                    <div class="task-footer">
                        <div class="task-reward">
                            <i class="fas fa-coins"></i>
                        <span class="reward-amount">₱${task.reward}</span>
                        </div>
                        <div class="task-actions">
                            <button class="task-action-btn ${status.status === 'available' ? 'primary' : 'secondary'}">
                                <i class="${status.status === 'available' ? 'fas fa-play' : 'fas fa-eye'}"></i>
                                <span>${status.status === 'available' ? 'Start Task' : 'View Details'}</span>
                        </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusConfig(status) {
        switch (status) {
            case 'available':
                return {
                    class: 'available',
                    badgeClass: 'status-available',
                    icon: 'fas fa-play-circle',
                    label: 'Available'
                };
            case 'in_progress':
                return {
                    class: 'in-progress',
                    badgeClass: 'status-in-progress',
                    icon: 'fas fa-clock',
                    label: 'In Progress'
                };
            case 'pending_review':
                return {
                    class: 'pending',
                    badgeClass: 'status-pending',
                    icon: 'fas fa-hourglass-half',
                    label: 'Pending Review'
                };
            case 'approved':
                return {
                    class: 'approved',
                    badgeClass: 'status-approved',
                    icon: 'fas fa-check-circle',
                    label: 'Approved'
                };
            case 'rejected':
                return {
                    class: 'rejected',
                    badgeClass: 'status-rejected',
                    icon: 'fas fa-times-circle',
                    label: 'Rejected'
                };
            case 'completed':
                return {
                    class: 'completed',
                    badgeClass: 'status-completed',
                    icon: 'fas fa-trophy',
                    label: 'Completed'
                };
            default:
                return {
                    class: 'available',
                    badgeClass: 'status-available',
                    icon: 'fas fa-play-circle',
                    label: 'Available'
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
        if (status.status === 'available') {
            return this.createTaskStartForm(task, status);
        } else if (status.status === 'in_progress') {
            return this.createTaskInProgress(task, status);
        } else if (status.status === 'pending_review') {
            return this.createPendingReviewStatus(task, status);
        } else if (status.status === 'approved') {
            return this.createTaskCompleted(task, status);
        } else if (status.status === 'rejected') {
            return this.createTaskRejected(task, status);
        } else if (status.status === 'completed') {
            return this.createTaskCompleted(task, status);
        } else if (status.status === 'expired') {
            return this.createTaskExpired(task, status);
        } else if (status.status === 'ended') {
            return this.createTaskEnded(task, status);
        }
    }

    createTaskStartForm(task, status) {
        const referrerEmailRequired = task.requires_referrer_email || false;
        const restartCount = status.restart_count || 0;
        const maxRestarts = task.max_restarts || 3;

        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-reward-badge">
                            <i class="fas fa-coins"></i>
                            <span>₱${task.reward}</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="task-instructions">
                        <h4 class="section-title">
                            <i class="fas fa-list-ol"></i>
                            Task Instructions
                        </h4>
                        <div class="instructions-content">
                            ${task.instructions ? task.instructions.split('\n').map(instruction =>
            `<div class="instruction-item">${instruction}</div>`
        ).join('') : '<p>Follow the task requirements to complete and earn your reward.</p>'}
                        </div>
                    </div>

                    ${restartCount > 0 ? `
                        <div class="restart-info">
                            <div class="restart-stats">
                                <div class="restart-item">
                                    <i class="fas fa-redo"></i>
                                    <span>Restarts: ${restartCount}/${maxRestarts}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="task-actions-section">
                        ${referrerEmailRequired ? `
                            <div class="referrer-email-section">
                                <label class="form-label">
                                    <i class="fas fa-envelope"></i>
                                    Referrer Email (Required)
                                </label>
                                <input type="email" id="referrer-email" class="form-input" 
                                       placeholder="Enter referrer email address" required>
                                <small class="form-help">This task requires a referrer email to proceed</small>
                </div>
                        ` : ''}

                        <div class="modal-actions">
                            <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                                <i class="fas fa-times"></i>
                                Cancel
                            </button>
                            <button type="button" onclick="window.app.startTask('${task.id}')" class="btn-primary">
                                <i class="fas fa-play"></i>
                                Start Task
                    </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    createTaskInProgress(task, status) {
        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-in-progress">
                            <i class="fas fa-clock"></i>
                            <span>In Progress</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="task-instructions">
                        <h4 class="section-title">
                            <i class="fas fa-list-ol"></i>
                            Task Instructions
                        </h4>
                        <div class="instructions-content">
                            ${task.instructions ? task.instructions.split('\n').map(instruction =>
            `<div class="instruction-item">${instruction}</div>`
        ).join('') : '<p>Follow the task requirements to complete and earn your reward.</p>'}
                        </div>
                    </div>

                    <div class="task-actions-section">
                        <div class="modal-actions">
                            <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                                <i class="fas fa-times"></i>
                                Close
                            </button>
                            <button type="button" onclick="window.app.submitTaskProof('${task.id}')" class="btn-primary">
                                <i class="fas fa-upload"></i>
                                Submit Proof
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createPendingReviewStatus(task, status) {
        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-pending">
                            <i class="fas fa-hourglass-half"></i>
                            <span>Pending Review</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="pending-review-info">
                        <div class="info-card">
                            <i class="fas fa-clock"></i>
                            <div class="info-content">
                                <h4>Submission Under Review</h4>
                                <p>Your task submission is being reviewed by our team. You'll be notified once the review is complete.</p>
                            </div>
                    </div>
                    
                        <div class="submission-details">
                            <div class="detail-item">
                                <span class="detail-label">Submitted:</span>
                                <span class="detail-value">${new Date(status.created_at?.toDate()).toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Reward:</span>
                                <span class="detail-value">₱${task.reward}</span>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                            <i class="fas fa-times"></i>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createTaskCompleted(task, status) {
        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-completed">
                            <i class="fas fa-trophy"></i>
                            <span>Completed</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="completion-success">
                        <div class="success-card">
                            <i class="fas fa-check-circle"></i>
                            <div class="success-content">
                                <h4>Task Completed Successfully!</h4>
                                <p>Congratulations! You have successfully completed this task and earned your reward.</p>
                            </div>
                        </div>
                        
                        <div class="reward-details">
                            <div class="reward-item">
                                <i class="fas fa-coins"></i>
                                <span class="reward-amount">₱${task.reward}</span>
                                <span class="reward-label">Earned</span>
                            </div>
                        </div>
                </div>

                    <div class="modal-actions">
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-primary">
                            <i class="fas fa-check"></i>
                        Close
                    </button>
                    </div>
                </div>
            </div>
        `;
    }

    createTaskRejected(task, status) {
        const restartCount = status.restart_count || 0;
        const maxRestarts = task.max_restarts || 3;
        const canRestart = restartCount < maxRestarts;

        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-rejected">
                            <i class="fas fa-times-circle"></i>
                            <span>Rejected</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="rejection-info">
                        <div class="rejection-card">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div class="rejection-content">
                                <h4>Task Submission Rejected</h4>
                                <p>Your submission did not meet the requirements. ${status.admin_notes || 'Please review the instructions and try again.'}</p>
                            </div>
                    </div>
                    
                        <div class="restart-info">
                            <div class="restart-stats">
                                <div class="restart-item">
                                    <i class="fas fa-redo"></i>
                                    <span>Restarts: ${restartCount}/${maxRestarts}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                            <i class="fas fa-times"></i>
                        Close
                    </button>
                        ${canRestart ? `
                            <button type="button" onclick="window.app.restartTask('${task.id}')" class="btn-primary">
                                <i class="fas fa-redo"></i>
                                Restart Task
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }



    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // showLoading method removed - now using LoadingManager

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

    // Enhanced Task Management Methods
    async startTask(taskId) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            // Check if referrer email is required
            if (task.requires_referrer_email) {
                // Try task-specific ID first, then fallback to generic ID
                let referrerElement = document.getElementById(`referrer-email-${task.id}`) || document.getElementById('referrer-email');
                const referrerEmail = referrerElement ? referrerElement.value.trim() : null;

                console.log('📧 Referrer email validation (app.js):', {
                    requiresReferrer: task.requires_referrer_email,
                    taskId: task.id,
                    elementId: `referrer-email-${task.id}`,
                    genericElementId: 'referrer-email',
                    elementExists: !!referrerElement,
                    elementValue: referrerElement ? referrerElement.value : 'Element not found',
                    trimmedValue: referrerEmail
                });

                if (!referrerEmail) {
                    this.showToast('Referrer email is required for this task', 'error');
                    return;
                }
            }

            // Use LoadingManager for task operations
            const loadingId = window.loadingManager.showTaskLoading('Starting Task', 'Please wait while we start your task...');

            // Create task submission
            const submissionData = {
                task_id: taskId,
                user_id: currentUser.uid,
                status: 'in_progress',
                restart_count: 0,
                referrer_email: task.requires_referrer_email ? (document.getElementById(`referrer-email-${task.id}`) || document.getElementById('referrer-email'))?.value?.trim() : null
            };

            const result = await window.firestoreManager.createTaskSubmission(submissionData);

            this.showToast(`Task started successfully! Reference: ${result.referenceNumber}`, 'success');
            this.closeTaskModal();

            // Refresh tasks to update status
            await this.loadTasks();
            await this.renderTasks();

        } catch (error) {
            console.error('Error starting task:', error);
            this.showToast('Failed to start task: ' + error.message, 'error');
        } finally {
            window.loadingManager.hideLoading(loadingId);
        }
    }

    async submitTaskProof(taskId) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            // Show proof submission modal
            this.showProofSubmissionModal(taskId);

        } catch (error) {
            console.error('Error submitting task proof:', error);
            this.showToast('Failed to submit proof: ' + error.message, 'error');
        }
    }

    showProofSubmissionModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        const content = document.getElementById('task-modal-content');

        if (!modal || !title || !content) return;

        title.textContent = 'Submit Task Proof';
        content.innerHTML = `
            <div class="proof-submission-modal">
                <div class="proof-form">
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-image"></i>
                            Proof Image
                        </label>
                        <div class="image-upload-area" id="proof-upload-area">
                            <input type="file" id="proof-image" accept="image/*" class="hidden">
                            <div id="proof-upload-content">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Click to upload proof image</p>
                                <small>JPEG, PNG, WebP up to 5MB</small>
                            </div>
                        </div>
                        <div id="proof-preview" class="image-preview hidden"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-comment"></i>
                            Additional Notes (Optional)
                        </label>
                        <textarea id="proof-notes" class="form-textarea" 
                                  placeholder="Add any additional notes about your submission..."></textarea>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="button" onclick="window.app.submitProofForm('${taskId}')" class="btn-primary">
                            <i class="fas fa-paper-plane"></i>
                            Submit Proof
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Setup file upload handlers
        this.setupProofUploadHandlers();

        modal.classList.remove('hidden');
    }

    setupProofUploadHandlers() {
        const uploadArea = document.getElementById('proof-upload-area');
        const fileInput = document.getElementById('proof-image');
        const preview = document.getElementById('proof-preview');

        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // Validate file
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('File size must be less than 5MB');
                }

                if (!file.type.startsWith('image/')) {
                    throw new Error('Please select an image file');
                }

                // Create preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <img src="${e.target.result}" alt="Proof Preview" class="preview-image">
                        <p class="preview-filename">${file.name}</p>
                    `;
                    preview.classList.remove('hidden');
                    uploadArea.classList.add('has-image');
                };
                reader.readAsDataURL(file);

            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
    }

    async submitProofForm(taskId) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            const fileInput = document.getElementById('proof-image');
            const notes = document.getElementById('proof-notes')?.value || '';

            if (!fileInput.files[0]) {
                this.showToast('Please select a proof image', 'error');
                return;
            }

            const loadingId = window.loadingManager.showTaskLoading('Submitting Proof', 'Please wait while we upload your proof...');

            // Upload proof image
            const proofImageUrl = await window.storageManager.uploadProofImage(
                fileInput.files[0],
                currentUser.uid,
                taskId
            );

            // Update task submission
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === currentUser.uid && s.status === 'in_progress'
            );

            if (userSubmission) {
                await window.firestoreManager.updateTaskSubmission(userSubmission.id, 'pending_review', {
                    proof_image_url: proofImageUrl,
                    notes: notes
                });
            }

            this.showToast('Proof submitted successfully!', 'success');
            this.closeTaskModal();

            // Refresh tasks
            await this.loadTasks();
            await this.renderTasks();

        } catch (error) {
            console.error('Error submitting proof:', error);
            this.showToast('Failed to submit proof: ' + error.message, 'error');
        } finally {
            window.loadingManager.hideLoading(loadingId);
        }
    }

    createTaskExpired(task, status) {
        const referrerEmailRequired = task.requires_referrer_email || false;
        const restartCount = status.restart_count || 0;
        const maxRestarts = task.max_restarts || 3;

        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-expired">
                            <i class="fas fa-clock"></i>
                            <span>Time Expired</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="task-instructions">
                        <h4 class="section-title">
                            <i class="fas fa-list-ol"></i>
                            Task Instructions
                        </h4>
                        <div class="instructions-content">
                            ${task.instructions ? task.instructions.split('\n').map(instruction =>
            `<div class="instruction-item">${instruction}</div>`
        ).join('') : '<p>Follow the task requirements to complete and earn your reward.</p>'}
                        </div>
                    </div>

                    <div class="expired-info">
                        <div class="expired-notice">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Your time limit for this task has expired. You can restart the task to begin again with a fresh timer.</p>
                        </div>
                    </div>

                    ${restartCount > 0 ? `
                        <div class="restart-info">
                            <div class="restart-stats">
                                <div class="restart-item">
                                    <i class="fas fa-redo"></i>
                                    <span>Previous Restarts: ${restartCount}/${maxRestarts}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="task-actions-section">
                        ${referrerEmailRequired ? `
                            <div class="referrer-email-section">
                                <label class="form-label">
                                    <i class="fas fa-envelope"></i>
                                    Referrer Email (Required)
                                </label>
                                <input type="email" id="referrer-email-restart" class="form-input" 
                                       placeholder="Enter referrer email address" required>
                                <small class="form-help">This task requires a referrer email to restart</small>
                            </div>
                        ` : ''}

                        <div class="modal-actions">
                            <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                                <i class="fas fa-times"></i>
                                Cancel
                            </button>
                            <button type="button" onclick="window.app.restartExpiredTask('${task.id}')" class="btn-warning">
                                <i class="fas fa-redo"></i>
                                Start Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTaskEnded(task, status) {
        return `
            <div class="task-detail-modal">
                <div class="task-detail-header">
                    <div class="task-detail-title">
                        <h3 class="modal-title">${task.title}</h3>
                        <div class="task-status-badge status-ended">
                            <i class="fas fa-stop"></i>
                            <span>Task Ended</span>
                        </div>
                    </div>
                </div>

                <div class="task-detail-content">
                    <div class="task-instructions">
                        <h4 class="section-title">
                            <i class="fas fa-list-ol"></i>
                            Task Instructions
                        </h4>
                        <div class="instructions-content">
                            ${task.instructions ? task.instructions.split('\n').map(instruction =>
            `<div class="instruction-item">${instruction}</div>`
        ).join('') : '<p>Follow the task requirements to complete and earn your reward.</p>'}
                        </div>
                    </div>

                    <div class="ended-info">
                        <div class="ended-notice">
                            <i class="fas fa-ban"></i>
                            <p>This task has ended and is no longer available for completion. The deadline has passed.</p>
                        </div>
                    </div>

                    <div class="task-actions-section">
                        <div class="modal-actions">
                            <button type="button" onclick="window.app.closeTaskModal()" class="btn-secondary">
                                <i class="fas fa-times"></i>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async restartExpiredTask(taskId) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            // Check if referrer email is required
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.requires_referrer_email) {
                const referrerEmail = document.getElementById('referrer-email-restart')?.value;
                if (!referrerEmail || !referrerEmail.trim()) {
                    this.showToast('Referrer email is required to restart this task', 'error');
                    return;
                }
            }

            const loadingId = window.loadingManager.showTaskLoading('Restarting Task', 'Please wait while we restart your task...');

            // Get current submission to get restart count and referrer email
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === currentUser.uid
            );

            // Create a NEW submission instead of updating the existing one
            // This preserves all previous verification data
            const submissionData = {
                task_id: taskId,
                user_id: currentUser.uid,
                status: 'in_progress',
                restart_count: userSubmission ? (userSubmission.restart_count || 0) + 1 : 1,
                referrer_email: task.requires_referrer_email ? document.getElementById('referrer-email-restart')?.value : (userSubmission ? userSubmission.referrer_email : null)
            };

            const result = await window.firestoreManager.createTaskSubmission(submissionData);

            this.showToast(`Task restarted successfully! New Reference: ${result.referenceNumber}`, 'success');
            this.closeTaskModal();

            // Refresh tasks
            await this.loadTasks();
            await this.renderTasks();

        } catch (error) {
            console.error('Error restarting expired task:', error);
            this.showToast('Failed to restart task: ' + error.message, 'error');
        } finally {
            window.loadingManager.hideLoading(loadingId);
        }
    }

    async restartTask(taskId) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            const loadingId = window.loadingManager.showTaskLoading('Restarting Task', 'Please wait while we restart your task...');

            // Get current submission to get restart count and referrer email
            const submissions = await window.firestoreManager.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === currentUser.uid
            );

            // Create a NEW submission instead of updating the existing one
            // This preserves all previous verification data
            const submissionData = {
                task_id: taskId,
                user_id: currentUser.uid,
                status: 'in_progress',
                restart_count: userSubmission ? (userSubmission.restart_count || 0) + 1 : 1,
                referrer_email: userSubmission ? userSubmission.referrer_email : null
            };

            const result = await window.firestoreManager.createTaskSubmission(submissionData);

            this.showToast(`Task restarted successfully! New Reference: ${result.referenceNumber}`, 'success');
            this.closeTaskModal();

            // Refresh tasks
            await this.loadTasks();
            await this.renderTasks();

        } catch (error) {
            console.error('Error restarting task:', error);
            this.showToast('Failed to restart task: ' + error.message, 'error');
        } finally {
            window.loadingManager.hideLoading(loadingId);
        }
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