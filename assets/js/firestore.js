// Firestore Database Module
class FirestoreManager {
    constructor() {
        this.collections = {
            users: 'users',
            tasks: 'tasks',
            verifications: 'verifications',
            withdrawals: 'withdrawals',
            taskStatuses: 'taskStatuses'
        };
    }

    // User Management
    async createUser(userData) {
        try {
            await db.collection(this.collections.users).doc(userData.uid).set({
                email: userData.email,
                walletBalance: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            });
            return true;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
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

    async updateWalletBalance(uid, amount) {
        try {
            const userRef = db.collection(this.collections.users).doc(uid);
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('User does not exist');
                }

                const currentBalance = userDoc.data().walletBalance || 0;
                const newBalance = currentBalance + amount;

                transaction.update(userRef, { walletBalance: newBalance });
            });
            return true;
        } catch (error) {
            console.error('Error updating wallet balance:', error);
            throw error;
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
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
        try {
            const snapshot = await db.collection(this.collections.tasks)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting tasks:', error);
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
            // First check for custom task status (DNS setup, Immutable link, etc.)
            const taskStatusDoc = await db.collection(this.collections.taskStatuses)
                .doc(`${userId}_${taskId}`)
                .get();

            if (taskStatusDoc.exists) {
                const taskStatus = taskStatusDoc.data();
                console.log('🔍 Found task status document:', {
                    userId: userId,
                    taskId: taskId,
                    status: taskStatus.status,
                    phase: taskStatus.phase,
                    immutableLinkApproved: taskStatus.immutableLinkApproved
                });
                return {
                    status: taskStatus.status,
                    phase: taskStatus.phase || null,
                    verificationId: taskStatus.verificationId || null,
                    immutableLinkApproved: taskStatus.immutableLinkApproved || false,
                    immutableLink: taskStatus.immutableLink || null,
                    approvedAt: taskStatus.approvedAt || null,
                    approvedBy: taskStatus.approvedBy || null,
                    rejectedAt: taskStatus.rejectedAt || null,
                    rejectedBy: taskStatus.rejectedBy || null
                };
            } else {
                console.log('❌ No task status document found for:', `${userId}_${taskId}`);
                // For new users with no task status document, return available status
                // Don't fall back to verification logic to avoid status changes
                return { status: 'available', phase: null };
            }

            const verifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Check for final verification approval
            const finalVerification = verifications.find(v => v.phase === 'final' && v.status === 'approved');
            if (finalVerification) {
                return { status: 'complete', phase: 'final', verificationId: finalVerification.id };
            }

            // Check for final verification pending
            const pendingFinal = verifications.find(v => v.phase === 'final' && v.status === 'pending');
            if (pendingFinal) {
                return { status: 'pending', phase: 'final', verificationId: pendingFinal.id };
            }

            // Check for initial verification approval
            const approvedInitial = verifications.find(v => v.phase === 'initial' && v.status === 'approved');
            if (approvedInitial) {
                return { status: 'unlocked', phase: 'initial', verificationId: approvedInitial.id };
            }

            // Check for initial verification pending
            const pendingInitial = verifications.find(v => v.phase === 'initial' && v.status === 'pending');
            if (pendingInitial) {
                return { status: 'pending', phase: 'initial', verificationId: pendingInitial.id };
            }

            // Check for initial verification rejection - allow resubmission
            const rejectedInitial = verifications.find(v => v.phase === 'initial' && v.status === 'rejected');
            if (rejectedInitial) {
                return { status: 'rejected', phase: 'initial', verificationId: rejectedInitial.id };
            }

            return { status: 'locked', phase: null };
        } catch (error) {
            console.error('Error getting task status for user:', error);
            return { status: 'locked', phase: null };
        }
    }

