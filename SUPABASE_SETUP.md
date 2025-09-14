# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Sign up/Login with your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `questa-storage` (or any name you prefer)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
6. Click "Create new project"

## Step 2: Get Project Credentials

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Configure Your App

1. Open `supabase-config.js`
2. Replace the placeholder values:

```javascript
const supabaseConfig = {
    url: 'https://your-project.supabase.co', // Your Project URL
    anonKey: 'eyJ...' // Your anon public key
};
```

## Step 4: Create Storage Bucket

1. In Supabase Dashboard, go to **Storage**
2. Click "Create bucket"
3. Enter bucket name: `task-images`
4. Make it **Public**
5. Click "Create bucket"

## Step 5: Set Storage Policies

1. Go to **Storage** → **Policies**
2. Click "New Policy" for the `task-images` bucket
3. Add these policies:

### Policy 1: Allow Uploads
```sql
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images');
```

### Policy 2: Allow Public Access
```sql
CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'task-images');
```

## Step 6: Test Upload

1. Start your local server: `python -m http.server 8000`
2. Go to your dashboard
3. Try uploading an image
4. Check Supabase Storage to see if the file appears

## Supabase Free Tier Limits

- **Storage**: 1 GB
- **Bandwidth**: 2 GB/month
- **File size limit**: 50 MB per file
- **API requests**: 50,000/month

## Troubleshooting

### Upload Fails
- Check browser console for errors
- Verify Supabase credentials are correct
- Ensure storage bucket exists and is public
- Check file size (must be < 5MB)

### CORS Issues
- Supabase handles CORS automatically
- No additional configuration needed

### Authentication Issues
- Make sure you're logged in to your app
- Check if user has proper permissions

## Benefits of Supabase vs Firebase Storage

✅ **Free Tier**: 1GB storage vs Firebase's limited free tier
✅ **No CORS Issues**: Works seamlessly with localhost
✅ **Better Pricing**: More generous free limits
✅ **PostgreSQL**: Uses standard SQL instead of NoSQL
✅ **Real-time**: Built-in real-time subscriptions
✅ **Open Source**: More transparent and customizable

## Migration Complete!

Your app now uses Supabase for image uploads instead of Firebase Storage. The countdown timer and all other features remain unchanged.
