// Configuration file for Questa
const CONFIG = {
    // ImgBB API Configuration
    IMGBB_API_KEY: '91726602702d354fdcb1391b4f866772', // Replace with your actual ImgBB API key

    // App Configuration
    APP_NAME: 'Questa',
    APP_VERSION: '2.0.0',

    // Task Configuration
    DEFAULT_MAX_RESTARTS: 3,
    DEFAULT_REWARD: 0,

    // Withdrawal Configuration
    WITHDRAWAL_COOLDOWN: 300, // 5 minutes in seconds
    MAX_WITHDRAWAL_AMOUNT: 10000, // Maximum withdrawal amount in PHP

    // File Upload Configuration
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

    // UI Configuration
    TOAST_DURATION: 5000, // 5 seconds
    LOADING_TIMEOUT: 30000, // 30 seconds
};

// Make config available globally
window.CONFIG = CONFIG;
