import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          email: string;
          role: 'Administrator' | 'Revizor' | 'Užívateľ';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          email: string;
          role: 'Administrator' | 'Revizor' | 'Užívateľ';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          email?: string;
          role?: 'Administrator' | 'Revizor' | 'Užívateľ';
          updated_at?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          name: string;
          type: string;
          serial_number: string;
          revision_number: string;
          manufacturer: string;
          year: number;
          protection_class: 'I' | 'II' | 'III';
          usage_group: 'A' | 'B' | 'C' | 'D' | 'E';
          category: 'Držané v ruke' | 'Ostatné' | 'Predlžovací prívod';
          status: 'V prevádzke' | 'V oprave' | 'Vyradené' | 'Plánovaná';
          next_inspection_date: string | null;
          location: string | null;
          notes: string | null;
          created_at: string;
          created_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          serial_number: string;
          revision_number: string;
          manufacturer: string;
          year: number;
          protection_class: 'I' | 'II' | 'III';
          usage_group: 'A' | 'B' | 'C' | 'D' | 'E';
          category: 'Držané v ruke' | 'Ostatné' | 'Predlžovací prívod';
          status: 'V prevádzke' | 'V oprave' | 'Vyradené' | 'Plánovaná';
          next_inspection_date: string | null;
          location?: string | null;
          notes?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          type?: string;
          serial_number?: string;
          revision_number?: string;
          manufacturer?: string;
          year?: number;
          protection_class?: 'I' | 'II' | 'III';
          usage_group?: 'A' | 'B' | 'C' | 'D' | 'E';
          category?: 'Držané v ruke' | 'Ostatné' | 'Predlžovací prívod';
          status?: 'V prevádzke' | 'V oprave' | 'Vyradené' | 'Plánovaná';
          next_inspection_date?: string | null;
          location?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      inspections: {
        Row: {
          id: string;
          asset_id: string;
          date: string;
          inspector: string;
          type: 'Kontrola' | 'Revízia';
          visual_check: 'vyhovuje' | 'nevyhovuje';
          protective_conductor_resistance: number | null;
          insulation_resistance: number | null;
          leakage_current: number | null;
          functional_test: 'vyhovuje' | 'nevyhovuje';
          overall_result: 'vyhovuje' | 'nevyhovuje';
          notes: string | null;
          measuring_instrument_name: string | null;
          measuring_instrument_serial: string | null;
          measuring_instrument_calib_date: string | null;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          date: string;
          inspector: string;
          type: 'Kontrola' | 'Revízia';
          visual_check: 'vyhovuje' | 'nevyhovuje';
          protective_conductor_resistance?: number | null;
          insulation_resistance?: number | null;
          leakage_current?: number | null;
          functional_test: 'vyhovuje' | 'nevyhovuje';
          overall_result: 'vyhovuje' | 'nevyhovuje';
          notes?: string | null;
          measuring_instrument_name?: string | null;
          measuring_instrument_serial?: string | null;
          measuring_instrument_calib_date?: string | null;
          created_by: string;
        };
        Update: {
          date?: string;
          inspector?: string;
          type?: 'Kontrola' | 'Revízia';
          visual_check?: 'vyhovuje' | 'nevyhovuje';
          protective_conductor_resistance?: number | null;
          insulation_resistance?: number | null;
          leakage_current?: number | null;
          functional_test?: 'vyhovuje' | 'nevyhovuje';
          overall_result?: 'vyhovuje' | 'nevyhovuje';
          notes?: string | null;
          measuring_instrument_name?: string | null;
          measuring_instrument_serial?: string | null;
          measuring_instrument_calib_date?: string | null;
        };
      };
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }
      }
    );
  }

  get client() {
    return this.supabase;
  }

  get auth() {
    return this.supabase.auth;
  }

  // Auth helpers
  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  async getUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  // Ensure valid session - refresh token if expired
  async ensureValidSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('[ensureValidSession] Error getting session:', error);
        return false;
      }
      
      if (!session) {
        console.warn('[ensureValidSession] No active session found');
        return false;
      }
      
      console.log('[ensureValidSession] Session found, checking expiration...');
      
      // Check if token is expired or about to expire (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expirationTime = expiresAt * 1000; // Convert to milliseconds
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        const timeUntilExpiry = expirationTime - now;
        
        console.log('[ensureValidSession] Time until expiry:', Math.round(timeUntilExpiry / 1000), 'seconds');
        
        // Refresh if already expired or expiring within 5 minutes
        if (now >= expirationTime || timeUntilExpiry < fiveMinutes) {
          console.log('[ensureValidSession] Token expired or expiring soon, refreshing...');
          const { data, error: refreshError } = await this.supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('[ensureValidSession] Error refreshing session:', refreshError);
            return false;
          }
          
          if (data.session) {
            console.log('[ensureValidSession] Session refreshed successfully, new expiry:', new Date(data.session.expires_at! * 1000).toLocaleTimeString());
            return true;
          }
          
          console.error('[ensureValidSession] Refresh succeeded but no session returned');
          return false;
        }
      }
      
      console.log('[ensureValidSession] Session is valid, no refresh needed');
      return true;
    } catch (error) {
      console.error('[ensureValidSession] Unexpected error:', error);
      return false;
    }
  }

  // Helper to execute database operations with automatic token refresh retry
  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a JWT/auth error
      if (error.message?.includes('JWT') || error.message?.includes('expired') || error.code === 'PGRST301') {
        console.log('JWT error detected, attempting token refresh and retry...');
        
        // Try to refresh the session
        const { data, error: refreshError } = await this.supabase.auth.refreshSession();
        
        if (refreshError || !data.session) {
          console.error('Failed to refresh session:', refreshError);
          throw error; // Re-throw original error
        }
        
        console.log('Session refreshed, retrying operation...');
        // Retry the operation once
        return await operation();
      }
      
      // Not a JWT error, just throw it
      throw error;
    }
  }

  // Profile helpers
  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['profiles']['Row'];
  }

  async createProfile(profile: { id: string; username: string; full_name: string; email: string; role: string }) {
    const { error } = await this.supabase
      .from('profiles')
      .insert({
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating profile:', error);
      return { error: error.message };
    }
    return { error: null };
  }

  async updateProfile(userId: string, updates: Database['public']['Tables']['profiles']['Update']) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);
    
    if (error) throw error;
    return data;
  }

  // Assets helpers
  async getAssets() {
    const { data, error } = await this.supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Database['public']['Tables']['assets']['Row'][];
  }

  async getAsset(id: string) {
    const { data, error } = await this.supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['assets']['Row'];
  }

  async createAsset(asset: Database['public']['Tables']['assets']['Insert']) {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('assets')
        .insert(asset)
        .select()
        .single();
      
      if (error) throw error;
      return data as Database['public']['Tables']['assets']['Row'];
    });
  }

  async updateAsset(id: string, updates: Database['public']['Tables']['assets']['Update']) {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('assets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Database['public']['Tables']['assets']['Row'];
    });
  }

  async deleteAsset(id: string) {
    return this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('assets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    });
  }

  // Inspections helpers
  async getInspections(assetId: string) {
    const { data, error } = await this.supabase
      .from('inspections')
      .select('*')
      .eq('asset_id', assetId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data as Database['public']['Tables']['inspections']['Row'][];
  }

  async createInspection(inspection: Database['public']['Tables']['inspections']['Insert']) {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('inspections')
        .insert(inspection)
        .select()
        .single();
      
      if (error) throw error;
      return data as Database['public']['Tables']['inspections']['Row'];
    });
  }

  async updateInspection(id: string, updates: Database['public']['Tables']['inspections']['Update']) {
    const { data, error } = await this.supabase
      .from('inspections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['inspections']['Row'];
  }

  async deleteInspection(id: string) {
    const { error } = await this.supabase
      .from('inspections')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}
