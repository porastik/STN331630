import { Injectable, signal, computed, inject } from '@angular/core';
import { User } from '../models/user.model';
import { SupabaseService } from './supabase.service';
import { AuthError } from '@supabase/supabase-js';

export interface AuthResponse {
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  
  private _currentUser = signal<User | null>(null);
  public currentUser = this._currentUser.asReadonly();

  public isAdmin = computed(() => this.currentUser()?.role === 'Administrator');
  public isRevizor = computed(() => this.currentUser()?.role === 'Revizor');
  public isUser = computed(() => this.currentUser()?.role === 'Užívateľ');
  public canEdit = computed(() => this.isAdmin() || this.isRevizor());

  private _users = signal<User[]>([]);
  public users = this._users.asReadonly();

  private _loading = signal(false);
  public loading = this._loading.asReadonly();

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    this._loading.set(true);
    try {
      const session = await this.supabaseService.getSession();
      if (session?.user) {
        await this.loadUserProfile(session.user.id);
        
        // Load all users if current user is admin
        const profile = await this.supabaseService.getProfile(session.user.id);
        if (profile.role === 'Administrator') {
          await this.loadAllUsers();
        }
      }
      
      // Listen for auth state changes including token refresh
      this.supabaseService.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await this.loadUserProfile(session.user.id);
          
          // Load all users if admin
          const profile = await this.supabaseService.getProfile(session.user.id);
          if (profile.role === 'Administrator') {
            await this.loadAllUsers();
          }
        } else if (event === 'SIGNED_OUT') {
          this._currentUser.set(null);
          this._users.set([]);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed successfully');
          await this.loadUserProfile(session.user.id);
        } else if (event === 'USER_UPDATED' && session?.user) {
          await this.loadUserProfile(session.user.id);
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      this._loading.set(false);
    }
  }

  private async loadUserProfile(userId: string) {
    try {
      const data = await this.supabaseService.getProfile(userId);
      const user: User = {
        id: data.id,
        username: data.username,
        fullName: data.full_name,
        email: data.email,
        role: data.role
      };
      this._currentUser.set(user);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  // Helper method to ensure session is valid
  private async ensureValidSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await this.supabaseService.auth.getSession();
      
      if (error || !session) {
        console.error('Session invalid, logging out');
        await this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabaseService.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: this.translateAuthError(error) };
      }

      if (data.user) {
        await this.loadUserProfile(data.user.id);
        return { success: true };
      }

      return { success: false, error: 'Nepodarilo sa prihlásiť.' };
    } catch (error) {
      return { success: false, error: 'Nastala chyba pri prihlásení.' };
    } finally {
      this._loading.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.supabaseService.auth.signOut();
    this._currentUser.set(null);
  }

  async signUp(email: string, password: string, username: string, fullName: string, role: 'Administrator' | 'Revizor' | 'Užívateľ' = 'Užívateľ'): Promise<AuthResponse> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabaseService.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            role,
          },
        },
      });

      if (error) {
        return { success: false, error: this.translateAuthError(error) };
      }

      if (data.user) {
        return { success: true };
      }

      return { success: false, error: 'Nepodarilo sa vytvoriť účet.' };
    } catch (error) {
      return { success: false, error: 'Nastala chyba pri registrácii.' };
    } finally {
      this._loading.set(false);
    }
  }

  async updateUserProfile(userId: string, updates: { username?: string; fullName?: string; email?: string; role?: 'Administrator' | 'Revizor' | 'Užívateľ' }): Promise<AuthResponse> {
    try {
      const profileUpdates: any = {};
      if (updates.username) profileUpdates.username = updates.username;
      if (updates.fullName) profileUpdates.full_name = updates.fullName;
      if (updates.email) profileUpdates.email = updates.email;
      if (updates.role) profileUpdates.role = updates.role;

      await this.supabaseService.updateProfile(userId, profileUpdates);

      if (this.currentUser()?.id === userId) {
        await this.loadUserProfile(userId);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Nastala chyba pri aktualizácii.' };
    }
  }

  async changePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { error } = await this.supabaseService.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: this.translateAuthError(error) };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Nastala chyba pri zmene hesla.' };
    }
  }

  async loadAllUsers(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email', { ascending: true });

      if (error) throw error;
      
      const users: User[] = data.map(profile => {
        // Nastavenie používateľského mena podľa role
        let username = 'User';
        if (profile.role === 'Administrator') username = 'Administrator';
        else if (profile.role === 'Revizor') username = 'Revizor';
        
        return {
          id: profile.id,
          username: username,
          fullName: profile.full_name || '',
          email: profile.email,
          role: profile.role
        };
      });
      this._users.set(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  private translateAuthError(error: AuthError): string {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Nesprávne prihlasovacie údaje.';
      case 'Email not confirmed':
        return 'Email nebol potvrdený.';
      case 'User already registered':
        return 'Používateľ už existuje.';
      default:
        return error.message;
    }
  }

  async updateUser(userId: string, fullName: string): Promise<{ success: boolean, error?: string }> {
    try {
      await this.supabaseService.updateProfile(userId, {
        full_name: fullName
      });
      await this.loadAllUsers();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message || 'Nepodarilo sa aktualizovať používateľa.' };
    }
  }

  async deleteUser(userId: string): Promise<{ success: boolean, error?: string }> {
    try {
      // Delete profile from database
      // Note: This will not delete the auth user, only the profile
      // Auth users can only be deleted via Supabase dashboard or admin API
      const { error } = await this.supabaseService.client
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user profile:', error);
        return { success: false, error: error.message };
      }

      // Reload users list
      await this.loadAllUsers();
      
      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteUser:', error);
      return { success: false, error: error.message || 'Neznáma chyba pri odstraňovaní používateľa.' };
    }
  }
}
