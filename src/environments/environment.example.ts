// Example environment file - DO NOT COMMIT REAL CREDENTIALS
// Copy this file to environment.ts and environment.prod.ts
// and fill in your actual Supabase credentials

export const environment = {
  production: false,
  supabase: {
    url: 'https://your-project-id.supabase.co',
    anonKey: 'your-anon-key-here'
  }
};
