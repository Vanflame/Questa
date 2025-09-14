# Supabase RLS Policies Setup - Step by Step Guide

## 🎯 Problem
You're getting this error: `StorageApiError: new row violates row-level security policy`

## 🔧 Solution: Set Up Storage Policies

### Step 1: Access Supabase Dashboard
1. **Open your browser** and go to: https://supabase.com/dashboard
2. **Sign in** to your Supabase account
3. **Click on your project**: `jwdtesptqctpxurrsptb`

### Step 2: Navigate to Storage Policies
1. **In the left sidebar**, click on **"Storage"**
2. **Click on "Policies"** tab (next to "Buckets")
3. You should see a page titled **"Storage Policies"**

### Step 3: Create the Required Policies

#### Policy 1: Allow Authenticated Users to Upload
1. **Click the "New Policy" button** (top right)
2. **Select "For full customization"**
3. **Fill in the form:**
   - **Policy name**: `Allow authenticated uploads`
   - **Allowed operation**: Select **"INSERT"**
   - **Target roles**: Select **"authenticated"**
   - **Policy definition**: Copy and paste this exactly:
   ```sql
   bucket_id = 'task-images'
   ```
4. **Click "Review"**
5. **Click "Save policy"**

#### Policy 2: Allow Public Access to Files
1. **Click the "New Policy" button** again
2. **Select "For full customization"**
3. **Fill in the form:**
   - **Policy name**: `Allow public access`
   - **Allowed operation**: Select **"SELECT"**
   - **Target roles**: Select **"public"**
   - **Policy definition**: Copy and paste this exactly:
   ```sql
   bucket_id = 'task-images'
   ```
4. **Click "Review"**
5. **Click "Save policy"**

#### Policy 3: Allow Users to Update Their Own Files
1. **Click the "New Policy" button** again
2. **Select "For full customization"**
3. **Fill in the form:**
   - **Policy name**: `Allow users to update own files`
   - **Allowed operation**: Select **"UPDATE"**
   - **Target roles**: Select **"authenticated"**
   - **Policy definition**: Copy and paste this exactly:
   ```sql
   bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]
   ```
4. **Click "Review"**
5. **Click "Save policy"**

#### Policy 4: Allow Users to Delete Their Own Files
1. **Click the "New Policy" button"** again
2. **Select "For full customization"**
3. **Fill in the form:**
   - **Policy name**: `Allow users to delete own files`
   - **Allowed operation**: Select **"DELETE"**
   - **Target roles**: Select **"authenticated"**
   - **Policy definition**: Copy and paste this exactly:
   ```sql
   bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[2]
   ```
4. **Click "Review"**
5. **Click "Save policy"**

### Step 4: Verify Your Policies
After creating all 4 policies, you should see:
- ✅ Allow authenticated uploads (INSERT)
- ✅ Allow public access (SELECT)
- ✅ Allow users to update own files (UPDATE)
- ✅ Allow users to delete own files (DELETE)

### Step 5: Test the Fix
1. **Go back to your application**
2. **Try uploading an image** in the dashboard
3. **Check the browser console** - you should no longer see RLS errors
4. **Verify the image appears** in the admin verification review

---

## 🚨 Alternative Method: Using SQL Editor

If the GUI method doesn't work, use the SQL Editor:

### Step 1: Open SQL Editor
1. **In Supabase Dashboard**, click **"SQL Editor"** in the left sidebar
2. **Click "New query"**

### Step 2: Run These Commands
Copy and paste this entire block into the SQL Editor:

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

### Step 3: Execute the Query
1. **Click "Run"** button (or press Ctrl+Enter)
2. **Wait for success message**
3. **Test your application**

---

## 🔍 Troubleshooting

### If you get "policy already exists" error:
1. **Go to Storage → Policies**
2. **Delete existing policies** for `task-images`
3. **Recreate them** using the steps above

### If the bucket doesn't exist:
1. **Go to Storage → Buckets**
2. **Click "Create bucket"**
3. **Name**: `task-images`
4. **Make it Public**: ✅ Check this box
5. **Click "Create bucket"**

### If you still get errors:
1. **Check the bucket name** is exactly `task-images`
2. **Verify policies** are created correctly
3. **Try disabling RLS temporarily**:
   - Go to **Storage → Settings**
   - Find `task-images` bucket
   - **Uncheck "Enable RLS"** (not recommended for production)

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ No more "row-level security policy" errors in console
- ✅ Images upload successfully to Supabase
- ✅ Images appear in admin verification review
- ✅ No fallback compression messages

---

## 📞 Need Help?

If you're still having issues:
1. **Check the browser console** for specific error messages
2. **Verify your Supabase project** is `jwdtesptqctpxurrsptb`
3. **Make sure you're signed in** to the correct Supabase account
4. **Try the SQL Editor method** if the GUI doesn't work

