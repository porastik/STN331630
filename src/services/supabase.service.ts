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
    const { data, error } = await this.supabase
      .from('assets')
      .insert(asset)
      .select()
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['assets']['Row'];
  }

  async updateAsset(id: string, updates: Database['public']['Tables']['assets']['Update']) {
    const { data, error } = await this.supabase
      .from('assets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['assets']['Row'];
  }

  async deleteAsset(id: string) {
    const { error } = await this.supabase
      .from('assets')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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
    const { data, error } = await this.supabase
      .from('inspections')
      .insert(inspection)
      .select()
      .single();
    
    if (error) throw error;
    return data as Database['public']['Tables']['inspections']['Row'];
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
