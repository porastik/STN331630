import { Injectable, signal, effect } from '@angular/core';
import { OperatorInfo, LastUsedInstrument } from '../models/settings.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly LOCAL_STORAGE_KEY = 'evidencia-settings';

  private _operatorInfo = signal<OperatorInfo>({ name: '', address: '', ico: '' });
  public operatorInfo = this._operatorInfo.asReadonly();

  private _lastUsedInstrument = signal<LastUsedInstrument | null>(null);
  public lastUsedInstrument = this._lastUsedInstrument.asReadonly();

  constructor() {
    this.loadSettingsFromStorage();

    effect(() => {
      try {
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify({ 
          operatorInfo: this._operatorInfo(),
          lastUsedInstrument: this._lastUsedInstrument() 
        }));
      } catch (e) {
        console.error('Error saving settings to localStorage', e);
      }
    });
  }

  private loadSettingsFromStorage(): void {
    try {
      const savedSettings = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.operatorInfo) {
          this._operatorInfo.set(parsed.operatorInfo);
        }
        if (parsed.lastUsedInstrument) {
          this._lastUsedInstrument.set(parsed.lastUsedInstrument);
        }
      } else {
        // Provide default placeholder data if none is found
        this._operatorInfo.set({
          name: 'Názov vašej firmy',
          address: 'Vaša Adresa 123, Mesto, PSČ',
          ico: '12345678'
        });
      }
    } catch (e) {
      console.error('Error loading settings from localStorage.', e);
       this._operatorInfo.set({
          name: 'Názov vašej firmy',
          address: 'Vaša Adresa 123, Mesto, PSČ',
          ico: '12345678'
        });
    }
  }

  updateOperatorInfo(info: OperatorInfo) {
    this._operatorInfo.set(info);
  }

  updateLastUsedInstrument(instrumentData: {
    measuringInstrumentName?: string;
    measuringInstrumentSerial?: string;
    measuringInstrumentCalibDate?: string;
  }): void {
    if (instrumentData.measuringInstrumentName || instrumentData.measuringInstrumentSerial || instrumentData.measuringInstrumentCalibDate) {
      this._lastUsedInstrument.set({
        measuringInstrumentName: instrumentData.measuringInstrumentName,
        measuringInstrumentSerial: instrumentData.measuringInstrumentSerial,
        measuringInstrumentCalibDate: instrumentData.measuringInstrumentCalibDate,
      });
    }
  }
}
