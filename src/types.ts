export type Entity = {
  id: string;
  name: string;
  active: boolean;
  order: number;
};
export type LegendTemplate = Entity & {
  content: string;
  favorite: boolean;
  isDefault?: boolean;
};
export type Capture = {
  id: string;
  dataUrl: string;
  fileName: string;
  capturedAt: string;
  source: "upload" | "clipboard";
};
export type EquipmentAverage = {
  equipment: string;
  average: string;
  unit: string;
};
export type ExtractedPrintData = {
  rawText: string;
  detectedMapType: string;
  detectedSector: string;
  detectedOperation: string;
  detectedDateRange: string;
  equipmentAverages: EquipmentAverage[];
  warnings: string[];
};
export type PrintLegendItem = {
  id: string;
  categoryId: string;
  sectorId: string;
  operationId: string;
  mapTypeId: string;
  shift: string;
  categoryName?: string;
  sectorName?: string;
  operationName?: string;
  mapTypeName?: string;
  mainImage: string;
  summaryImage: string;
  extractedData: ExtractedPrintData;
  generatedLegend: string;
  finalLegend: string;
  scheduledTime?: string;
  sentAt?: string;
  status?: "pending_review" | "ready";
  areaPeriod?: "shift" | "total";
  createdAt: string;
  updatedAt: string;
};
export type MapPreset = {
  id: string;
  name: string;
  category: string;
  sector: string;
  operation: string;
  mapType: string;
  unit: string;
};
export type AnalyticalMap = {
  id: string;
  name: string;
  categoryId: string;
  sectorId: string;
  operationId: string;
  mapTypeId: string;
  fleet: string;
  equipment: string;
  notes: string;
  favorite: boolean;
  legendTemplateId: string;
  generatedLegend: string;
  finalLegend: string;
  customFields: Record<string, string>;
  captures: Capture[];
  createdAt: string;
  updatedAt: string;
};
export type AppData = {
  categories: Entity[];
  sectors: Entity[];
  operations: Entity[];
  mapTypes: Entity[];
  templates: LegendTemplate[];
  maps: AnalyticalMap[];
  printItems: PrintLegendItem[];
  presets: MapPreset[];
  initialized: boolean;
};
export type CollectionKey =
  "categories" | "sectors" | "operations" | "mapTypes";
