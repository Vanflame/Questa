# Supabase RLS Policy Fix Guide

## Issue: "new row violates row-level security policy"

This error occurs because Supabase Storage has Row Level Security (RLS) enabled by default, which prevents unauthorized access to storage buckets.

## Solution: Configure RLS Policies

### Step 1: Go to Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `jwdtesptqctpxurrsptb`
3. Go to **Storage** → **Policies**

### Step 2: Create Storage Policies

#### For the `task-images` bucket, create these policies:

**Policy 1: Allow Authenticated Users to Upload**
```sql
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images');
```

**Policy 2: Allow Public Access to Files**
```sql
CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'task-images');
```

**Policy 3: Allow Users to Update Their Own Files**
```sql
CREATE POLICY "Allow users to update own files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]);
```

**Policy 4: Allow Users to Delete Their Own Files**
```sql
CREATE POLICY "Allow users to delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]);
```

### Step 3: Alternative - Disable RLS (Not Recommended for Production)

If you want to disable RLS temporarily for testing:

1. Go to **Storage** → **Settings**
2. Find the `task-images` bucket
3. Toggle off "Enable RLS" (NOT recommended for production)

### Step 4: Verify Bucket Exists

Make sure the `task-images` bucket exists:
1. Go to **Storage** → **Buckets**
2. If `task-images` doesn't exist, create it:
   - Click "Create bucket"
   - Name: `task-images`
   - Make it **Public**
   - Click "Create bucket"

## Quick Fix Commands

Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for task-images bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'task-images');

CREATE POLICY "Allow users to update own files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Allow users to delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]);
```

## Testing

After applying the policies:
1. Try uploading an image in the dashboard
2. Check the browser console for any remaining errors
3. Verify images appear in the Supabase Storage bucket

## Fallback Solution

If Supabase continues to have issues, the system will fall back to using data URLs for testing, but this is not recommended for production use.

