// Firestore Database Module
class FirestoreManager {
    constructor() {
        this.collections = {
            users: 'users',
            tasks: 'tasks',
            verifications: 'verifications',
            withdrawals: 'withdrawals',
            taskStatuses: 'taskStatuses',
            taskSubmissions: 'task_submissions',
            balances: 'balances',
            notifications: 'notifications'
        };
    }

    // User Management
    async createUser(userData) {
        return await window.loadingManager.withDatabaseLoading(async () => {
            // Generate short user ID
            const shortUserId = this.generateShortUserId(userData.uid);

            await db.collection(this.collections.users).doc(userData.uid).set({
                email: userData.email,
                user_short_id: shortUserId,
                walletBalance: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            });
            return true;
        }, 'Creating Account', 'Please wait while we create your account...');
    }

    async updateUser(uid, data) {
        try {
            await db.collection(this.collections.users).doc(uid).update(data);
            return true;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async getUser(uid) {
        try {
            const doc = await db.collection(this.collections.users).doc(uid).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    async updateWalletBalance(uid, amount, reason = 'balance_update', metadata = {}) {
        try {
            const userRef = db.collection(this.collections.users).doc(uid);
            let beforeBalance = 0;
            let afterBalance = 0;

            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('User does not exist');
                }

                beforeBalance = userDoc.data().walletBalance || 0;
                afterBalance = beforeBalance + amount;

                transaction.update(userRef, { walletBalance: afterBalance });
            });

            // Record the balance change in transaction history
            await this.recordBalanceChange(uid, {
                beforeBalance,
                afterBalance,
                changeAmount: amount,
                reason,
                metadata,
                timestamp: new Date()
            });

            return { beforeBalance, afterBalance };
        } catch (error) {
            console.error('Error updating wallet balance:', error);
            throw error;
        }
    }

    async recordBalanceChange(uid, changeData) {
        try {
            console.log('📝 Recording balance change:', {
                userId: uid,
                reason: changeData.reason,
                changeAmount: changeData.changeAmount,
                beforeBalance: changeData.beforeBalance,
                afterBalance: changeData.afterBalance
            });

            await db.collection('balance_changes').add({
                userId: uid,
                beforeBalance: changeData.beforeBalance,
                afterBalance: changeData.afterBalance,
                changeAmount: changeData.changeAmount,
                reason: changeData.reason,
                metadata: changeData.metadata,
                timestamp: changeData.timestamp,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Balance change recorded successfully');
        } catch (error) {
            console.error('❌ Error recording balance change:', error);
            // Don't throw error here as it's not critical
        }
    }

    async getAllUsers() {
        try {
            const usersSnapshot = await db.collection(this.collections.users).get();
            const users = [];
            usersSnapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            return users;
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    async updateUserStatus(uid, status) {
        try {
            await db.collection(this.collections.users).doc(uid).update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error updating user status:', error);
            throw error;
        }
    }

    // Admin action notifications
    async createAdminNotification(userId, notificationData) {
        try {
            const docRef = await db.collection('notifications').add({
                userId: userId,
                type: notificationData.type, // 'balance_change', 'withdrawal_rejected', etc.
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data || {},
                isRead: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating admin notification:', error);
            throw error;
        }
    }

    async getUserNotifications(userId) {
        try {
            const notificationsSnapshot = await db.collection('notifications')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            const notifications = [];
            notificationsSnapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            return notifications;
        } catch (error) {
            console.error('Error getting user notifications:', error);
            throw error;
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).update({
                isRead: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    // Task Management
    async createTask(taskData) {
        try {
            const docRef = await db.collection(this.collections.tasks).add({
                ...taskData,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Keep both for compatibility
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                status: taskData.status || 'active'
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    async updateTask(taskId, data) {
        try {
            await db.collection(this.collections.tasks).doc(taskId).update(data);
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            await db.collection(this.collections.tasks).doc(taskId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    async getTasks() {
        return await window.loadingManager.withDatabaseLoading(async () => {
            const snapshot = await db.collection(this.collections.tasks)
                .where('status', '==', 'active')
                .orderBy('created_at', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }, 'Loading Tasks', 'Please wait while we load available tasks...');
    }

    async getAllTasks() {
        try {
            const snapshot = await db.collection(this.collections.tasks)
                .orderBy('created_at', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting all tasks:', error);
            throw error;
        }
    }

    async getTask(taskId) {
        try {
            const doc = await db.collection(this.collections.tasks).doc(taskId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting task:', error);
            throw error;
        }
    }

    // Verification Management
    async createVerification(verificationData) {
        try {
            const docRef = await db.collection(this.collections.verifications).add({
                ...verificationData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating verification:', error);
            throw error;
        }
    }

    async updateVerification(verificationId, data) {
        try {
            await db.collection(this.collections.verifications).doc(verificationId).update(data);
            return true;
        } catch (error) {
            console.error('Error updating verification:', error);
            throw error;
        }
    }

    async getVerificationsByUser(userId) {
        try {
            const snapshot = await db.collection(this.collections.verifications)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting user verifications:', error);
            throw error;
        }
    }

    async getVerificationsByTask(taskId) {
        try {
            const snapshot = await db.collection(this.collections.verifications)
                .where('taskId', '==', taskId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting task verifications:', error);
            throw error;
        }
    }

    async getAllVerifications() {
        try {
            const snapshot = await db.collection(this.collections.verifications)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting all verifications:', error);
            throw error;
        }
    }

    async getVerification(verificationId) {
        try {
            const doc = await db.collection(this.collections.verifications).doc(verificationId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting verification:', error);
            throw error;
        }
    }

    // Withdrawal Management
    async createWithdrawal(withdrawalData) {
        try {
            const docRef = await db.collection(this.collections.withdrawals).add({
                ...withdrawalData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating withdrawal:', error);
            throw error;
        }
    }

    async updateWithdrawal(withdrawalId, data) {
        try {
            await db.collection(this.collections.withdrawals).doc(withdrawalId).update(data);
            return true;
        } catch (error) {
            console.error('Error updating withdrawal:', error);
            throw error;
        }
    }

    async getWithdrawalsByUser(userId) {
        try {
            const snapshot = await db.collection(this.collections.withdrawals)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting user withdrawals:', error);
            throw error;
        }
    }

    async getAllWithdrawals() {
        try {
            const snapshot = await db.collection(this.collections.withdrawals)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting all withdrawals:', error);
            throw error;
        }
    }

    async getWithdrawal(withdrawalId) {
        try {
            const doc = await db.collection(this.collections.withdrawals).doc(withdrawalId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting withdrawal:', error);
            throw error;
        }
    }

    // Utility Methods
    async getTaskStatusForUser(userId, taskId) {
        try {
            // Get task submission for this user and task
            const submissions = await this.getTaskSubmissions('all');
            const userSubmission = submissions.find(s =>
                s.task_id === taskId && s.user_id === userId
            );

            if (userSubmission) {
                return {
                    status: userSubmission.status,
                    restart_count: userSubmission.restart_count || 0,
                    created_at: userSubmission.created_at,
                    updated_at: userSubmission.updated_at
                };
            }

            // No submission found, task is available
            return { status: 'available', restart_count: 0 };
        } catch (error) {
            console.error('Error getting task status for user:', error);
            return { status: 'available', restart_count: 0 };
        }
    }

    async updateTaskStatus(taskId, status, userId = null) {
        // This method is deprecated - use task submissions instead
        console.warn('updateTaskStatus is deprecated. Use task submissions instead.');
        return true;
    }


    // Real-time listeners
    listenToTasks(callback) {
        return db.collection(this.collections.tasks)
            .where('status', '==', 'active')
            .onSnapshot(callback);
    }

    listenToUserVerifications(userId, callback) {
        return db.collection(this.collections.verifications)
            .where('userId', '==', userId)
            .onSnapshot(callback);
    }

    listenToUserWithdrawals(userId, callback) {
        return db.collection(this.collections.withdrawals)
            .where('userId', '==', userId)
            .onSnapshot(callback);
    }

    listenToAllVerifications(callback) {
        return db.collection(this.collections.verifications)
            .onSnapshot(callback);
    }

    listenToAllWithdrawals(callback) {
        return db.collection(this.collections.withdrawals)
            .onSnapshot(callback);
    }

    listenToUserNotifications(userId, callback) {
        return db.collection(this.collections.notifications)
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .onSnapshot(callback);
    }



    // Enhanced Task Management

    async updateTask(taskId, taskData) {
        try {
            await db.collection(this.collections.tasks).doc(taskId).update({
                ...taskData,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            await db.collection(this.collections.tasks).doc(taskId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    // Task Submissions Management
    async createTaskSubmission(submissionData) {
        return await window.loadingManager.withDatabaseLoading(async () => {
            // Get user info for email and short ID
            const userDoc = await db.collection('users').doc(submissionData.user_id).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            // Generate short user ID
            const shortUserId = this.generateShortUserId(submissionData.user_id);

            // Generate unique reference number for verification
            const referenceNumber = this.generateUniqueReference('verification');

            const submissionRef = await db.collection(this.collections.taskSubmissions).add({
                task_id: submissionData.task_id,
                taskId: submissionData.task_id, // Also store as taskId for consistency
                user_id: submissionData.user_id,
                userId: submissionData.user_id, // Also store as userId for consistency
                user_email: userData.email || 'Unknown User',
                user_short_id: shortUserId,
                status: submissionData.status || 'pending_review', // Use the status passed in, default to pending_review
                restart_count: submissionData.restart_count || 0,
                referrer_email: submissionData.referrer_email || null,
                proof_image_url: submissionData.proof_image_url || null,
                notes: submissionData.notes || '',
                referenceNumber: referenceNumber,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { id: submissionRef.id, referenceNumber: referenceNumber };
        }, 'Creating Submission', 'Please wait while we create your task submission...');
    }

    async getTaskSubmissions(status = 'all') {
        try {
            let query = db.collection(this.collections.taskSubmissions);

            if (status !== 'all') {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.orderBy('created_at', 'desc').get();
            const submissions = [];

            for (const doc of snapshot.docs) {
                const submission = { id: doc.id, ...doc.data() };

                // Get task details
                console.log('🔍 Fetching task details for submission:', submission.id, 'task_id:', submission.task_id);
                const taskDoc = await db.collection(this.collections.tasks).doc(submission.task_id).get();
                if (taskDoc.exists) {
                    submission.task = { id: taskDoc.id, ...taskDoc.data() };
                    console.log('✅ Task found:', submission.task.title);
                } else {
                    console.log('❌ Task not found for ID:', submission.task_id);
                }

                // Get user details
                const userDoc = await db.collection(this.collections.users).doc(submission.user_id).get();
                if (userDoc.exists) {
                    submission.user = { id: userDoc.id, ...userDoc.data() };
                }

                submissions.push(submission);
            }

            return submissions;
        } catch (error) {
            console.error('Error getting task submissions:', error);
            throw error;
        }
    }

    async updateTaskSubmission(submissionId, updateData) {
        return await window.loadingManager.withDatabaseLoading(async () => {
            const submissionRef = db.collection(this.collections.taskSubmissions).doc(submissionId);
            const submissionDoc = await submissionRef.get();

            if (!submissionDoc.exists) {
                throw new Error('Submission not found');
            }

            // Add timestamp to updates
            updateData.updated_at = firebase.firestore.FieldValue.serverTimestamp();

            await submissionRef.update(updateData);
            return { success: true };
        }, 'Updating Submission', 'Please wait while we update your submission...');
    }

    async updateTaskSubmissionStatus(submissionId, status, adminNotes = '') {
        try {
            const submissionRef = db.collection(this.collections.taskSubmissions).doc(submissionId);
            const submissionDoc = await submissionRef.get();

            if (!submissionDoc.exists) {
                throw new Error('Submission not found');
            }

            const submission = submissionDoc.data();
            const updates = {
                status: status,
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                reviewed_by: auth.currentUser.uid,
                reviewed_at: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (adminNotes) {
                updates.admin_notes = adminNotes;
            }

            // If approved, credit the user's balance
            if (status === 'approved') {
                const taskDoc = await db.collection(this.collections.tasks).doc(submission.task_id).get();
                if (taskDoc.exists) {
                    const task = taskDoc.data();
                    await this.updateWalletBalance(submission.user_id, task.reward, 'task_approved', {
                        taskId: submission.task_id,
                        taskTitle: task.title,
                        submissionId: submissionId,
                        referenceNumber: submission.referenceNumber
                    });

                    // Create notification
                    await this.createNotification(submission.user_id, {
                        type: 'task_approved',
                        title: 'Task Approved!',
                        message: `Your submission for "${task.title}" has been approved. You earned ₱${task.reward}!`,
                        data: { task_id: submission.task_id, reward: task.reward }
                    });
                }
            } else if (status === 'rejected') {
                // Create notification
                const taskDoc = await db.collection(this.collections.tasks).doc(submission.task_id).get();
                if (taskDoc.exists) {
                    const task = taskDoc.data();
                    await this.createNotification(submission.user_id, {
                        type: 'task_rejected',
                        title: 'Task Rejected',
                        message: `Your submission for "${task.title}" was rejected. ${adminNotes || 'Please try again.'}`,
                        data: { task_id: submission.task_id }
                    });
                }
            }

            await submissionRef.update(updates);
            return true;
        } catch (error) {
            console.error('Error updating task submission:', error);
            throw error;
        }
    }

    // Enhanced Withdrawal Management
    async createWithdrawalRequest(withdrawalData) {
        try {
            // Get user info for email and short ID
            const userDoc = await db.collection('users').doc(withdrawalData.user_id).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            // Generate short user ID
            const shortUserId = this.generateShortUserId(withdrawalData.user_id);

            // Generate unique reference number for withdrawal
            const referenceNumber = this.generateUniqueReference('withdrawal');

            const withdrawalRef = await db.collection(this.collections.withdrawals).add({
                user_id: withdrawalData.user_id,
                userId: withdrawalData.user_id, // Also store as userId for consistency
                user_email: userData.email || 'Unknown User',
                user_short_id: shortUserId,
                amount: withdrawalData.amount,
                method: withdrawalData.method,
                account: withdrawalData.account_details, // Store as 'account' for consistency
                account_details: withdrawalData.account_details,
                account_name: withdrawalData.account_name || '',
                status: 'pending',
                referenceNumber: referenceNumber,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { id: withdrawalRef.id, referenceNumber: referenceNumber };
        } catch (error) {
            console.error('Error creating withdrawal request:', error);
            throw error;
        }
    }

    async createWithdrawalRequestWithBalanceDeduction(withdrawalData) {
        try {
            // Get user info for email and short ID
            const userDoc = await db.collection('users').doc(withdrawalData.user_id).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            // Generate short user ID
            const shortUserId = this.generateShortUserId(withdrawalData.user_id);

            // Generate unique reference number for withdrawal
            const referenceNumber = this.generateUniqueReference('withdrawal');

            let withdrawalId;
            let beforeBalance = 0;
            let afterBalance = 0;

            // Use a transaction to ensure both withdrawal creation and balance deduction succeed together
            await db.runTransaction(async (transaction) => {
                // Get user document
                const userRef = db.collection(this.collections.users).doc(withdrawalData.user_id);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw new Error('User does not exist');
                }

                // Check sufficient balance
                beforeBalance = userDoc.data().walletBalance || 0;
                afterBalance = beforeBalance - withdrawalData.amount;

                if (afterBalance < 0) {
                    throw new Error('Insufficient balance');
                }

                // Update user balance
                transaction.update(userRef, { walletBalance: afterBalance });

                // Create withdrawal document
                const withdrawalRef = db.collection(this.collections.withdrawals).doc();
                withdrawalId = withdrawalRef.id;

                transaction.set(withdrawalRef, {
                    user_id: withdrawalData.user_id,
                    userId: withdrawalData.user_id,
                    user_email: userData.email || 'Unknown User',
                    user_short_id: shortUserId,
                    amount: withdrawalData.amount,
                    method: withdrawalData.method,
                    account: withdrawalData.account_details,
                    account_details: withdrawalData.account_details,
                    account_name: withdrawalData.account_name || '',
                    status: 'pending',
                    referenceNumber: referenceNumber,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // Record the balance change in transaction history (outside transaction to avoid conflicts)
            await this.recordBalanceChange(withdrawalData.user_id, {
                beforeBalance,
                afterBalance,
                changeAmount: -withdrawalData.amount,
                reason: 'withdrawal_submitted',
                metadata: {
                    paymentMethod: withdrawalData.method,
                    referenceNumber: referenceNumber,
                    withdrawalAmount: withdrawalData.amount
                },
                timestamp: new Date()
            });

            return { id: withdrawalId, referenceNumber: referenceNumber };
        } catch (error) {
            console.error('Error creating withdrawal request with balance deduction:', error);
            throw error;
        }
    }

    generateShortUserId(userId) {
        if (!userId) return 'Q00000';

        // Generate a short ID based on the Firebase user ID
        // Take first 5 characters and convert to a more readable format
        const shortId = 'Q' + userId.substring(0, 5).toUpperCase();
        return shortId;
    }

    // Unique Reference Generation System
    generateUniqueReference(type) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const prefix = type === 'withdrawal' ? 'QW' : 'QV';
        return `${prefix}${timestamp.slice(-6)}${random}`;
    }

    async getWithdrawals(status = 'all') {
        try {
            let query = db.collection(this.collections.withdrawals);

            if (status !== 'all') {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.orderBy('created_at', 'desc').get();
            const withdrawals = [];

            for (const doc of snapshot.docs) {
                const withdrawal = { id: doc.id, ...doc.data() };

                // Get user details
                const userDoc = await db.collection(this.collections.users).doc(withdrawal.user_id).get();
                if (userDoc.exists) {
                    withdrawal.user = { id: userDoc.id, ...userDoc.data() };
                }

                withdrawals.push(withdrawal);
            }

            return withdrawals;
        } catch (error) {
            console.error('Error getting withdrawals:', error);
            throw error;
        }
    }

    async updateWithdrawalStatus(withdrawalId, status, adminNotes = '') {
        try {
            const withdrawalRef = db.collection(this.collections.withdrawals).doc(withdrawalId);
            const withdrawalDoc = await withdrawalRef.get();

            if (!withdrawalDoc.exists) {
                throw new Error('Withdrawal not found');
            }

            const withdrawal = withdrawalDoc.data();
            const updates = {
                status: status,
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                reviewed_by: auth.currentUser.uid,
                reviewed_at: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (adminNotes) {
                updates.admin_notes = adminNotes;
            }

            // Update the withdrawal document with the new status
            await withdrawalRef.update(updates);

            // If approved, record the approval (balance was already deducted when user submitted)
            if (status === 'approved') {
                // Get current user balance to record the approval event
                const userDoc = await db.collection(this.collections.users).doc(withdrawal.user_id).get();
                const currentBalance = userDoc.exists ? userDoc.data().walletBalance || 0 : 0;

                // Record the approval as a balance change event (no actual balance change)
                await this.recordBalanceChange(withdrawal.user_id, {
                    beforeBalance: currentBalance,
                    afterBalance: currentBalance,
                    changeAmount: 0, // No actual change, just status update
                    reason: 'withdrawal_approved',
                    metadata: {
                        withdrawalId: withdrawalId,
                        paymentMethod: withdrawal.method || withdrawal.payment_method,
                        referenceNumber: withdrawal.referenceNumber || withdrawal.reference_number,
                        withdrawalAmount: withdrawal.amount
                    },
                    timestamp: new Date()
                });

                // Create notification
                await this.createNotification(withdrawal.user_id, {
                    type: 'withdrawal_approved',
                    title: 'Withdrawal Approved!',
                    message: `Your withdrawal of ₱${withdrawal.amount} has been approved and will be processed shortly.`,
                    data: {
                        withdrawal_id: withdrawalId,
                        amount: withdrawal.amount,
                        paymentMethod: withdrawal.method || withdrawal.payment_method,
                        referenceNumber: withdrawal.referenceNumber || withdrawal.reference_number
                    }
                });
            } else if (status === 'rejected') {
                // Check if this withdrawal was created with the new atomic method
                // Only refund if the withdrawal was actually created with balance deduction
                const withdrawalDoc = await db.collection(this.collections.withdrawals).doc(withdrawalId).get();
                const withdrawalData = withdrawalDoc.data();

                // Always refund when rejecting a withdrawal to ensure user gets their money back
                // This handles both old and new withdrawal methods
                console.log('💰 Refunding withdrawal:', {
                    withdrawalId: withdrawalId,
                    userId: withdrawal.user_id,
                    amount: withdrawal.amount,
                    referenceNumber: withdrawal.referenceNumber || withdrawal.reference_number
                });

                // Use updateWalletBalance to both update balance and record the transaction
                await this.updateWalletBalance(withdrawal.user_id, withdrawal.amount, 'withdrawal_rejected_refund', {
                    withdrawalId: withdrawalId,
                    paymentMethod: withdrawal.method || withdrawal.payment_method,
                    referenceNumber: withdrawal.referenceNumber || withdrawal.reference_number,
                    originalWithdrawalAmount: withdrawal.amount
                });

                // Create notification
                await this.createNotification(withdrawal.user_id, {
                    type: 'withdrawal_rejected',
                    title: 'Withdrawal Rejected & Refunded',
                    message: `Your withdrawal of ₱${withdrawal.amount} was rejected. The amount has been refunded to your wallet balance. ${adminNotes || 'Please contact support for more information.'}`,
                    data: { withdrawal_id: withdrawalId, amount: withdrawal.amount, refunded: true }
                });
            }

            await withdrawalRef.update(updates);
            return true;
        } catch (error) {
            console.error('Error updating withdrawal status:', error);
            throw error;
        }
    }

    // Notification Management
    async createNotification(userId, notificationData) {
        try {
            await db.collection(this.collections.notifications).add({
                user_id: userId,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data || {},
                read: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    async getUserNotifications(userId, limit = 50) {
        try {
            const snapshot = await db.collection(this.collections.notifications)
                .where('user_id', '==', userId)
                .orderBy('created_at', 'desc')
                .limit(limit)
                .get();

            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });

            return notifications;
        } catch (error) {
            console.error('Error getting user notifications:', error);
            throw error;
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            await db.collection(this.collections.notifications).doc(notificationId).update({
                read: true,
                read_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    // Enhanced User Balance Management
    async getUserBalance(userId) {
        try {
            const userDoc = await db.collection(this.collections.users).doc(userId).get();
            if (userDoc.exists) {
                return userDoc.data().walletBalance || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting user balance:', error);
            throw error;
        }
    }

    async getUserTaskSubmissions(userId) {
        try {
            const snapshot = await db.collection(this.collections.taskSubmissions)
                .where('user_id', '==', userId)
                .orderBy('created_at', 'desc')
                .get();

            const submissions = [];
            for (const doc of snapshot.docs) {
                const submission = { id: doc.id, ...doc.data() };

                // Get task details
                const taskDoc = await db.collection(this.collections.tasks).doc(submission.task_id).get();
                if (taskDoc.exists) {
                    submission.task = { id: taskDoc.id, ...taskDoc.data() };
                }

                submissions.push(submission);
            }

            return submissions;
        } catch (error) {
            console.error('Error getting user task submissions:', error);
            throw error;
        }
    }

    async deleteTaskSubmission(submissionId) {
        try {
            await db.collection(this.collections.taskSubmissions).doc(submissionId).delete();
            console.log(`✅ Deleted task submission: ${submissionId}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting task submission:', error);
            throw error;
        }
    }

    async deleteVerification(verificationId) {
        try {
            await db.collection(this.collections.verifications).doc(verificationId).delete();
            console.log(`✅ Deleted verification: ${verificationId}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting verification:', error);
            throw error;
        }
    }
}

// Initialize Firestore manager
window.firestoreManager = new FirestoreManager();

