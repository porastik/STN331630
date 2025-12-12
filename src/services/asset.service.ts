import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Asset, Inspection } from '../models/asset.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private readonly LOCAL_STORAGE_KEY = 'evidencia-assets';
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  
  private _assets = signal<Asset[]>([]);
  public assets = this._assets.asReadonly();
  public lastAddedRevisionNumber = signal<string | null>(null);
  
  private _loading = signal(false);
  public loading = this._loading.asReadonly();
  
  private _error = signal<string | null>(null);
  public error = this._error.asReadonly();

  public lastUsedRevisionNumber = computed(() => {
    const assets = this._assets();
    if (assets.length === 0) {
        return null;
    }
    const sortedAssets = [...assets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sortedAssets[0]?.revisionNumber ?? null;
  });

  constructor() {
    this.initializeAssets();
    
    // Watch for user login/logout and reload assets accordingly
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        // User logged in - load from Supabase
        this.loadAssetsFromSupabase();
      } else {
        // User logged out - load from local storage
        this.loadAssetsFromStorage();
      }
    }, { allowSignalWrites: true });
  }

  private async initializeAssets() {
    if (this.authService.currentUser()) {
      await this.loadAssetsFromSupabase();
    } else {
      this.loadAssetsFromStorage();
    }
  }

  private async loadAssetsFromSupabase(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    
    try {
      const assetsData = await this.supabaseService.getAssets();

      const assetsWithInspections = await Promise.all(
        assetsData.map(async (assetData) => {
          const inspectionsData = await this.supabaseService.getInspections(assetData.id);
          
          const asset: Asset = {
            id: assetData.id,
            name: assetData.name,
            type: assetData.type,
            serialNumber: assetData.serial_number,
            revisionNumber: assetData.revision_number,
            manufacturer: assetData.manufacturer,
            year: assetData.year,
            protectionClass: assetData.protection_class,
            usageGroup: assetData.usage_group,
            category: assetData.category,
            status: assetData.status,
            nextInspectionDate: assetData.next_inspection_date || '',
            location: assetData.location || undefined,
            notes: assetData.notes || undefined,
            createdAt: assetData.created_at,
            inspections: (inspectionsData || []).map(inspection => ({
              id: inspection.id,
              assetId: inspection.asset_id,
              date: inspection.date,
              inspector: inspection.inspector,
              type: inspection.type,
              visualCheck: inspection.visual_check,
              protectiveConductorResistance: inspection.protective_conductor_resistance || undefined,
              insulationResistance: inspection.insulation_resistance || undefined,
              leakageCurrent: inspection.leakage_current || undefined,
              functionalTest: inspection.functional_test,
              overallResult: inspection.overall_result,
              notes: inspection.notes || undefined,
              measuringInstrumentName: inspection.measuring_instrument_name || undefined,
              measuringInstrumentSerial: inspection.measuring_instrument_serial || undefined,
              measuringInstrumentCalibDate: inspection.measuring_instrument_calib_date || undefined,
            }))
          };
          
          return asset;
        })
      );
      
      this._assets.set(assetsWithInspections);
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error loading assets from Supabase:', error);
      this._error.set('Nepodarilo sa načítať dáta zo servera.');
      this.loadAssetsFromStorage();
    } finally {
      this._loading.set(false);
    }
  }

  private loadAssetsFromStorage(): void {
    try {
      const savedAssets = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (savedAssets) {
        this._assets.set(JSON.parse(savedAssets));
      } else {
        this.loadInitialData();
      }
    } catch (e) {
      console.error('Error loading assets from localStorage:', e);
      this.loadInitialData();
    }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this._assets()));
    } catch (e) {
      console.error('Error saving assets to localStorage', e);
    }
  }

  async refreshAssets(): Promise<void> {
    if (this.authService.currentUser()) {
      await this.loadAssetsFromSupabase();
    } else {
      this.loadAssetsFromStorage();
    }
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  async addAsset(asset: Omit<Asset, 'id' | 'inspections' | 'nextInspectionDate' | 'createdAt'>) {
    this._loading.set(true);
    this._error.set(null);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser) {
      console.warn('No user logged in, saving to localStorage');
      const newAsset: Asset = {
        ...asset,
        id: this.generateId(),
        inspections: [],
        createdAt: new Date().toISOString(),
        nextInspectionDate: ''
      };
      this._assets.update(assets => [...assets, newAsset]);
      this.lastAddedRevisionNumber.set(newAsset.revisionNumber);
      this.saveToLocalStorage();
      this._loading.set(false);
      return;
    }

    try {
      // Ensure valid session before database operation
      const sessionValid = await this.supabaseService.ensureValidSession();
      if (!sessionValid) {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
        this._loading.set(false);
        return;
      }

      const data = await this.supabaseService.createAsset({
        name: asset.name,
        type: asset.type,
        serial_number: asset.serialNumber,
        revision_number: asset.revisionNumber,
        manufacturer: asset.manufacturer,
        year: asset.year,
        protection_class: asset.protectionClass,
        usage_group: asset.usageGroup,
        category: asset.category,
        status: asset.status,
        next_inspection_date: null,
        location: asset.location || null,
        notes: asset.notes || null,
        created_by: currentUser.id,
      });

      console.log('Asset created successfully:', data);
      await this.loadAssetsFromSupabase();
      this.lastAddedRevisionNumber.set(asset.revisionNumber);
    } catch (error: any) {
      console.error('Error adding asset:', error);
      console.error('Error details:', error.message, error.details, error.hint, error.code);
      
      // Check if it's an auth error
      if (error.message?.includes('JWT') || error.message?.includes('expired') || error.code === 'PGRST301') {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
      } else {
        this._error.set('Nepodarilo sa pridať náradia. Skontrolujte prosím oprávnenia.');
      }
      throw error; // Re-throw aby sa error zobrazil v UI
    } finally {
      this._loading.set(false);
    }
  }

  async updateAsset(updatedAsset: Asset) {
    this._loading.set(true);
    this._error.set(null);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser) {
      this._assets.update(assets =>
        assets.map(asset => (asset.id === updatedAsset.id ? updatedAsset : asset))
      );
      this.saveToLocalStorage();
      this._loading.set(false);
      return;
    }

    try {
      // Ensure valid session before database operation
      const sessionValid = await this.supabaseService.ensureValidSession();
      if (!sessionValid) {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
        this._loading.set(false);
        return;
      }

      await this.supabaseService.updateAsset(updatedAsset.id, {
        name: updatedAsset.name,
        type: updatedAsset.type,
        serial_number: updatedAsset.serialNumber,
        revision_number: updatedAsset.revisionNumber,
        manufacturer: updatedAsset.manufacturer,
        year: updatedAsset.year,
        protection_class: updatedAsset.protectionClass,
        usage_group: updatedAsset.usageGroup,
        category: updatedAsset.category,
        status: updatedAsset.status,
        next_inspection_date: updatedAsset.nextInspectionDate,
        location: updatedAsset.location || null,
        notes: updatedAsset.notes || null,
      });

      await this.loadAssetsFromSupabase();
    } catch (error: any) {
      console.error('Error updating asset:', error);
      
      // Check if it's an auth error
      if (error.message?.includes('JWT') || error.message?.includes('expired') || error.code === 'PGRST301') {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
      } else {
        this._error.set('Nepodarilo sa aktualizovať náradia.');
      }
    } finally {
      this._loading.set(false);
    }
  }

  async deleteAsset(id: string) {
    this._loading.set(true);
    this._error.set(null);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser) {
      this._assets.update(assets => assets.filter(asset => asset.id !== id));
      this.saveToLocalStorage();
      this._loading.set(false);
      return;
    }

    try {
      // Ensure valid session before database operation
      const sessionValid = await this.supabaseService.ensureValidSession();
      if (!sessionValid) {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
        this._loading.set(false);
        return;
      }

      await this.supabaseService.deleteAsset(id);

      await this.loadAssetsFromSupabase();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      
      // Check if it's an auth error
      if (error.message?.includes('JWT') || error.message?.includes('expired') || error.code === 'PGRST301') {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
      } else {
        this._error.set('Nepodarilo sa vymazať náradia.');
      }
    } finally {
      this._loading.set(false);
    }
  }

  async addInspection(assetId: string, inspection: Omit<Inspection, 'id' | 'assetId'>) {
    this._loading.set(true);
    this._error.set(null);

    const currentUser = this.authService.currentUser();
    const asset = this._assets().find(a => a.id === assetId);
    
    if (!asset) {
      this._error.set('Náradia nenájdené.');
      this._loading.set(false);
      return;
    }

    if (!currentUser) {
      const newInspection: Inspection = {
        ...inspection,
        id: this.generateId(),
        assetId: assetId
      };

      const nextInspectionDate = this.calculateNextInspectionDate(asset.usageGroup, asset.category, inspection.date);
      const status = inspection.overallResult === 'vyhovuje' ? 'V prevádzke' : 'V oprave';
      
      this._assets.update(assets =>
        assets.map(a => {
          if (a.id === assetId) {
            return { 
              ...a, 
              inspections: [...a.inspections, newInspection], 
              nextInspectionDate, 
              status 
            };
          }
          return a;
        })
      );
      this.saveToLocalStorage();
      this._loading.set(false);
      return;
    }

    try {
      // Ensure valid session before database operation
      const sessionValid = await this.supabaseService.ensureValidSession();
      if (!sessionValid) {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
        this._loading.set(false);
        return;
      }

      await this.supabaseService.createInspection({
        asset_id: assetId,
        date: inspection.date,
        inspector: inspection.inspector,
        type: inspection.type,
        visual_check: inspection.visualCheck,
        protective_conductor_resistance: inspection.protectiveConductorResistance || null,
        insulation_resistance: inspection.insulationResistance || null,
        leakage_current: inspection.leakageCurrent || null,
        functional_test: inspection.functionalTest,
        overall_result: inspection.overallResult,
        notes: inspection.notes || null,
        measuring_instrument_name: inspection.measuringInstrumentName || null,
        measuring_instrument_serial: inspection.measuringInstrumentSerial || null,
        measuring_instrument_calib_date: inspection.measuringInstrumentCalibDate || null,
        created_by: currentUser.id,
      });

      console.log('Inspection created successfully');

      const nextInspectionDate = this.calculateNextInspectionDate(asset.usageGroup, asset.category, inspection.date);
      const status = inspection.overallResult === 'vyhovuje' ? 'V prevádzke' : 'V oprave';

      console.log('Calculated next inspection date:', nextInspectionDate);
      console.log('New status:', status);
      console.log('Asset usage group:', asset.usageGroup, 'Category:', asset.category);

      await this.supabaseService.updateAsset(assetId, {
        next_inspection_date: nextInspectionDate,
        status,
      });

      console.log('Asset updated with new inspection date');

      await this.loadAssetsFromSupabase();
      console.log('Assets reloaded from Supabase');
    } catch (error: any) {
      console.error('Error adding inspection:', error);
      console.error('Error details:', error.message, error.details, error.hint, error.code);
      
      // Check if it's an auth error
      if (error.message?.includes('JWT') || error.message?.includes('expired') || error.code === 'PGRST301') {
        this._error.set('Vaša relácia vypršala. Prosím, prihláste sa znova.');
      } else {
        this._error.set('Nepodarilo sa pridať kontrolu/revíziu.');
      }
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  replaceAllAssets(newAssets: Asset[]): void {
    this._assets.set(newAssets);
    this.saveToLocalStorage();
  }

  public forceSaveToLocalStorage(): boolean {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this._assets()));
      return true;
    } catch (e) {
      console.error('Error manually saving assets to localStorage', e);
      return false;
    }
  }

  private loadInitialData() {
    const initialAssets: Asset[] = [];
    this._assets.set(initialAssets);
  }

  private calculateNextInspectionDate(usageGroup: Asset['usageGroup'], category: Asset['category'], lastInspectionDate: string): string | null {
    const date = new Date(lastInspectionDate);
    let monthsToAdd: number | null = null;

    if (usageGroup === 'A') {
      return null;
    }

    switch (category) {
      case 'Držané v ruke':
        switch (usageGroup) {
          case 'B':
          case 'C':
          case 'D':
            monthsToAdd = 6;
            break;
          case 'E':
            monthsToAdd = 12;
            break;
        }
        break;
      
      case 'Predlžovací prívod':
        switch (usageGroup) {
          case 'B':
          case 'C':
          case 'D':
            monthsToAdd = 6;
            break;
          case 'E':
            monthsToAdd = 24;
            break;
        }
        break;
      
      case 'Ostatné':
        switch (usageGroup) {
          case 'B':
            monthsToAdd = 6;
            break;
          case 'C':
          case 'D':
            monthsToAdd = 12;
            break;
          case 'E':
            monthsToAdd = 24;
            break;
        }
        break;
    }
    
    if (monthsToAdd !== null) {
        date.setMonth(date.getMonth() + monthsToAdd);
        return date.toISOString().split('T')[0];
    }

    return null;
  }
}
