import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Asset, Inspection } from './models/asset.model';
import { AssetService } from './services/asset.service';
import { AuthService } from './services/auth.service';
import { User } from './models/user.model';
import { SettingsService } from './services/settings.service';
import { OperatorInfo } from './models/settings.model';

declare var JsBarcode: any;
declare var Quagga: any;

// Fix: Consolidate and correct type declarations for jspdf and jspdf-autotable to resolve duplicate identifier and property errors.
// Fix: Add missing `setPage` and `internal` properties to the interface to match usage within the component.
interface jsPDFWithAutoTable {
  setFontSize(size: number): this;
  text(text: string | string[], x: number, y: number, options?: any): this;
  save(filename: string): this;
  autoTable: (options: any) => this;
  lastAutoTable: { finalY: number };
  addFileToVFS(filename: string, data: string): this;
  addFont(postScriptName: string, fontName: string, fontStyle: string): this;
  setFont(fontName: string, fontStyle?: string): this;
  setPage(pageNumber: number): this;
  internal: { 
    getNumberOfPages(): number;
    pageSize: { width: number; height: number; };
  };
  // Fix: Add missing `addPage` property to support multi-page PDF generation.
  addPage(): this;
  getTextColor(): any; // Add for styling purposes
  getFont(): any; // Add for styling purposes
  setTextColor(color: string | number[]): this;
  line(x1: number, y1: number, x2: number, y2: number): this;
}

declare var jspdf: {
  jsPDF: new (options?: any) => jsPDFWithAutoTable;
};


type ViewMode = 'list' | 'detail' | 'assetForm' | 'inspectionForm' | 'qrScanner' | 'userManagement';
type Notification = { message: string; type: 'success' | 'error' };
type SummaryFilter = 'total' | 'planned' | 'inOperation' | 'inRepair' | 'decommissioned' | 'dueIn30Days' | 'inspectionsLastWeek' | 'newAssetsLastWeek' | null;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
})
export class AppComponent {
  assetService = inject(AssetService);
  authService = inject(AuthService);
  settingsService = inject(SettingsService);
  private datePipe: DatePipe = inject(DatePipe);
  private ngZone = inject(NgZone);

  // View management
  viewMode = signal<ViewMode>('list');

  // Login state
  username = signal('');
  password = signal('');
  loginError = signal<string | null>(null);

  // Asset list state
  selectedAsset = signal<Asset | null>(null);
  searchQuery = signal('');
  filterByStatus = signal('all');
  sortBy = signal('nextInspectionDate');
  
  // Advanced filters
  showAdvancedFilters = signal(false);
  filterManufacturer = signal('');
  filterType = signal('');
  filterYear = signal<number | null>(null);
  filterLocation = signal('');
  filterCategory = signal('');
  dateFilterStart = signal('');
  dateFilterEnd = signal('');
  filterInspectionType = signal('all');
  filterInspectionResult = signal('all');

  // Summary filter
  summaryFilterActive = signal<SummaryFilter>(null);

  // Form models
  assetFormModel = signal<Partial<Asset>>({});
  inspectionFormModel = signal<Partial<Inspection>>({});

  // Validation state
  assetFormErrors = signal<{[key: string]: string}>({});
  inspectionFormErrors = signal<{[key: string]: string}>({});
  isAssetFormValid = computed(() => Object.keys(this.assetFormErrors()).length === 0);
  isInspectionFormValid = computed(() => Object.keys(this.inspectionFormErrors()).length === 0);

  // Pagination state
  itemsPerPage = signal(9);
  currentPage = signal(1);

  // QR Code state
  isQrModalOpen = signal(false);
  qrCodeDataUrl = signal('');
  @ViewChild('scannerVideo') scannerVideo?: ElementRef<HTMLDivElement>;
  scannerStatus = signal<'idle' | 'scanning' | 'error' | 'success'>('idle');
  scannerError = signal<string | null>(null);

  // User management state
  userFormModel = signal<Partial<User>>({});
  isUserFormModalOpen = signal(false);
  userToDelete = signal<User | null>(null);
  userSearchQuery = signal('');

  // Settings state
  isSettingsModalOpen = signal(false);
  operatorInfoFormModel = signal<OperatorInfo>({ name: '', address: '', ico: '' });
  
  // Notification
  notification = signal<Notification | null>(null);

  constructor() {
    effect(() => {
        if (this.assetService.lastAddedRevisionNumber()) {
            this.showNotification(`Spotrebič s rev. číslom ${this.assetService.lastAddedRevisionNumber()} bol úspešne pridaný.`, 'success');
            this.assetService.lastAddedRevisionNumber.set(null);
        }
    });

    // Real-time form validation
    effect(() => this.validateAssetForm());
    effect(() => this.validateInspectionForm());

    // Effect to reset page when filters change
    effect(() => {
      // This effect runs whenever filteredAndSortedAssets changes.
      this.filteredAndSortedAssets(); // Establish dependency.
      // We then reset the page to 1.
      this.currentPage.set(1);
    }, { allowSignalWrites: true }); // Necessary because we're writing to a signal inside an effect.
  }

