import type { shopTypes } from "./schemas";

export type TerrainType = "mountain" | "beach" | "lake" | "city";
export type ZoneType = "jurisdiction" | "safe_zone" | "pvp_zone";
export type RoadType = "highway" | "expressway" | "national_road";
export type BuildingType = "institution" | "shop" | "residence" | "burglary" | "landmark" | "terminal" | "content";
export type MarkerType =
  | "institution"
  | "shop"
  | "npc"
  | "garage"
  | "landmark"
  | "content"
  | "terminal"
  | "gas_station";

export type Position = readonly [number, number];

export type PolygonGeometry = { type: "Polygon"; coordinates: readonly (readonly Position[])[] };
export type LineGeometry = { type: "LineString"; coordinates: readonly Position[] };
export type PointGeometry = { type: "Point"; coordinates: Position };

export type Terrain = {
  bannerRef?: string;
  description?: string;
  id: string;
  type: TerrainType;
  name?: string;
  geometry: PolygonGeometry;
};

export type Zone = {
  bannerRef?: string;
  description?: string;
  id: string;
  type: ZoneType;
  name?: string;
  geometry: PolygonGeometry;
};

export type Road = {
  id: string;
  type: RoadType;
  name?: string;
  width: number;
  color?: string;
  geometry: LineGeometry;
};

export type Building = {
  bannerRef?: string;
  description?: string;
  color?: string;
  iconRef?: string;
  id: string;
  type: BuildingType;
  name?: string;
  postalCode?: string;
  entityRef?: string;
  geometry: PolygonGeometry;
  isBurglaryTarget?: boolean;
  isPurchasable?: boolean;
  units?: ResidenceUnit[];
};

export type ResidenceUnit = {
  id: string;
  houseNumber?: string;
  description?: string;
  entrances: PointGeometry[];
  geometry?: PolygonGeometry;
};

export type MapMarker = {
  id: string;
  type: MarkerType;
  name?: string;
  geometry: PointGeometry;
  color?: string;
  size?: number;
  iconRef?: string;
  bannerRef?: string;
  entityRef?: string;
  shopType?: ShopType;
};

export type CustomField = { label: string; value: string };
export type DetailLocation = { type: "building"; buildingRef: string } | { type: "free_text"; text: string };
export type Institution = { id: string; type: "institution"; name?: string; description?: string; customFields?: readonly CustomField[] };
export type ShopType = (typeof shopTypes)[number];
export type Shop = { id: string; type: ShopType; name?: string; description?: string; items?: readonly string[]; customFields?: readonly CustomField[] };
export type Npc = { id: string; type: "npc"; name?: string; description?: string; quests?: readonly string[]; location?: DetailLocation; customFields?: readonly CustomField[] };
export type FacilityType = "garage" | "landmark" | "content" | "terminal" | "gas_station";
export type Facility = { id: string; type: FacilityType; name?: string; description?: string; location?: DetailLocation; customFields?: readonly CustomField[] };

export type MapTileProvider = (level: number, x: number, y: number) => Promise<string | null>;

export type ProjectIcon = {
  id: string;
  originalFileName: string;
  filePath: string;
  format: "png" | "jpg" | "webp";
  fileSize: number;
  sha256: string;
  url?: string;
  pendingFile?: File;
};

export type MapProject = {
  projectName: string;
  icons?: ProjectIcon[];
  image: { url: string; previewUrl?: string; tileUrlTemplate?: string; tileProvider?: MapTileProvider; width: number; height: number };
  terrain: Terrain[];
  zones: Zone[];
  roads: Road[];
  buildings: Building[];
  markers: MapMarker[];
  institutions: Institution[];
  shops: Shop[];
  npcs: Npc[];
  facilities: Facility[];
};
