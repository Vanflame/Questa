// Supabase Storage Manager
class SupabaseStorageManager {
    constructor() {
        this.client = window.supabaseClient;
        this.bucket = 'task-images';
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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

    // Upload profile screenshot
    async uploadProfileScreenshot(file, userId, taskId) {
        try {
            this.validateFile(file);

            const fileName = `profiles/${userId}/${taskId}/${Date.now()}_${file.name}`;

            const { data, error } = await this.client.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.client.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading profile screenshot:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Upload stage screenshot
    async uploadStageScreenshot(file, userId, taskId) {
        try {
            this.validateFile(file);

            const fileName = `stages/${userId}/${taskId}/${Date.now()}_${file.name}`;

            const { data, error } = await this.client.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.client.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading stage screenshot:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Upload task banner image
    async uploadTaskBanner(file, taskId) {
        try {
            this.validateFile(file);

            const fileName = `banners/${taskId}/${Date.now()}_${file.name}`;

            const { data, error } = await this.client.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.client.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading task banner:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Upload verification image
    async uploadVerificationImage(file, userId, taskId, phase) {
        try {
            this.validateFile(file);

            const fileName = `verifications/${phase}/${userId}/${taskId}/${Date.now()}_${file.name}`;

            const { data, error } = await this.client.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                // Check if it's an RLS policy error
                if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
                    console.error('Supabase RLS Policy Error:', error);
                    console.error('🔧 QUICK FIX: Go to Supabase Dashboard → Storage → Policies');
                    console.error('🔧 Run this SQL command:');
                    console.error(`
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'task-images');
                    `);
                    throw new Error('Storage access denied. Please check Supabase RLS policies. See console for fix instructions.');
                }
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.client.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading verification image:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Upload proof image
    async uploadProofImage(file, userId, taskId) {
        try {
            this.validateFile(file);

            const fileName = `proofs/${userId}/${taskId}/${Date.now()}_${file.name}`;

            const { data, error } = await this.client.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                // Check if it's an RLS policy error
                if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
                    console.error('Supabase RLS Policy Error:', error);
                    console.error('🔧 QUICK FIX: Go to Supabase Dashboard → Storage → Policies');
                    console.error('🔧 Run this SQL command:');
                    console.error(`
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'task-images');
                    `);
                    throw new Error('Storage access denied. Please check Supabase RLS policies. See console for fix instructions.');
                }
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.client.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading proof image:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Delete file
    async deleteFile(filePath) {
        try {
            const { error } = await this.client.storage
                .from(this.bucket)
                .remove([filePath]);

            if (error) {
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    // Get file URL
    getFileUrl(filePath) {
        const { data } = this.client.storage
            .from(this.bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    // Create storage bucket (run once)
    async createBucket() {
        try {
            const { data, error } = await this.client.storage.createBucket(this.bucket, {
                public: true,
                allowedMimeTypes: this.allowedTypes,
                fileSizeLimit: this.maxFileSize
            });

            if (error) {
                throw error;
            }

            console.log('Storage bucket created successfully');
            return data;
        } catch (error) {
            console.error('Error creating bucket:', error);
            throw error;
        }
    }
}

// Create and export instance
const supabaseStorageManager = new SupabaseStorageManager();
window.supabaseStorageManager = supabaseStorageManager;