    async updateTaskStatus(taskId, status, userId = null) {
        try {
            // Use provided userId or fallback to current user
            const targetUserId = userId || auth.currentUser.uid;

            // Check if this is the first time the user is starting the task
            const existingStatus = await db.collection(this.collections.taskStatuses).doc(`${targetUserId}_${taskId}`).get();
            const isStartingTask = !existingStatus.exists && (status === 'pending' || status === 'dns_setup');
            const isCompletingTask = status === 'complete' || status === 'completed';

            const statusData = {
                userId: targetUserId,
                taskId,
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Set startedAt timestamp when user starts the task
            if (isStartingTask) {
                statusData.startedAt = firebase.firestore.FieldValue.serverTimestamp();
                console.log(`🚀 Task started at: ${new Date().toISOString()} for user: ${targetUserId}, task: ${taskId}`);
            }

            // Clear startedAt when task is completed (for restart functionality)
            if (isCompletingTask) {
                statusData.startedAt = null;
                console.log(`✅ Task completed, cleared start time for user: ${targetUserId}, task: ${taskId}`);
            }

            console.log('🔍 Updating task status:', {
                userId: targetUserId,
                taskId: taskId,
                status: status,
                statusData: statusData
            });
            await db.collection(this.collections.taskStatuses).doc(`${targetUserId}_${taskId}`).set(statusData, { merge: true });
            console.log('✅ Task status document updated successfully');

            console.log(`Task status updated: ${taskId} -> ${status} for user: ${targetUserId}`);
        } catch (error) {
            console.error('Error updating task status:', error);
            throw error;
        }
    }

    async storeImmutableLink(taskId, immutableLink) {
        try {
            const userId = auth.currentUser.uid;

            await db.collection(this.collections.taskStatuses).doc(`${userId}_${taskId}`).set({
                userId,
                taskId,
                immutableLink,
                status: 'pending_immutable_review', // Set to pending until admin approval
                immutableLinkApproved: false, // Explicitly set to false for admin review
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Immutable link stored for task: ${taskId} - awaiting admin review`);
        } catch (error) {
            console.error('Error storing Immutable link:', error);
            throw error;
        }
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

    async getAllImmutableLinks() {
        try {
            // Get all task statuses and filter for those with immutable links
            const snapshot = await db.collection(this.collections.taskStatuses)
                .orderBy('updatedAt', 'desc')
                .get();

            const links = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();

                // Filter for documents that have immutable links
                if (data.immutableLink) {
                    // Get task and user details
                    const task = await this.getTask(data.taskId);
                    const user = await this.getUser(data.userId);

                    if (task && user) {
                        links.push({
                            id: doc.id,
                            ...data,
                            task: task,
                            user: user
                        });
                    }
                }
            }

            return links;
        } catch (error) {
            console.error('Error getting all immutable links:', error);
            throw error;
        }
    }

    async getUserCompletionStats(userId) {
        try {
            // Get all quest completions for the user from questCompletions collection
            const snapshot = await db.collection('questCompletions')
                .where('userId', '==', userId)
                .get();

            const completions = snapshot.docs.map(doc => doc.data());

            // Calculate total completions
            const totalCompletions = completions.length;

            // Calculate total rewards earned
            let totalRewardsEarned = 0;
            for (const completion of completions) {
                if (completion.reward) {
                    totalRewardsEarned += parseFloat(completion.reward) || 0;
                }
            }

            console.log(`User ${userId} completion stats: ${totalCompletions} completions, ₱${totalRewardsEarned} earned`);
            return {
                totalCompletions,
                totalRewardsEarned
            };
        } catch (error) {
            console.error('Error getting user completion stats:', error);
            throw error;
        }
    }

    async getUserQuestCompletionCount(userId, taskId) {
        try {
            // Count completions from the questCompletions collection (same as admin)
            const snapshot = await db.collection('questCompletions')
                .where('userId', '==', userId)
                .where('taskId', '==', taskId)
                .get();

            return snapshot.docs.length;
        } catch (error) {
            console.error('Error getting user quest completion count:', error);
            return 0; // Return 0 on error to prevent blocking the UI
        }
    }

    async getAllQuestCompletions() {
        try {
            // Get all quest completions from the questCompletions collection
            const snapshot = await db.collection('questCompletions')
                .orderBy('completedAt', 'desc')
                .get();

            const completions = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                // Get task and user details
                const task = await this.getTask(data.taskId);
                const user = await this.getUser(data.userId);

                if (task && user) {
                    completions.push({
                        id: doc.id,
                        ...data,
                        task: task,
                        user: user
                    });
                }
            }

            console.log('Found quest completions:', completions.length);
            return completions;
        } catch (error) {
            console.error('Error getting all quest completions:', error);
            throw error;
        }
    }

    async getTasksWithCompletionLimits() {
        try {
            // Get all active tasks (not just those with completion limits set)
            const snapshot = await db.collection(this.collections.tasks)
                .where('status', '==', 'active')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting tasks with completion limits:', error);
            throw error;
        }
    }

    async deleteVerification(verificationId) {
        try {
            await db.collection(this.collections.verifications).doc(verificationId).delete();
            console.log('Verification deleted:', verificationId);
        } catch (error) {
            console.error('Error deleting verification:', error);
            throw error;
        }
    }

    async approveImmutableLink(userId, taskId) {
        try {
            // Find the task status with immutable link for this user and task
            const taskStatusDoc = await db.collection(this.collections.taskStatuses)
                .doc(`${userId}_${taskId}`)
                .get();

            if (!taskStatusDoc.exists) {
                throw new Error('No task status found for this user and task');
            }

            const taskStatusData = taskStatusDoc.data();

            // Check if it has an immutable link
            if (!taskStatusData.immutableLink) {
                throw new Error('No immutable link found for this user and task');
            }

            // Update the task status to ready for phase 2 after admin approval
            await taskStatusDoc.ref.update({
                status: 'ready_for_phase2',
                phase: 'immutable_link',
                immutableLinkApproved: true,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: auth.currentUser.uid
            });

            console.log('Immutable link approved for user:', userId, 'task:', taskId);
        } catch (error) {
            console.error('Error approving immutable link:', error);
            throw error;
        }
    }

    async rejectImmutableLink(userId, taskId, reason) {
        try {
            // Find the task status with immutable link for this user and task
            const taskStatusDoc = await db.collection(this.collections.taskStatuses)
                .doc(`${userId}_${taskId}`)
                .get();

            if (!taskStatusDoc.exists) {
                throw new Error('No task status found for this user and task');
            }

            const taskStatusData = taskStatusDoc.data();

            // Check if it has an immutable link
            if (!taskStatusData.immutableLink) {
                throw new Error('No immutable link found for this user and task');
            }

            // Update the task status to rejected
            await taskStatusDoc.ref.update({
                status: 'rejected',
                phase: 'immutable_link',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectedBy: auth.currentUser.uid,
                rejectionReason: reason
            });

            console.log('Immutable link rejected for user:', userId, 'task:', taskId, 'reason:', reason);
        } catch (error) {
            console.error('Error rejecting immutable link:', error);
            throw error;
        }
    }

    async recordQuestCompletion(userId, taskId, completionData) {
        try {
            // Record the quest completion in a separate collection for analytics
            await db.collection('questCompletions').add({
                userId,
                taskId,
                ...completionData,
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedBy: auth.currentUser.uid
            });

            console.log('Quest completion recorded for user:', userId, 'task:', taskId);
        } catch (error) {
            console.error('Error recording quest completion:', error);
            throw error;
        }
    }

    async getQuestCompletionCount(taskId) {
        try {
            // Count completions from the questCompletions collection
            const snapshot = await db.collection('questCompletions')
                .where('taskId', '==', taskId)
                .get();

            return snapshot.docs.length;
        } catch (error) {
            console.error('Error getting quest completion count:', error);
            return 0;
        }
    }

    async resetImmutableLinkApproval(userId, taskId) {
        try {
            // Reset the immutable link approval status for testing
            const taskStatusDoc = await db.collection(this.collections.taskStatuses)
                .doc(`${userId}_${taskId}`)
                .get();

            if (taskStatusDoc.exists) {
                await taskStatusDoc.ref.update({
                    immutableLinkApproved: false,
                    status: 'ready_for_phase2',
                    phase: 'immutable_link'
                });
                console.log('Immutable link approval reset for user:', userId, 'task:', taskId);
            }
        } catch (error) {
            console.error('Error resetting immutable link approval:', error);
            throw error;
        }
    }

    async resetAllImmutableLinkApprovals() {
        try {
            // Reset all immutable link approvals to pending for testing
            const snapshot = await db.collection(this.collections.taskStatuses)
                .where('immutableLink', '!=', null)
                .get();

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    immutableLinkApproved: false,
                    status: 'ready_for_phase2',
                    phase: 'immutable_link'
                });
            });

            await batch.commit();
            console.log(`Reset ${snapshot.docs.length} immutable link approvals to pending`);
        } catch (error) {
            console.error('Error resetting all immutable link approvals:', error);
            throw error;
        }
    }

    async updateTaskMaxCompletions(taskId, maxCompletions) {
        try {
            await db.collection(this.collections.tasks).doc(taskId).update({
                maxCompletions: maxCompletions,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Task ${taskId} max completions updated to ${maxCompletions}`);
        } catch (error) {
            console.error('Error updating task max completions:', error);
            throw error;
        }
    }
}

// Initialize Firestore manager
window.firestoreManager = new FirestoreManager();
