import type { BuildingType, MarkerType, RoadType, TerrainType, ZoneType } from "./types";

export const markerColors: Record<MarkerType, string> = {
  institution: "#3B82F6",
  shop: "#22C55E",
  npc: "#FFFFFF",
  garage: "#14B8A6",
  landmark: "#F59E0B",
  content: "#6366F1",
  bus_stop: "#0EA5E9",
  gas_station: "#D97706",
};

export const terrainColors: Record<TerrainType, string> = {
  mountain: "#4F7A52",
  beach: "#D6B76B",
  lake: "#3B82F6",
  city: "#9CA3AF",
};

export const zoneColors: Record<ZoneType, string> = {
  jurisdiction: "#8B5CF6",
  safe_zone: "#22C55E",
  pvp_zone: "#EF4444",
};

export const roadStyles: Record<RoadType, { color: string; width: number }> = {
  highway: { color: "#E74C3C", width: 36 },
  expressway: { color: "#F39C12", width: 24 },
  national_road: { color: "#3498DB", width: 16 },
};

export const buildingColors: Record<BuildingType, string> = {
  institution: "#3B82F6",
  shop: "#22C55E",
  residence: "#64748B",
  other: "#9CA3AF",
};
