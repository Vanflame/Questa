// Supabase Configuration
const supabaseUrl = 'https://jwdtesptqctpxurrsptb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZHRlc3B0cWN0cHh1cnJzcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDM3OTcsImV4cCI6MjA3MzMxOTc5N30.J-HVs44Z_nVRrOd6hhxuxR0Oh84iWK17pbNiRlfNF0I';

// Initialize Supabase client
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Export for use in other files
window.supabaseClient = supabaseClient;

console.log('Supabase initialized successfully');

// Storage configuration
const STORAGE_BUCKET = 'task-images'; // We'll create this bucket
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
