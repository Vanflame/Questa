// Debug Script - Run this in browser console to check what's happening

console.log('🔍 TaskEarn Debug Script');
console.log('========================');

// Check if all modules are loaded
console.log('📦 Module Status:');
console.log('- Firebase:', typeof firebase !== 'undefined' ? '✅' : '❌');
console.log('- Auth:', typeof window.auth !== 'undefined' ? '✅' : '❌');
console.log('- Firestore:', typeof window.db !== 'undefined' ? '✅' : '❌');
console.log('- AuthManager:', typeof window.authManager !== 'undefined' ? '✅' : '❌');
console.log('- App:', typeof window.app !== 'undefined' ? '✅' : '❌');
console.log('- FirestoreManager:', typeof window.firestoreManager !== 'undefined' ? '✅' : '❌');
console.log('- AdminManager:', typeof window.adminManager !== 'undefined' ? '✅' : '❌');
console.log('- AppInitializer:', typeof window.appInitializer !== 'undefined' ? '✅' : '❌');

// Check current user
const user = firebase.auth().currentUser;
console.log('\n👤 Current User:', user ? user.email : 'Not logged in');

// Check dashboard visibility
console.log('\n📱 Dashboard Status:');
const loginPage = document.getElementById('login-page');
const dashboard = document.getElementById('dashboard');
const adminPanel = document.getElementById('admin-panel');

console.log('- Login Page:', loginPage?.classList.contains('hidden') ? 'Hidden ✅' : 'Visible ❌');
console.log('- Dashboard:', dashboard?.classList.contains('hidden') ? 'Hidden ❌' : 'Visible ✅');
console.log('- Admin Panel:', adminPanel?.classList.contains('hidden') ? 'Hidden ✅' : 'Visible ❌');

// Check active tab
const activeTab = document.querySelector('.tab-btn.active');
console.log('- Active Tab:', activeTab ? activeTab.getAttribute('data-tab') : 'None');

// Check tasks grid
const tasksGrid = document.getElementById('tasks-grid');
console.log('- Tasks Grid:', tasksGrid ? 'Found ✅' : 'Not found ❌');
console.log('- Tasks Grid Content:', tasksGrid ? tasksGrid.innerHTML.substring(0, 100) + '...' : 'N/A');

// Test Firestore connection
async function testFirestore() {
    try {
        console.log('\n🔥 Testing Firestore...');
        const tasks = await window.firestoreManager.getTasks();
        console.log('✅ Firestore working! Tasks found:', tasks.length);
        return tasks;
    } catch (error) {
        console.log('❌ Firestore error:', error.message);
        return null;
    }
}

// Auto-run test
testFirestore();

// Export functions for manual testing
window.debugApp = {
    testFirestore,
    checkElements: () => {
        console.log('🔍 Checking all dashboard elements...');

        const elements = [
            'login-page',
            'dashboard',
            'admin-panel',
            'profile-tab',
            'tasks-tab',
            'wallet-tab',
            'activity-tab',
            'tasks-grid',
            'user-email',
            'wallet-balance'
        ];

        elements.forEach(id => {
            const el = document.getElementById(id);
            console.log(`${id}:`, el ? 'Found ✅' : 'Missing ❌', el ? `(hidden: ${el.classList.contains('hidden')})` : '');
        });
    },
    showDashboard: () => {
        console.log('🔄 Showing dashboard...');

        const loginPage = document.getElementById('login-page');
        const dashboard = document.getElementById('dashboard');
        const adminPanel = document.getElementById('admin-panel');

        console.log('Elements found:', {
            loginPage: !!loginPage,
            dashboard: !!dashboard,
            adminPanel: !!adminPanel
        });

        if (loginPage) loginPage.classList.add('hidden');
        if (dashboard) dashboard.classList.remove('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');

        console.log('Dashboard visibility:', {
            loginHidden: loginPage?.classList.contains('hidden'),
            dashboardVisible: !dashboard?.classList.contains('hidden'),
            adminHidden: adminPanel?.classList.contains('hidden')
        });

        // Force show profile tab content
        const profileTab = document.getElementById('profile-tab');
        if (profileTab) {
            profileTab.classList.remove('hidden');
            console.log('Profile tab shown');
        }

        console.log('✅ Dashboard shown');
    },
    forceShowDashboard: () => {
        console.log('🚀 Force showing dashboard...');

        // Force show dashboard regardless of auth state
        const loginPage = document.getElementById('login-page');
        const dashboard = document.getElementById('dashboard');
        const adminPanel = document.getElementById('admin-panel');

        if (loginPage) {
            loginPage.style.display = 'none';
            loginPage.classList.add('hidden');
            console.log('Login page hidden');
        }

        if (dashboard) {
            dashboard.style.display = 'block';
            dashboard.classList.remove('hidden');
            dashboard.style.visibility = 'visible';
            dashboard.style.opacity = '1';
            console.log('Dashboard shown');
        }

        if (adminPanel) {
            adminPanel.style.display = 'none';
            adminPanel.classList.add('hidden');
            console.log('Admin panel hidden');
        }

        // Show profile tab
        const profileTab = document.getElementById('profile-tab');
        if (profileTab) {
            profileTab.classList.remove('hidden');
            profileTab.style.display = 'block';
            console.log('Profile tab shown');
        }

        // Show all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id === 'profile-tab') {
                tab.classList.remove('hidden');
                tab.style.display = 'block';
            } else {
                tab.classList.add('hidden');
                tab.style.display = 'none';
            }
        });

        console.log('✅ Dashboard force shown with inline styles');
    },
    switchToTasks: () => {
        if (window.app) {
            window.app.switchTab('tasks');
            console.log('Switched to tasks tab');
        } else {
            console.log('App not available');
        }
    },
    addSampleTasks: () => {
        if (typeof addSampleTasks === 'function') {
            addSampleTasks();
        } else {
            console.log('addSampleTasks function not available');
        }
    },
    forceInit: () => {
        console.log('🚀 Force initializing app...');
        if (window.appInitializer) {
            window.appInitializer.forceDashboardDisplay();
        } else {
            console.log('AppInitializer not available');
        }
    },
    checkInitStatus: () => {
        console.log('🔍 Checking initialization status...');
        if (window.appInitializer) {
            console.log('Module status:', window.appInitializer.modules);
        } else {
            console.log('AppInitializer not available');
        }
    }
};

console.log('\n🛠️ Available debug commands:');
console.log('- debugApp.checkElements() - Check if all elements exist');
console.log('- debugApp.testFirestore() - Test Firestore connection');
console.log('- debugApp.forceShowDashboard() - Force show dashboard (bypass auth)');
console.log('- debugApp.showDashboard() - Show dashboard via normal flow');
console.log('- debugApp.switchToTasks() - Switch to tasks tab');
console.log('- debugApp.addSampleTasks() - Add sample tasks');
console.log('- debugApp.forceInit() - Force initialize app and show dashboard');
console.log('- debugApp.checkInitStatus() - Check initialization status');