  // Computed properties
  filteredAndSortedAssets = computed(() => {
    let assets = this.assetService.assets();
    const query = this.searchQuery().toLowerCase();
    const status = this.filterByStatus();
    const sort = this.sortBy();
    const summaryFilter = this.summaryFilterActive();

    // 1. Summary filter
    if (summaryFilter) {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      assets = assets.filter(asset => {
        switch (summaryFilter) {
          case 'total': return true;
          case 'planned': return asset.status === 'Plánovaná';
          case 'inOperation': return asset.status === 'V prevádzke';
          case 'inRepair': return asset.status === 'V oprave';
          case 'decommissioned': return asset.status === 'Vyradené';
          case 'dueIn30Days':
            const nextInspection = new Date(asset.nextInspectionDate);
            return nextInspection > now && nextInspection <= thirtyDaysFromNow;
          case 'inspectionsLastWeek':
            return asset.inspections.some(insp => new Date(insp.date) >= sevenDaysAgo);
          case 'newAssetsLastWeek':
            return new Date(asset.createdAt) >= sevenDaysAgo;
          default: return true;
        }
      });
    }

    // 2. Standard filters (applied on top of summary filter or standalone)
    if (query) {
      assets = assets.filter(asset =>
        asset.name.toLowerCase().includes(query) ||
        asset.serialNumber.toLowerCase().includes(query) ||
        asset.revisionNumber.toLowerCase().includes(query)
      );
    }

    if (status !== 'all') {
      assets = assets.filter(asset => asset.status === status);
    }
    
    // Advanced filters
    if(this.filterManufacturer()){
        assets = assets.filter(a => a.manufacturer.toLowerCase().includes(this.filterManufacturer().toLowerCase()));
    }
    if(this.filterType()){
        assets = assets.filter(a => a.type.toLowerCase().includes(this.filterType().toLowerCase()));
    }
    if(this.filterYear()){
        assets = assets.filter(a => a.year === this.filterYear());
    }
    if(this.filterLocation()){
        assets = assets.filter(a => a.location?.toLowerCase().includes(this.filterLocation().toLowerCase()));
    }
    if(this.filterCategory()){
        assets = assets.filter(a => a.category === this.filterCategory());
    }
    if(this.dateFilterStart()){
        assets = assets.filter(a => new Date(a.nextInspectionDate) >= new Date(this.dateFilterStart()));
    }
    if(this.dateFilterEnd()){
        assets = assets.filter(a => new Date(a.nextInspectionDate) <= new Date(this.dateFilterEnd()));
    }
    if (this.filterInspectionType() !== 'all') {
        assets = assets.filter(asset => asset.inspections.some(insp => insp.type === this.filterInspectionType()));
    }
    if (this.filterInspectionResult() !== 'all') {
        assets = assets.filter(asset => asset.inspections.some(insp => insp.overallResult === this.filterInspectionResult()));
    }

    // 3. Sorting
    return [...assets].sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      } else { // nextInspectionDate
        const dateA = a.nextInspectionDate ? new Date(a.nextInspectionDate) : null;
        const dateB = b.nextInspectionDate ? new Date(b.nextInspectionDate) : null;

        const isValidA = dateA && !isNaN(dateA.getTime());
        const isValidB = dateB && !isNaN(dateB.getTime());

        if (isValidA && isValidB) {
          const timeDiff = dateA.getTime() - dateB.getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.name.localeCompare(b.name); // secondary sort
        }
        
        if (isValidA && !isValidB) {
          return -1; // A has a date, B does not, so A comes first.
        }
        
        if (!isValidA && isValidB) {
          return 1; // B has a date, A does not, so B comes first.
        }
        
        // Neither has a valid date, sort by name
        return a.name.localeCompare(b.name);
      }
    });
  });

  assetSummary = computed(() => {
    const assets = this.assetService.assets();
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    return {
      total: assets.length,
      planned: assets.filter(a => a.status === 'Plánovaná').length,
      inOperation: assets.filter(a => a.status === 'V prevádzke').length,
      inRepair: assets.filter(a => a.status === 'V oprave').length,
      decommissioned: assets.filter(a => a.status === 'Vyradené').length,
      dueIn30Days: assets.filter(a => {
          const nextInspection = new Date(a.nextInspectionDate);
          return nextInspection > now && nextInspection <= thirtyDaysFromNow;
      }).length,
      inspectionsLastWeek: assets.reduce((acc, asset) => {
        return acc + asset.inspections.filter(insp => new Date(insp.date) >= sevenDaysAgo).length;
      }, 0),
      newAssetsLastWeek: assets.filter(a => new Date(a.createdAt) >= sevenDaysAgo).length,
    };
  });
  
  filteredUsers = computed(() => {
    const query = this.userSearchQuery().toLowerCase();
    if (!query) {
      return this.authService.users();
    }
    return this.authService.users().filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Computed properties for pagination
  totalPages = computed(() => {
    const total = this.filteredAndSortedAssets().length;
    const perPage = this.itemsPerPage();
    return Math.ceil(total / perPage);
  });

  paginatedAssets = computed(() => {
    const assets = this.filteredAndSortedAssets();
    const page = this.currentPage();
    const perPage = this.itemsPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return assets.slice(start, end);
  });

  paginationInfo = computed(() => {
    const total = this.filteredAndSortedAssets().length;
    const perPage = this.itemsPerPage();
    const page = this.currentPage();
    const totalP = this.totalPages();
    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(start + perPage - 1, total);
    return {
        start,
        end,
        total,
        hasPrevious: page > 1,
        hasNext: page < totalP,
    };
  });

  pages = computed((): (string | number)[] => {
    const total = this.totalPages();
    if (total <= 1) return [];
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current < 5) {
      return [1, 2, 3, 4, 5, '...', total];
    } else if (current > total - 4) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    } else {
      return [1, '...', current - 1, current, current + 1, '...', total];
    }
  });


  // Methods
  async login() {
    const result = await this.authService.login(this.username(), this.password());
    
    if (result.success) {
      this.loginError.set(null);
      this.username.set('');
      this.password.set('');
      this.viewMode.set('list'); // Go to main view on successful login
    } else {
      this.loginError.set(result.error || 'Neplatné prihlasovacie údaje.');
    }
  }

  async logout() {
    await this.authService.logout();
    this.viewMode.set('list');
  }

  // View navigation
  showList() {
    this.viewMode.set('list');
    this.selectedAsset.set(null);
    this.stopScanner();
  }

  showDetail(asset: Asset) {
    this.selectedAsset.set(asset);
    this.viewMode.set('detail');
  }

  showAddAssetForm() {
    if (!this.authService.canEdit()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.assetFormModel.set({
        protectionClass: 'I',
        usageGroup: 'A',
        category: 'Držané v ruke',
        status: 'Plánovaná',
        year: new Date().getFullYear(),
    });
    this.viewMode.set('assetForm');
  }

  showEditAssetForm(asset: Asset) {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.assetFormModel.set({ ...asset });
    this.viewMode.set('assetForm');
  }

  showAddInspectionForm(asset: Asset) {
    if (!this.authService.canEdit()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.selectedAsset.set(asset);
    const lastInstrument = this.settingsService.lastUsedInstrument();
    this.inspectionFormModel.set({
      date: new Date().toISOString().split('T')[0],
      inspector: this.authService.currentUser()?.fullName || '',
      type: 'Revízia',
      visualCheck: 'vyhovuje',
      functionalTest: 'vyhovuje',
      overallResult: 'vyhovuje',
      measuringInstrumentName: lastInstrument?.measuringInstrumentName || '',
      measuringInstrumentSerial: lastInstrument?.measuringInstrumentSerial || '',
      measuringInstrumentCalibDate: lastInstrument?.measuringInstrumentCalibDate || '',
    });
    this.viewMode.set('inspectionForm');
  }

  // CRUD operations
  async saveAsset() {
    if (!this.authService.canEdit()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.validateAssetForm(); // Re-run validation on submit
    if (!this.isAssetFormValid()) {
      this.showNotification('Formulár obsahuje chyby. Skontrolujte zadané údaje.', 'error');
      return;
    }

    const formValue = this.assetFormModel();
    const processedFormValue = {
        ...formValue,
        name: formValue.name?.trim(),
        revisionNumber: formValue.revisionNumber?.trim(),
        serialNumber: formValue.serialNumber?.trim(),
        manufacturer: formValue.manufacturer?.trim(),
        type: formValue.type?.trim(),
        location: formValue.location?.trim(),
        notes: formValue.notes?.trim()
    };

    try {
      if (processedFormValue.id) {
        await this.assetService.updateAsset(processedFormValue as Asset);
        this.showNotification('Spotrebič bol úspešne aktualizovaný.', 'success');
      } else {
        await this.assetService.addAsset(processedFormValue as any);
        this.showNotification('Spotrebič bol úspešne pridaný.', 'success');
      }

      this.showList();
      this.assetFormModel.set({});
    } catch (error) {
      console.error('Error saving asset:', error);
      this.showNotification('Chyba pri ukladaní spotrebiča. Skontrolujte konzolu pre viac detailov.', 'error');
    }
  }

  deleteAsset(id: string) {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    if (confirm('Naozaj si prajete odstrániť tento spotrebič?')) {
      this.assetService.deleteAsset(id);
      this.showNotification('Spotrebič bol úspešne odstránený.', 'success');
      this.showList();
    }
  }

  async saveInspection() {
    if (!this.authService.canEdit()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.validateInspectionForm(); // Re-run validation on submit
    if (!this.isInspectionFormValid()) {
        this.showNotification('Formulár obsahuje chyby. Skontrolujte zadané údaje.', 'error');
        return;
    }
    
    const inspection = this.inspectionFormModel();
    const assetId = this.selectedAsset()?.id;
    if (assetId) {
      try {
        const inspectionData = {
            ...inspection,
            inspector: inspection.inspector?.trim(),
            notes: inspection.notes?.trim(),
            type: inspection.type as 'Kontrola' | 'Revízia',
            visualCheck: inspection.visualCheck as unknown as 'vyhovuje' | 'nevyhovuje',
            functionalTest: inspection.functionalTest as 'vyhovuje' | 'nevyhovuje',
            overallResult: inspection.overallResult as unknown as 'vyhovuje' | 'nevyhovuje',
        };
        // After validation, we can confidently cast to the required type for `addInspection`.
        await this.assetService.addInspection(assetId, inspectionData as Omit<Inspection, 'id' | 'assetId'>);
        this.settingsService.updateLastUsedInstrument(inspectionData);
        this.showNotification('Revízny záznam bol úspešne pridaný.', 'success');
        
        // Wait for data to refresh, then update selected asset
        this.selectedAsset.set(this.assetService.assets().find(a => a.id === assetId) || null);
        this.viewMode.set('detail');
      } catch (error) {
        console.error('Error saving inspection:', error);
        this.showNotification('Chyba pri ukladaní revízneho záznamu.', 'error');
      }
    }
  }

  // Form model update handlers
  updateAssetFormField(key: keyof Asset, value: any) {
    this.assetFormModel.update(model => ({ ...model, [key]: value }));
  }

  updateInspectionFormField(key: keyof Inspection, value: any) {
    this.inspectionFormModel.update(model => ({ ...model, [key]: value }));
  }

  updateUserFormField(key: keyof User, value: any) {
      this.userFormModel.update(model => ({...model, [key]: value}));
  }

  updateOperatorInfoFormField(key: keyof OperatorInfo, value: any) {
      this.operatorInfoFormModel.update(model => ({...model, [key]: value}));
  }

  // Validation Methods
  private validateAssetForm() {
    const form = this.assetFormModel();
    const errors: {[key: string]: string} = {};

    if (!form.name || form.name.trim().length === 0) {
        errors['name'] = 'Názov je povinný.';
    } else if (form.name.trim().length < 3) {
        errors['name'] = 'Názov musí mať aspoň 3 znaky.';
    }

    if (!form.revisionNumber || form.revisionNumber.trim().length === 0) {
        errors['revisionNumber'] = 'Revízne číslo je povinné.';
    } else {
        const trimmedRevNum = form.revisionNumber.trim().toLowerCase();
        if (this.assetService.assets().some(a => a.revisionNumber.trim().toLowerCase() === trimmedRevNum && a.id !== form.id)) {
            errors['revisionNumber'] = 'Toto revízne číslo už existuje.';
        }
    }

    if (!form.serialNumber || form.serialNumber.trim().length === 0) {
        errors['serialNumber'] = 'Sériové číslo je povinné.';
    } else {
        const trimmedSerialNum = form.serialNumber.trim().toLowerCase();
        if (trimmedSerialNum !== 'n/a' && this.assetService.assets().some(a => a.serialNumber.trim().toLowerCase() === trimmedSerialNum && a.id !== form.id)) {
            errors['serialNumber'] = 'Toto sériové číslo už existuje.';
        }
    }
    
    const currentYear = new Date().getFullYear();
    if (form.year == null) { // Catches null and undefined
        errors['year'] = 'Rok výroby je povinný.';
    } else if (form.year < 1950 || form.year > currentYear) {
      errors['year'] = `Rok výroby musí byť medzi 1950 a ${currentYear}.`;
    }

    this.assetFormErrors.set(errors);
  }

  private validateInspectionForm() {
      const form = this.inspectionFormModel();
      const errors: {[key: string]: string} = {};

      if (!form.date) errors['date'] = 'Dátum je povinný.';
      else if (new Date(form.date) > new Date()) {
          errors['date'] = 'Dátum nemôže byť v budúcnosti.';
      }

      if (!form.inspector || form.inspector.trim().length < 3) {
          errors['inspector'] = 'Meno je povinné (min. 3 znaky).';
      }

      // Pre revíziu sú odpory povinné
      if (form.type === 'Revízia') {
          if (form.protectiveConductorResistance == null || form.protectiveConductorResistance === 0) {
              errors['protectiveConductorResistance'] = 'Odpor ochranného vodiča je povinný pre revíziu.';
          } else if (form.protectiveConductorResistance < 0) {
              errors['protectiveConductorResistance'] = 'Hodnota nemôže byť záporná.';
          }
          
          if (form.insulationResistance == null || form.insulationResistance === 0) {
              errors['insulationResistance'] = 'Izolačný odpor je povinný pre revíziu.';
          } else if (form.insulationResistance < 0) {
              errors['insulationResistance'] = 'Hodnota nemôže byť záporná.';
          }
      } else {
          // Pre kontrolu sú odpory voliteľné, len validujeme ak sú vyplnené
          if (form.protectiveConductorResistance != null && form.protectiveConductorResistance < 0) {
              errors['protectiveConductorResistance'] = 'Hodnota nemôže byť záporná.';
          }
          if (form.insulationResistance != null && form.insulationResistance < 0) {
              errors['insulationResistance'] = 'Hodnota nemôže byť záporná.';
          }
      }

      if (form.leakageCurrent != null && form.leakageCurrent < 0) {
          errors['leakageCurrent'] = 'Hodnota nemôže byť záporná.';
      }

      this.inspectionFormErrors.set(errors);
  }

  // QR Code Methods
  async showQrCode(asset: Asset) {
    this.selectedAsset.set(asset);
    if (typeof JsBarcode === 'undefined') {
      this.showNotification('Knižnica pre čiarové kódy sa ešte nenačítala. Skúste to o chvíľu znova.', 'error');
      return;
    }
    try {
      // Create canvas element
      const canvas = document.createElement('canvas');
      
      // Generate barcode from revision number
      JsBarcode(canvas, asset.revisionNumber, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10
      });
      
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');
      this.qrCodeDataUrl.set(dataUrl);
      this.isQrModalOpen.set(true);
    } catch (err) {
      console.error(err);
      this.showNotification('Nepodarilo sa vygenerovať čiarový kód.', 'error');
    }
  }
  
  startScanner() {
    this.viewMode.set('qrScanner');
    this.scannerStatus.set('scanning');
    this.scannerError.set(null);
    
    setTimeout(() => {
        if (this.scannerVideo?.nativeElement) {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: this.scannerVideo.nativeElement,
                    constraints: {
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "upc_reader"]
                },
                locate: true
            }, (err: any) => {
                if (err) {
                    console.error(err);
                    this.scannerStatus.set('error');
                    this.scannerError.set(`Chyba pri prístupe ku kamere: ${err.message || err}`);
                    return;
                }
                console.log('Scanner initialized successfully');
                this.scannerStatus.set('idle');
                Quagga.start();
                
                // Listen for detected barcodes
                Quagga.onDetected((result: any) => {
                    if (result && result.codeResult && result.codeResult.code) {
                        console.log('Barcode detected:', result.codeResult.code);
                        // Run inside Angular zone to trigger change detection
                        this.ngZone.run(() => {
                            this.handleQrScan(result.codeResult.code);
                        });
                    }
                });
            });
        }
    }, 100);
  }

  stopScanner() {
    try {
      Quagga.stop();
      Quagga.offDetected();
    } catch (e) {
      console.error('Error stopping scanner:', e);
    }
    this.scannerStatus.set('idle');
  }
  
  handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          Quagga.decodeSingle({
            src: e.target.result,
            numOfWorkers: 0,
            decoder: {
              readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "upc_reader"]
            }
          }, (result: any) => {
            if (result && result.codeResult) {
              this.handleQrScan(result.codeResult.code);
            } else {
              this.scannerStatus.set('error');
              this.scannerError.set('Čiarový kód nebol nájdený alebo ho nebolo možné prečítať.');
            }
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  private handleQrScan(qrData: string) {
    console.log('handleQrScan called with:', qrData);
    this.stopScanner();
    
    // Search by revision number instead of ID
    const asset = this.assetService.assets().find(a => a.revisionNumber === qrData);
    console.log('Found asset:', asset);
    
    if (asset) {
      this.scannerStatus.set('success');
      this.showNotification(`Nájdený spotrebič: ${asset.name}`, 'success');
      this.showDetail(asset);
    } else {
      this.scannerStatus.set('error');
      this.scannerError.set(`Spotrebič s revíznym číslom "${qrData}" nebol nájdený.`);
      // Optionally restart scanner after a delay
      setTimeout(() => { if(this.viewMode() === 'qrScanner') this.startScanner(); }, 2000);
    }
  }

  // Export and Import methods
  exportToJson() {
    const dataStr = JSON.stringify(this.assetService.assets(), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'evidencia_spotrebicov.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    this.showNotification('Databáza bola úspešne exportovaná.', 'success');
  }
  
  triggerImport() {
    document.getElementById('import-json-input')?.click();
  }

  importFromJson(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedAssets = JSON.parse(e.target?.result as string);
          // Simple validation
          if (Array.isArray(importedAssets) && importedAssets.every(item => 'id' in item && 'name' in item)) {
            this.assetService.replaceAllAssets(importedAssets);
            this.showNotification('Databáza bola úspešne importovaná.', 'success');
          } else {
            throw new Error('Neplatný formát súboru.');
          }
        } catch (error) {
           this.showNotification(`Chyba pri importe: ${error instanceof Error ? error.message : 'Neznáma chyba'}`, 'error');
        }
      };
      reader.readAsText(file);
    }
  }

  exportToCsv() {
    const assets = this.filteredAndSortedAssets();
    if (assets.length === 0) {
      this.showNotification('Žiadne dáta na export.', 'error');
      return;
    }
    const header = ["Revízne číslo", "Názov", "Typ", "Trieda ochrany", "Stav", "Výrobca", "Sériové číslo", "Rok", "Skupina", "Kategória", "Lokalita", "Dátum ďalšej kontroly"];
    const rows = assets.map(a => [
      a.revisionNumber, a.name, a.type, a.protectionClass, a.status, a.manufacturer, a.serialNumber, a.year, a.usageGroup, a.category, a.location || '', a.nextInspectionDate ? a.nextInspectionDate : 'Plánovaná'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    
    // Add BOM for UTF-8 support in Excel
    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "zoznam_spotrebicov.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showNotification('Zoznam bol úspešne exportovaný do CSV.', 'success');
  }

  async generatePdf(asset: Asset) {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;
    
    // Add custom font that supports Slovak characters
    await this.addCustomFonts(doc);
    doc.setFont('NotoSans');

    this.generatePdfContent(doc, asset);
    
    doc.save(`karta_spotrebica_${asset.revisionNumber}.pdf`);
    this.showNotification(`PDF pre ${asset.name} bolo vygenerované.`, 'success');
  }
  
  async generateAllPdf() {
    const assets = this.filteredAndSortedAssets();
    if (assets.length === 0) {
        this.showNotification('Žiadne spotrebiče na export.', 'error');
        return;
    }
    
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;
    await this.addCustomFonts(doc);
    doc.setFont('NotoSans');

    assets.forEach((asset, index) => {
        this.generatePdfContent(doc, asset);
        if (index < assets.length - 1) {
            doc.addPage();
        }
    });

    doc.save('vsetky_spotrebice.pdf');
    this.showNotification('PDF pre všetky spotrebiče bolo vygenerované.', 'success');
  }

  private async addCustomFonts(doc: jsPDFWithAutoTable) {
    // This is a simplified example. For production, you'd host the font file.
    // We'll use a base64 encoded string of a font like Noto Sans.
    // For this example, we rely on standard fonts, but this is where you'd add it.
    // As jsPDF built-in fonts don't support Slovak chars well, the text might have issues.
    // The proper way is doc.addFileToVFS and doc.addFont.
    // Let's proceed with a standard font for now as adding a full font is complex for this environment.
  }

  private generatePdfContent(doc: jsPDFWithAutoTable, asset: Asset) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // 1. HEADER
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(this.removeDiacritics('KARTA ELEKTRICKÉHO SPOTREBIČA / NÁRADIA'), pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(this.removeDiacritics('(v zmysle STN 33 1630)'), pageWidth / 2, 26, { align: 'center' });

    // OPERATOR DETAILS
    const operatorInfo = this.settingsService.operatorInfo();
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(this.removeDiacritics('Prevádzkovateľ:'), 14, 40);
    doc.setFont(undefined, 'normal');
    doc.text(this.removeDiacritics(operatorInfo.name), 14, 45);
    doc.text(this.removeDiacritics(operatorInfo.address), 14, 50);
    doc.text(`ICO: ${this.removeDiacritics(operatorInfo.ico)}`, 14, 55);

    // 2. ASSET DETAILS
    const assetDetails = [
      { label: this.removeDiacritics('Názov spotrebiča'), value: this.removeDiacritics(asset.name) },
      { label: this.removeDiacritics('Inventárne (revízne) číslo'), value: this.removeDiacritics(asset.revisionNumber) },
      { label: this.removeDiacritics('Výrobca'), value: this.removeDiacritics(asset.manufacturer) },
      { label: this.removeDiacritics('Typ / Model'), value: this.removeDiacritics(asset.type) },
      { label: this.removeDiacritics('Výrobné číslo'), value: this.removeDiacritics(asset.serialNumber) },
      { label: this.removeDiacritics('Rok výroby'), value: String(asset.year) },
      { label: this.removeDiacritics('Trieda ochrany'), value: asset.protectionClass },
      { label: this.removeDiacritics('Skupina používania'), value: this.removeDiacritics(`${asset.usageGroup} - ${this.getUsageGroupTooltip(asset.usageGroup)}`) },
      { label: this.removeDiacritics('Druh spotrebiča'), value: this.removeDiacritics(asset.category) },
      { label: this.removeDiacritics('Umiestnenie'), value: this.removeDiacritics(asset.location || 'N/A') },
      { label: this.removeDiacritics('DÁTUM NASLEDUJÚCEJ KONTROLY'), value: asset.nextInspectionDate ? (this.datePipe.transform(asset.nextInspectionDate, 'dd.MM.yyyy') ?? '') : this.removeDiacritics('Plánovaná') }
    ];

    (doc as any).autoTable({
      startY: 65,
      body: assetDetails.map(row => [row.label, row.value]),
      theme: 'grid',
      styles: { font: 'NotoSans' },
      didParseCell: (data: any) => {
        if (data.row.index === assetDetails.length - 1) { // Last row is the next inspection date
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 0) {
            data.cell.styles.textColor = '#d9480f';
          }
          if (data.column.index === 1) {
            data.cell.styles.textColor = '#d9480f';
          }
        }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY;

    // 3. INSPECTIONS HISTORY
    if (asset.inspections.length > 0) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(this.removeDiacritics('ZÁZNAMY O VYKONANÝCH KONTROLÁCH A REVÍZIÁCH'), 14, finalY + 15);
      finalY += 20;

      const sortedInspections = [...asset.inspections].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const inspection of sortedInspections) {
        if (finalY > pageHeight - 90) { // Check for page break before drawing new table
            doc.addPage();
            finalY = 20;
        }

        const inspectionData = [
          { label: this.removeDiacritics('Vizuálna kontrola'), value: this.removeDiacritics(inspection.visualCheck) },
        ];
        
        if (asset.protectionClass === 'I') {
          inspectionData.push({ label: this.removeDiacritics('Odpor ochr. vodica [Ohm]'), value: inspection.protectiveConductorResistance != null ? String(inspection.protectiveConductorResistance) : 'N/A' });
        }
        
        inspectionData.push(
          { label: this.removeDiacritics('Izolačný odpor [MOhm]'), value: inspection.insulationResistance != null ? String(inspection.insulationResistance) : 'N/A' },
          { label: this.removeDiacritics('Unikajúci prúd [mA]'), value: inspection.leakageCurrent != null ? String(inspection.leakageCurrent) : 'N/A' },
          { label: this.removeDiacritics('Funkčná skúška'), value: this.removeDiacritics(inspection.functionalTest) },
          { label: this.removeDiacritics('Celkový výsledok'), value: this.removeDiacritics(inspection.overallResult.toUpperCase()) },
          { label: this.removeDiacritics('Dátum vykonania'), value: this.datePipe.transform(inspection.date, 'dd.MM.yyyy') ?? '' },
          { label: this.removeDiacritics('Vykonal'), value: this.removeDiacritics(inspection.inspector) },
          ...(inspection.measuringInstrumentName ? [{ label: this.removeDiacritics('Merací prístroj'), value: this.removeDiacritics(`${inspection.measuringInstrumentName} (S/N: ${inspection.measuringInstrumentSerial || 'N/A'})`) }] : []),
          { label: this.removeDiacritics('Poznámka'), value: this.removeDiacritics(inspection.notes || '') }
        );
        
        (doc as any).autoTable({
          startY: finalY + 5,
          head: [[
            { content: this.removeDiacritics(`Záznam: ${inspection.type}`), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: '#f8f9fa' } }
          ]],
          body: inspectionData.map(r => [r.label, r.value]),
          theme: 'grid',
          styles: { font: 'NotoSans' },
          didParseCell: (data: any) => {
              if (data.section === 'body' && data.row.raw[0] === this.removeDiacritics('Celkový výsledok')) {
                  if (data.column.index === 1) { // value column
                      data.cell.styles.fontStyle = 'bold';
                      if (data.cell.raw === 'VYHOVUJE') {
                          data.cell.styles.textColor = '#28a745'; // green
                      } else {
                          data.cell.styles.textColor = '#dc3545'; // red
                      }
                  }
              }
          }
        });
        
        finalY = (doc as any).lastAutoTable.finalY;
        
        // Add space for signature
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(this.removeDiacritics('Podpis:'), pageWidth - 80, finalY + 10);
        doc.line(pageWidth - 65, finalY + 9.5, pageWidth - 14, finalY + 9.5); // Draw a line for signature
        finalY += 15; // update finalY to account for the signature space
      }
    } else {
        doc.text(this.removeDiacritics('Žiadne záznamy o kontrolách.'), 14, finalY + 15);
    }
    
    // Add footer with page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(this.removeDiacritics(`Strana ${i} z ${pageCount}`), 14, pageHeight - 10);
        doc.text(this.removeDiacritics(`Vygenerované: ${this.datePipe.transform(new Date(), 'dd.MM.yyyy HH:mm')}`), pageWidth - 14, pageHeight - 10, { align: 'right'});
    }
  }
  
  // User Management
  showUserManagement() {
      if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
      }
      this.viewMode.set('userManagement');
  }

  showEditUserForm(user: User) {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    // Only fullName can be edited
    this.userFormModel.set({ 
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    });
    this.isUserFormModalOpen.set(true);
  }

  async saveUser() {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    const user = this.userFormModel();
    if (!user.id || !user.fullName) {
        this.showNotification('Vyplňte celé meno.', 'error');
        return;
    }

    try {
      const result = await this.authService.updateUser(user.id, user.fullName);

      if (result.success) {
        this.showNotification(`Používateľ ${user.username} bol úspešne aktualizovaný.`, 'success');
        this.isUserFormModalOpen.set(false);
      } else {
        this.showNotification(result.error || 'Neznáma chyba.', 'error');
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      this.showNotification(error.message || 'Chyba pri ukladaní používateľa.', 'error');
    }
  }

  deleteUser(user: User) {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.userToDelete.set(user);
  }

  async confirmDeleteUser() {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    if (this.userToDelete()) {
        if (this.userToDelete()?.id === this.authService.currentUser()?.id) {
            this.showNotification('Nemôžete odstrániť svoj vlastný účet.', 'error');
            this.userToDelete.set(null);
            return;
        }
        
        const result = await this.authService.deleteUser(this.userToDelete()!.id);
        
        if (result.success) {
          this.showNotification(`Používateľ ${this.userToDelete()?.username} bol odstránený.`, 'success');
        } else {
          this.showNotification(result.error || 'Chyba pri odstraňovaní používateľa.', 'error');
        }
        
        this.userToDelete.set(null);
    }
  }

  cancelDeleteUser() {
    this.userToDelete.set(null);
  }

  // Settings Management
  showSettingsModal() {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.operatorInfoFormModel.set({ ...this.settingsService.operatorInfo() });
    this.isSettingsModalOpen.set(true);
  }

  saveSettings() {
    if (!this.authService.isAdmin()) {
        this.showNotification('Na túto akciu nemáte oprávnenie.', 'error');
        return;
    }
    this.settingsService.updateOperatorInfo(this.operatorInfoFormModel());
    this.isSettingsModalOpen.set(false);
    this.showNotification('Údaje o prevádzkovateľovi boli úspešne uložené.', 'success');
  }


  // Filter methods
  applySummaryFilter(filter: SummaryFilter) {
    if (this.summaryFilterActive() === filter) {
      this.summaryFilterActive.set(null); // Toggle off if clicked again
    } else {
      this.summaryFilterActive.set(filter);
    }
  }
  
  resetAdvancedFilters() {
      this.filterManufacturer.set('');
      this.filterType.set('');
      this.filterYear.set(null);
      this.filterLocation.set('');
      this.filterCategory.set('');
      this.dateFilterStart.set('');
      this.dateFilterEnd.set('');
      this.filterInspectionType.set('all');
      this.filterInspectionResult.set('all');
      this.showAdvancedFilters.set(false);
  }

  // Pagination methods
  goToPage(page: number | string) {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
        this.currentPage.set(page);
    }
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  // Offline storage
  saveForOffline() {
    if (this.assetService.forceSaveToLocalStorage()) {
      this.showNotification('Dáta boli úspešne uložené pre offline prístup.', 'success');
    } else {
      this.showNotification('Nepodarilo sa uložiť dáta. Skontrolujte oprávnenia prehliadača.', 'error');
    }
  }


  // UI Helpers
  showNotification(message: string, type: 'success' | 'error') {
    this.notification.set({ message, type });
    setTimeout(() => this.notification.set(null), 5000);
  }

  private removeDiacritics(str: string | null | undefined): string {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  getInspectionUrgencyStatus(asset: Asset): 'ok' | 'dueSoon' | 'overdue' | 'planned' {
    if (!asset.nextInspectionDate) {
        return 'planned';
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalizácia na začiatok dňa
    const inspectionDate = new Date(asset.nextInspectionDate);
    
    if (isNaN(inspectionDate.getTime())) {
        return 'planned';
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    if (inspectionDate < now) {
        return 'overdue';
    }

    if (inspectionDate <= thirtyDaysFromNow) {
        return 'dueSoon';
    }

    return 'ok';
  }

  getProtectionClassTooltip(pClass: 'I' | 'II' | 'III'): string {
    const tooltips = {
      'I': 'Trieda I: Ochrana základnou izoláciou a spojením s ochranným vodičom.',
      'II': 'Trieda II: Ochrana dvojitou alebo zosilnenou izoláciou.',
      'III': 'Trieda III: Ochrana bezpečným malým napätím (SELV).'
    };
    return tooltips[pClass];
  }

  getUsageGroupTooltip(group: 'A' | 'B' | 'C' | 'D' | 'E'): string {
    const tooltips = {
      'A': 'Skupina A: Spotrebiče a/alebo predlžovacie prívody poskytované formou prenájmu ďalšiemu prevádzkovateľovi alebo používateľovi.',
      'B': 'Skupina B: Spotrebiče a/alebo predlžovacie prívody používané vo vonkajšom prostredí (napr. na stavbách, pri poľnohospodárskych prácach, remeselných prácach a pod.) alebo vo vnútornom prostredí s vonkajším vplyvom vody AD3 a vyšším.',
      'C': 'Skupina C: Spotrebiče a/alebo predlžovacie prívody používané vo vnútorných priestoroch (napr. pri priemyselnej, remeselnej, obchodnej činnosti, spotrebiče v kuchynkách a pod.).',
      'D': 'Skupina D: Spotrebiče a/alebo predlžovacie prívody používané vo vnútorných verejne prístupných priestoroch (školy, kluby, hotely, penzióny, zdravotnícke objekty, objekty sociálnych služieb a pod.).',
      'E': 'Skupina E: Spotrebiče a/alebo predlžovacie prívody používané pri administratívnej, kancelárskej činnosti.'
    };
    return tooltips[group];
  }

  getCategoryTooltip(category: 'Držané v ruke' | 'Ostatné' | 'Predlžovací prívod'): string {
    const tooltips = {
      'Držané v ruke': 'Spotrebiče, ktoré sa počas bežného používania držia v ruke (napr. vŕtačky, brúsky, sušiče vlasov).',
      'Ostatné': 'Spotrebiče, ktoré nie sú držané v ruke, napr. stacionárne (chladničky), prenosné (monitory, tlačiarne) alebo pripevnené.',
      'Predlžovací prívod': 'Samostatné predlžovacie káble, káblové bubny a odpojiteľné prívody.'
    };
    return tooltips[category];
  }
}
