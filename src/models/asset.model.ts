export interface Inspection {
  id: string;
  assetId: string;
  date: string;
  inspector: string;
  type: 'Kontrola' | 'Revízia';
  visualCheck: 'vyhovuje' | 'nevyhovuje';
  protectiveConductorResistance?: number | null;
  insulationResistance?: number | null;
  leakageCurrent?: number | null;
  functionalTest: 'vyhovuje' | 'nevyhovuje';
  overallResult: 'vyhovuje' | 'nevyhovuje';
  notes?: string;
  measuringInstrumentName?: string;
  measuringInstrumentSerial?: string;
  measuringInstrumentCalibDate?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  revisionNumber: string;
  manufacturer: string;
  year: number;
  protectionClass: 'I' | 'II' | 'III';
  usageGroup: 'A' | 'B' | 'C' | 'D' | 'E';
  category: 'Držané v ruke' | 'Ostatné' | 'Predlžovací prívod';
  status: 'V prevádzke' | 'V oprave' | 'Vyradené' | 'Plánovaná';
  nextInspectionDate: string;
  inspections: Inspection[];
  createdAt: string;
  location?: string;
  notes?: string;
}
