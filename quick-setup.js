// Quick Setup Script - Run this in browser console after login
// This will add sample tasks and create an admin user

console.log('🚀 Quick Setup for TaskEarn');
console.log('Run these commands in your browser console:');

console.log(`
// 1. Add sample tasks
addSampleTasks();

// 2. Create admin user (optional)
createSampleAdminUser();

// 3. Refresh the page to see changes
location.reload();
`);

// Auto-run setup if functions are available
if (typeof addSampleTasks === 'function') {
    console.log('✅ Sample data functions are available');
    console.log('Run: addSampleTasks() to add sample tasks');
} else {
    console.log('❌ Sample data functions not loaded yet');
}
