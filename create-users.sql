-- SQL skript na vytvorenie profilov pre nových používateľov
-- Spustite tento skript v Supabase SQL Editor

-- Profil pre juraj.gazdik@auo.com s rolou Revizor
INSERT INTO profiles (id, username, full_name, email, role, created_at, updated_at)
VALUES (
  'edeb0754-c593-492c-90a9-3abdae39840d',
  'Revizor',
  'Juraj Gazdík',
  'juraj.gazdik@auo.com',
  'Revizor',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  username = 'Revizor',
  email = 'juraj.gazdik@auo.com',
  role = 'Revizor',
  updated_at = NOW();

-- Profil pre user@auo.com s rolou Užívateľ
INSERT INTO profiles (id, username, full_name, email, role, created_at, updated_at)
VALUES (
  'ce2740c5-baca-450c-9611-69082dc4b7d7',
  'User',
  'User',
  'user@auo.com',
  'Užívateľ',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  username = 'User',
  email = 'user@auo.com',
  role = 'Užívateľ',
  updated_at = NOW();

-- Skontrolujte vytvorené profily
SELECT id, username, full_name, email, role, created_at 
FROM profiles 
WHERE id IN ('edeb0754-c593-492c-90a9-3abdae39840d', 'ce2740c5-baca-450c-9611-69082dc4b7d7');
