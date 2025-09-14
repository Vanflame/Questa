// Sample Data for Testing
// This file contains sample data that can be used to populate the database for testing

const sampleTasks = [
    {
        title: "Battle of Soul Stage 0-18",
        reward: 50,
        banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=200&fit=crop",
        description: "Complete stages 0-18 in Battle of Soul mobile game",
        status: "active"
    },
    {
        title: "Rise of Kingdoms Castle Upgrade",
        reward: 75,
        banner: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=200&fit=crop",
        description: "Upgrade your castle to level 15 in Rise of Kingdoms",
        status: "active"
    },
    {
        title: "Clash of Clans Town Hall",
        reward: 100,
        banner: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=200&fit=crop",
        description: "Reach Town Hall level 10 in Clash of Clans",
        status: "active"
    },
    {
        title: "PUBG Mobile Achievement",
        reward: 60,
        banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=200&fit=crop",
        description: "Achieve 5 chicken dinners in PUBG Mobile",
        status: "active"
    },
    {
        title: "Mobile Legends Rank",
        reward: 80,
        banner: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=200&fit=crop",
        description: "Reach Epic rank in Mobile Legends",
        status: "active"
    }
];

// Function to add sample tasks to Firestore
async function addSampleTasks() {
    if (!window.firestoreManager) {
        console.error('Firestore manager not available');
        return;
    }

    try {
        console.log('Adding sample tasks...');

        for (const task of sampleTasks) {
            await window.firestoreManager.createTask(task);
            console.log(`Added task: ${task.title}`);
        }

        console.log('All sample tasks added successfully!');
        alert('Sample tasks added successfully!');
    } catch (error) {
        console.error('Error adding sample tasks:', error);
        alert('Error adding sample tasks: ' + error.message);
    }
}

// Function to create sample admin user
async function createSampleAdminUser() {
    if (!window.auth || !window.firestoreManager) {
        console.error('Auth or Firestore manager not available');
        return;
    }

    try {
        const email = 'admin@taskearn.com';
        const password = 'admin123456';

        // Create user with email/password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);

        // Set admin status
        await window.firestoreManager.updateUser(userCredential.user.uid, {
            isAdmin: true,
            walletBalance: 0
        });

        console.log('Sample admin user created:', email);
        alert('Sample admin user created: ' + email + ' (password: ' + password + ')');
    } catch (error) {
        console.error('Error creating admin user:', error);
        alert('Error creating admin user: ' + error.message);
    }
}

// Function to reset database (use with caution!)
async function resetDatabase() {
    if (!confirm('Are you sure you want to reset the database? This will delete ALL data!')) {
        return;
    }

    try {
        // Note: This is a simplified reset - in production, you'd want more sophisticated cleanup
        console.log('Database reset functionality would go here');
        alert('Database reset not implemented for safety. Manually clear collections in Firebase Console if needed.');
    } catch (error) {
        console.error('Error resetting database:', error);
        alert('Error resetting database: ' + error.message);
    }
}

// Add functions to window for console access
window.addSampleTasks = addSampleTasks;
window.createSampleAdminUser = createSampleAdminUser;
window.resetDatabase = resetDatabase;

console.log('Sample data functions loaded. Available functions:');
console.log('- addSampleTasks() - Add sample tasks to database');
console.log('- createSampleAdminUser() - Create a sample admin user');
console.log('- resetDatabase() - Reset database (use with caution)');
