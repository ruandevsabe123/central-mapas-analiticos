import type { AppData, AnalyticalMap, Entity } from "./types";
export const uid = () => crypto.randomUUID();
export function createDemoData(): AppData {
  return {
    categories: [],
    sectors: [],
    operations: [],
    mapTypes: [],
    templates: [],
    maps: [],
    printItems: [],
    presets: [],
    initialized: true,
  };
}
export function renderLegend(
  template: string,
  map: Partial<AnalyticalMap>,
  data: AppData,
) {
  const find = (items: Entity[], id?: string) =>
    items.find((x) => x.id === id)?.name ?? "";
  const now = new Date();
  const values: Record<string, string> = {
    categoria: find(data.categories, map.categoryId),
    setor: find(data.sectors, map.sectorId),
    operacao: find(data.operations, map.operationId),
    tipoMapa: find(data.mapTypes, map.mapTypeId),
    frota: map.fleet ?? "",
    equipamento: map.equipment ?? "",
    observacao: map.notes ?? "",
    turno: "",
    data: now.toLocaleDateString("pt-BR"),
    horario: now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    ...(map.customFields ?? {}),
  };
  return template
    .replace(/\{([^}]+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
    .replace(/^\s*\n/gm, "")
    .trim();
}
