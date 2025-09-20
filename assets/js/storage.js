// ImgBB Storage Manager
class StorageManager {
    constructor() {
        this.imgbbApiKey = window.CONFIG?.IMGBB_API_KEY || 'YOUR_IMGBB_API_KEY';
        this.maxFileSize = window.CONFIG?.MAX_FILE_SIZE || 5 * 1024 * 1024;
        this.allowedTypes = window.CONFIG?.ALLOWED_FILE_TYPES || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    }

    // Validate file before upload
    validateFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`File size must be less than ${this.maxFileSize / (1024 * 1024)}MB`);
        }

        if (!this.allowedTypes.includes(file.type)) {
            throw new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
        }

        return true;
    }

    // Upload image to ImgBB
    async uploadToImgBB(file, filename = null) {
        try {
            this.validateFile(file);

            const formData = new FormData();
            formData.append('image', file);
            if (filename) {
                formData.append('name', filename);
            }

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.imgbbApiKey}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Upload failed');
            }

            return {
                url: result.data.url,
                deleteUrl: result.data.delete_url,
                id: result.data.id
            };
        } catch (error) {
            console.error('Error uploading to ImgBB:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Upload profile screenshot
    async uploadProfileScreenshot(file, userId, taskId) {
        try {
            const filename = `profile_${userId}_${taskId}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading profile screenshot:', error);
            throw error;
        }
    }

    // Upload stage screenshot
    async uploadStageScreenshot(file, userId, taskId) {
        try {
            const filename = `stage_${userId}_${taskId}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading stage screenshot:', error);
            throw error;
        }
    }

    // Upload task banner image
    async uploadTaskBanner(file, taskId) {
        try {
            const filename = `banner_${taskId}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading task banner:', error);
            throw error;
        }
    }

    // Upload verification image
    async uploadVerificationImage(file, userId, taskId, phase) {
        try {
            const filename = `verification_${phase}_${userId}_${taskId}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading verification image:', error);
            throw error;
        }
    }

    // Upload proof image
    async uploadProofImage(file, userId, taskId) {
        try {
            const filename = `proof_${userId}_${taskId}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading proof image:', error);
            throw error;
        }
    }

    // Generic file upload
    async uploadFile(file, path) {
        try {
            const filename = `file_${path.replace(/\//g, '_')}_${Date.now()}`;
            const result = await this.uploadToImgBB(file, filename);
            return result.url;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Delete file (ImgBB doesn't support deletion via API)
    async deleteFile(filePath) {
        console.warn('ImgBB does not support file deletion via API');
        return true;
    }

    // Get file URL (same as upload result)
    getFileUrl(filePath) {
        return filePath; // ImgBB URLs are already public
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
