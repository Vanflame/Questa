// Admin Panel Module - Simplified for separate HTML files
class AdminManager {
    constructor() {
        this.tasks = [];
        this.verifications = [];
        this.withdrawals = [];
    }

    setupEventListeners() {
        // Task management
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-task-btn')) {
                const taskId = e.target.getAttribute('data-task-id');
                this.editTask(taskId);
            }

            if (e.target.classList.contains('delete-task-btn')) {
                const taskId = e.target.getAttribute('data-task-id');
                this.deleteTask(taskId);
            }

            // Note: Verification approval/rejection is handled by admin-handler.js
            // These event listeners are disabled to prevent conflicts
            /*
            if (e.target.classList.contains('approve-verification-btn')) {
                const verificationId = e.target.getAttribute('data-verification-id');
                this.approveVerification(verificationId);
            }

            if (e.target.classList.contains('reject-verification-btn')) {
                const verificationId = e.target.getAttribute('data-verification-id');
                this.rejectVerification(verificationId);
            }
            */

            if (e.target.classList.contains('approve-withdrawal-btn')) {
                const withdrawalId = e.target.getAttribute('data-withdrawal-id');
                this.approveWithdrawal(withdrawalId);
            }

            if (e.target.classList.contains('reject-withdrawal-btn')) {
                const withdrawalId = e.target.getAttribute('data-withdrawal-id');
                this.rejectWithdrawal(withdrawalId);
            }
        });
    }

    async loadAdminData() {
        await Promise.all([
            this.loadAdminTasks(),
            this.loadAdminVerifications(),
            this.loadAdminWithdrawals()
        ]);
    }

    // Task Management
    async loadAdminTasks() {
        try {
            const tasks = await window.firestoreManager.getTasks();
            this.tasks = tasks;
            this.renderAdminTasks();
        } catch (error) {
            console.error('Error loading admin tasks:', error);
            this.showToast('Failed to load tasks', 'error');
        }
    }

    renderAdminTasks() {
        const container = document.getElementById('admin-tasks-list');
        if (!container) return;

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No tasks available</p>
                    <button id="add-task-btn" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Add First Task
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${this.tasks.map(task => this.createAdminTaskCard(task)).join('')}
            </div>
        `;
    }

    createAdminTaskCard(task) {
        return `
            <div class="bg-white border rounded-lg p-6 shadow-sm">
                <div class="relative">
                    <img src="${task.banner || '/placeholder-banner.jpg'}" alt="${task.title}" class="w-full h-32 object-cover rounded-md mb-4">
                    <span class="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        ${task.status}
                    </span>
                </div>
                
                <h3 class="text-lg font-semibold text-gray-900 mb-2">${task.title}</h3>
                <p class="text-2xl font-bold text-green-600 mb-4">₱${task.reward}</p>
                
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">
                        Created: ${new Date(task.createdAt?.toDate()).toLocaleDateString()}
                    </span>
                    <div class="admin-actions">
                        <button class="edit-task-btn text-blue-600 hover:text-blue-800 text-sm" data-task-id="${task.id}">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button class="delete-task-btn text-red-600 hover:text-red-800 text-sm ml-2" data-task-id="${task.id}">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showAddTaskModal() {
        this.showToast('Add task functionality coming soon!', 'info');
    }

    editTask(taskId) {
        this.showToast('Edit task functionality coming soon!', 'info');
    }

    async deleteTask(taskId) {
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

    // Verification Management
    async loadAdminVerifications() {
        try {
            const verifications = await window.firestoreManager.getAllVerifications();
            this.verifications = verifications;
            this.renderAdminVerifications();
        } catch (error) {
            console.error('Error loading admin verifications:', error);
            this.showToast('Failed to load verifications', 'error');
        }
    }

    renderAdminVerifications() {
        const container = document.getElementById('verifications-list');
        if (!container) return;

        if (this.verifications.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-check-circle text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No verifications submitted yet</p>
                </div>
            `;
            return;
        }

        // Group verifications by task and user
        const groupedVerifications = this.groupVerifications(this.verifications);

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
            <div class="border rounded-lg p-6 mb-6 bg-white">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900">User Verification</h4>
                        <p class="text-sm text-gray-500">User ID: ${group.userId}</p>
                        <p class="text-sm text-gray-500">Task ID: ${group.taskId}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-sm text-gray-500">Submitted: ${new Date(initialVerification?.createdAt?.toDate()).toLocaleDateString()}</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${this.createVerificationCard('Initial Verification', initialVerification)}
                    ${this.createVerificationCard('Final Verification', finalVerification)}
                </div>

                <div class="mt-4 flex space-x-4">
                    ${this.createVerificationActions(initialVerification, finalVerification)}
                </div>
            </div>
        `;
    }

    createVerificationCard(title, verification) {
        if (!verification) {
            return `
                <div class="border rounded-lg p-4 bg-gray-50">
                    <h5 class="font-semibold text-gray-700 mb-2">${title}</h5>
                    <p class="text-gray-500">Not submitted yet</p>
                </div>
            `;
        }

        const statusConfig = this.getVerificationStatusConfig(verification.status);

        return `
            <div class="border rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h5 class="font-semibold text-gray-900">${title}</h5>
                    <span class="status-badge ${statusConfig.badgeClass}">${statusConfig.label}</span>
                </div>
                
                <div class="space-y-2">
                    <p class="text-sm text-gray-600">
                        <strong>Game ID:</strong> ${verification.gameId}
                    </p>
                    <p class="text-sm text-gray-600">
                        <strong>Android Version:</strong> ${verification.androidVersion}
                    </p>
                    <p class="text-sm text-gray-600">
                        <strong>Submitted:</strong> ${new Date(verification.createdAt?.toDate()).toLocaleString()}
                    </p>
                </div>

                ${verification.profileScreenshot ? `
                    <div class="mt-3">
                        <p class="text-sm font-medium text-gray-700 mb-1">Profile Screenshot:</p>
                        <img src="${verification.profileScreenshot}" alt="Profile Screenshot" class="w-full h-auto rounded-md border">
                    </div>
                ` : ''}

                ${verification.stageScreenshot ? `
                    <div class="mt-3">
                        <p class="text-sm font-medium text-gray-700 mb-1">Stage Screenshot:</p>
                        <img src="${verification.stageScreenshot}" alt="Stage Screenshot" class="w-full h-auto rounded-md border">
                    </div>
                ` : ''}
            </div>
        `;
    }

    createVerificationActions(initialVerification, finalVerification) {
        const actions = [];

        if (initialVerification && initialVerification.status === 'pending') {
            actions.push(`
                <button class="approve-verification-btn btn-success" data-verification-id="${initialVerification.id}">
                    Approve Initial
                </button>
                <button class="reject-verification-btn btn-danger" data-verification-id="${initialVerification.id}">
                    Reject Initial
                </button>
            `);
        }

        if (finalVerification && finalVerification.status === 'pending') {
            actions.push(`
                <button class="approve-verification-btn btn-success" data-verification-id="${finalVerification.id}">
                    Approve Final
                </button>
                <button class="reject-verification-btn btn-danger" data-verification-id="${finalVerification.id}">
                    Reject Final
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

    async approveVerification(verificationId) {
        try {
            const verification = this.verifications.find(v => v.id === verificationId);
            if (!verification) return;

            this.showLoading(true);

            await window.firestoreManager.updateVerification(verificationId, {
                status: 'approved',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // If this is a final verification approval, credit the user's wallet
            if (verification.phase === 'final') {
                const task = this.tasks.find(t => t.id === verification.taskId);
                if (task) {
                    await window.firestoreManager.updateWalletBalance(verification.userId, task.reward);
                }
            }

            this.showToast('Verification approved successfully!', 'success');
            await this.loadAdminVerifications();

        } catch (error) {
            console.error('Error approving verification:', error);
            this.showToast('Failed to approve verification: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async rejectVerification(verificationId) {
        try {
            this.showLoading(true);

            await window.firestoreManager.updateVerification(verificationId, {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Verification rejected', 'info');
            await this.loadAdminVerifications();

        } catch (error) {
            console.error('Error rejecting verification:', error);
            this.showToast('Failed to reject verification: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Withdrawal Management
    async loadAdminWithdrawals() {
        try {
            const withdrawals = await window.firestoreManager.getAllWithdrawals();
            this.withdrawals = withdrawals;
            this.renderAdminWithdrawals();
        } catch (error) {
            console.error('Error loading admin withdrawals:', error);
            this.showToast('Failed to load withdrawals', 'error');
        }
    }

    renderAdminWithdrawals() {
        const container = document.getElementById('withdrawals-list');
        if (!container) return;

        if (this.withdrawals.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-money-bill-wave text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No withdrawal requests yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.withdrawals.map(withdrawal => {
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

    async approveWithdrawal(withdrawalId) {
        try {
            const withdrawal = this.withdrawals.find(w => w.id === withdrawalId);
            if (!withdrawal) return;

            this.showLoading(true);

            // Update withdrawal status
            await window.firestoreManager.updateWithdrawal(withdrawalId, {
                status: 'paid',
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Deduct from user's wallet balance
            await window.firestoreManager.updateWalletBalance(withdrawal.userId, -withdrawal.amount);

            this.showToast('Withdrawal marked as paid!', 'success');
            await this.loadAdminWithdrawals();

        } catch (error) {
            console.error('Error approving withdrawal:', error);
            this.showToast('Failed to approve withdrawal: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async rejectWithdrawal(withdrawalId) {
        try {
            this.showLoading(true);

            await window.firestoreManager.updateWithdrawal(withdrawalId, {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Withdrawal rejected', 'info');
            await this.loadAdminWithdrawals();

        } catch (error) {
            console.error('Error rejecting withdrawal:', error);
            this.showToast('Failed to reject withdrawal: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Utility Methods
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

// Initialize admin manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('👑 Initializing AdminManager...');
    window.adminManager = new AdminManager();
    console.log('✅ AdminManager initialized');
});