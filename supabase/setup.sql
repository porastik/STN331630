-- =====================================================
-- EVIDENCIA NÁRADIA - SUPABASE DATABASE SETUP
-- =====================================================
-- This SQL script creates all necessary tables, triggers, 
-- and Row Level Security (RLS) policies for the application.
-- 
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
-- Stores user profile information linked to Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Administrator', 'Revizor', 'Užívateľ')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- =====================================================
-- 2. ASSETS TABLE
-- =====================================================
-- Stores equipment/asset information
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    revision_number TEXT NOT NULL UNIQUE,
    manufacturer TEXT NOT NULL,
    year INTEGER NOT NULL,
    protection_class TEXT NOT NULL CHECK (protection_class IN ('I', 'II', 'III')),
    usage_group TEXT NOT NULL CHECK (usage_group IN ('A', 'B', 'C', 'D', 'E')),
    category TEXT NOT NULL CHECK (category IN ('Držané v ruke', 'Ostatné', 'Predlžovací prívod')),
    status TEXT NOT NULL CHECK (status IN ('V prevádzke', 'V oprave', 'Vyradené', 'Plánovaná')),
    next_inspection_date DATE,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assets_revision_number ON public.assets(revision_number);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_next_inspection ON public.assets(next_inspection_date);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON public.assets(created_by);

-- Enable RLS on assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Assets policies
CREATE POLICY "Anyone authenticated can view assets"
    ON public.assets FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Administrators and Revizors can insert assets"
    ON public.assets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Administrator', 'Revizor')
        )
    );

CREATE POLICY "Administrators and Revizors can update assets"
    ON public.assets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Administrator', 'Revizor')
        )
    );

CREATE POLICY "Only Administrators can delete assets"
    ON public.assets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role = 'Administrator'
        )
    );

-- =====================================================
-- 3. INSPECTIONS TABLE
-- =====================================================
-- Stores inspection/revision records for assets
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    inspector TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Kontrola', 'Revízia')),
    visual_check TEXT NOT NULL CHECK (visual_check IN ('vyhovuje', 'nevyhovuje')),
    protective_conductor_resistance NUMERIC(10, 2),
    insulation_resistance NUMERIC(10, 2),
    leakage_current NUMERIC(10, 2),
    functional_test TEXT NOT NULL CHECK (functional_test IN ('vyhovuje', 'nevyhovuje')),
    overall_result TEXT NOT NULL CHECK (overall_result IN ('vyhovuje', 'nevyhovuje')),
    notes TEXT,
    measuring_instrument_name TEXT,
    measuring_instrument_serial TEXT,
    measuring_instrument_calib_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inspections_asset_id ON public.inspections(asset_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON public.inspections(date);
CREATE INDEX IF NOT EXISTS idx_inspections_created_by ON public.inspections(created_by);

-- Enable RLS on inspections
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Inspections policies
CREATE POLICY "Anyone authenticated can view inspections"
    ON public.inspections FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Administrators and Revizors can insert inspections"
    ON public.inspections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Administrator', 'Revizor')
        )
    );

CREATE POLICY "Administrators and Revizors can update inspections"
    ON public.inspections FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Administrator', 'Revizor')
        )
    );

CREATE POLICY "Only Administrators can delete inspections"
    ON public.inspections FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role = 'Administrator'
        )
    );

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'Užívateľ')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to profiles
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Apply updated_at trigger to assets
DROP TRIGGER IF EXISTS set_updated_at_assets ON public.assets;
CREATE TRIGGER set_updated_at_assets
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 5. INITIAL DATA (OPTIONAL)
-- =====================================================
-- Uncomment the following to create a default admin user
-- Note: You should create users through Supabase Auth instead
-- This is just for reference

/*
-- First, create user in Supabase Auth Dashboard or via API
-- Then insert their profile:

INSERT INTO public.profiles (id, username, full_name, email, role)
VALUES (
    'your-user-uuid-from-auth',
    'admin',
    'System Administrator',
    'admin@example.com',
    'Administrator'
) ON CONFLICT (id) DO NOTHING;
*/

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Copy your Supabase URL and anon key
-- 2. Update src/environments/environment.ts with your credentials
-- 3. Create your first user via Supabase Auth
-- 4. Assign appropriate role in the profiles table
-- =====================================================
