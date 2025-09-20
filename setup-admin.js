// Setup Admin User Script
// Run this in the browser console to make a user an admin

// Replace 'user@gmail.com' with the email of the user you want to make admin
const userEmail = 'user@gmail.com';

// Function to make a user an admin
async function makeUserAdmin(email) {
    try {
        console.log('🔍 Looking for user with email:', email);

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        let targetUser = null;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email === email) {
                targetUser = { id: doc.id, ...userData };
            }
        });

        if (!targetUser) {
            console.error('❌ User not found with email:', email);
            return;
        }

        console.log('👤 Found user:', targetUser);

        // Update user to be admin
        await db.collection('users').doc(targetUser.id).update({
            isAdmin: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ User is now an admin!');
        console.log('🔄 Please refresh the page and try logging in again.');

    } catch (error) {
        console.error('❌ Error making user admin:', error);
    }
}

// Run the function
makeUserAdmin(userEmail);
