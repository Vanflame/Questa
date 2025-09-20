// Debug Admin Panel Script
// Run this in the browser console on the admin page

console.log('🔧 Debug Admin Panel Script');

// Check if required objects exist
console.log('Firebase:', typeof firebase);
console.log('Auth:', typeof auth);
console.log('DB:', typeof db);
console.log('AuthManager:', typeof window.authManager);
console.log('FirestoreManager:', typeof window.firestoreManager);
console.log('AdminHandler:', typeof window.adminHandler);

// Test firestore manager methods
if (window.firestoreManager) {
    console.log('✅ FirestoreManager available');

    // Test getting users
    window.firestoreManager.getAllUsers().then(users => {
        console.log('👥 Users:', users.length, users);
    }).catch(err => {
        console.error('❌ Error getting users:', err);
    });

    // Test getting tasks
    window.firestoreManager.getTasks().then(tasks => {
        console.log('📋 Tasks:', tasks.length, tasks);
    }).catch(err => {
        console.error('❌ Error getting tasks:', err);
    });

    // Test getting submissions
    window.firestoreManager.getTaskSubmissions('all').then(submissions => {
        console.log('📝 Submissions:', submissions.length, submissions);
    }).catch(err => {
        console.error('❌ Error getting submissions:', err);
    });

    // Test getting withdrawals
    window.firestoreManager.getWithdrawals('all').then(withdrawals => {
        console.log('💰 Withdrawals:', withdrawals.length, withdrawals);
    }).catch(err => {
        console.error('❌ Error getting withdrawals:', err);
    });
} else {
    console.error('❌ FirestoreManager not available');
}

// Test admin handler
if (window.adminHandler) {
    console.log('✅ AdminHandler available');
    console.log('Admin status:', window.adminHandler.isAdmin);
    console.log('Current user:', window.adminHandler.currentUser);
} else {
    console.error('❌ AdminHandler not available');
}

// Test DOM elements
console.log('Recent activity container:', document.getElementById('recent-activity-list'));
console.log('Stats elements:', {
    totalUsers: document.getElementById('total-users'),
    totalTasks: document.getElementById('total-tasks'),
    pendingVerifications: document.getElementById('pending-verifications'),
    pendingWithdrawals: document.getElementById('pending-withdrawals')
});

// Manual test of recent activity
function testRecentActivity() {
    const container = document.getElementById('recent-activity-list');
    if (container) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #f8f9fa; border-radius: 8px;">
                <h4>Test Recent Activity</h4>
                <p>This is a test of the recent activity display.</p>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <li>User: test@example.com submitted Task 1</li>
                    <li>User: admin@example.com submitted Task 2</li>
                    <li>User: user@example.com requested withdrawal of ₱100</li>
                </ul>
            </div>
        `;
        console.log('✅ Test recent activity loaded');
    } else {
        console.error('❌ Recent activity container not found');
    }
}

// Run test
testRecentActivity();
