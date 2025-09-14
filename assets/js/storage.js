// Firebase Storage Module (Legacy - now using Supabase)
class StorageManager {
    constructor() {
        // This is now a legacy class - Supabase is used instead
        console.log('StorageManager initialized (legacy mode - using Supabase)');
    }

    // Upload profile screenshot (redirects to Supabase)
    async uploadProfileScreenshot(file, userId, taskId) {
        try {
            // Redirect to Supabase Storage Manager
            if (window.supabaseStorageManager) {
                return await window.supabaseStorageManager.uploadProfileScreenshot(file, userId, taskId);
            } else {
                throw new Error('Supabase Storage Manager not available');
            }
        } catch (error) {
            console.error('Error uploading profile screenshot:', error);
            throw error;
        }
    }

    // Upload stage screenshot (redirects to Supabase)
    async uploadStageScreenshot(file, userId, taskId) {
        try {
            if (window.supabaseStorageManager) {
                return await window.supabaseStorageManager.uploadStageScreenshot(file, userId, taskId);
            } else {
                throw new Error('Supabase Storage Manager not available');
            }
        } catch (error) {
            console.error('Error uploading stage screenshot:', error);
            throw error;
        }
    }

    // Upload task banner image (redirects to Supabase)
    async uploadTaskBanner(file, taskId) {
        try {
            if (window.supabaseStorageManager) {
                return await window.supabaseStorageManager.uploadTaskBanner(file, taskId);
            } else {
                throw new Error('Supabase Storage Manager not available');
            }
        } catch (error) {
            console.error('Error uploading task banner:', error);
            throw error;
        }
    }

    // Generic file upload (redirects to Supabase)
    async uploadFile(file, path) {
        try {
            if (window.supabaseStorageManager) {
                // Extract components from path for Supabase
                const pathParts = path.split('/');
                if (pathParts.length >= 3) {
                    const phase = pathParts[1]; // e.g., 'verifications'
                    const userId = pathParts[2]; // user ID
                    const taskId = pathParts[3]; // task ID
                    return await window.supabaseStorageManager.uploadVerificationImage(file, userId, taskId, phase);
                } else {
                    throw new Error('Invalid file path format');
                }
            } else {
                throw new Error('Supabase Storage Manager not available');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Delete file (redirects to Supabase)
    async deleteFile(filePath) {
        try {
            if (window.supabaseStorageManager) {
                return await window.supabaseStorageManager.deleteFile(filePath);
            } else {
                throw new Error('Supabase Storage Manager not available');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }

    // Validate file type and size
    validateImageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid image file (JPEG, PNG, or WebP)');
        }

        if (file.size > maxSize) {
            throw new Error('File size must be less than 5MB');
        }

        return true;
    }

    // Create file preview
    createImagePreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Get file size in human readable format
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Compress image before upload
    async compressImage(file, maxWidth = 1920, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, file.type, quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }
}

// Initialize Storage manager
window.storageManager = new StorageManager();
