import { z } from "zod";

const position = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const pointGeometry = z.object({ type: z.literal("Point"), coordinates: position });
const lineGeometry = z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2) });
const polygonGeometry = z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(position).min(4)).min(1) });
const customFields = z.array(z.object({ label: z.string(), value: z.string() })).optional();
const location = z.discriminatedUnion("type", [z.object({ type: z.literal("building"), buildingRef: z.string() }), z.object({ type: z.literal("free_text"), text: z.string() })]).optional();

export const projectFileSchema = z.object({
  projectName: z.string().min(1),
  currentMapImageRef: z.string().regex(/^map_\d{6}$/),
  mapImages: z.array(z.object({
    id: z.string().regex(/^map_\d{6}$/),
    filePath: z.string().min(1),
    previewFilePath: z.string().min(1).optional(),
    tileDirectory: z.string().min(1).optional(),
    width: z.number().int().positive().max(16384),
    height: z.number().int().positive().max(16384),
  }).passthrough()).min(1),
}).passthrough();

export const geographyFileSchema = z.object({
  terrain: z.array(z.object({ id: z.string(), type: z.enum(["mountain", "beach", "lake", "city"]), name: z.string().optional(), geometry: polygonGeometry }).passthrough()),
  zones: z.array(z.object({ id: z.string(), type: z.enum(["jurisdiction", "safe_zone", "pvp_zone"]), name: z.string().optional(), geometry: polygonGeometry }).passthrough()),
  roads: z.array(z.object({ id: z.string(), type: z.enum(["highway", "expressway", "national_road"]), name: z.string().optional(), width: z.number().int().min(4).max(100), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), geometry: lineGeometry }).passthrough()),
});

export const buildingsFileSchema = z.object({
  buildings: z.array(z.object({
    id: z.string(), type: z.enum(["institution", "shop", "residence", "other"]), name: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), iconRef: z.string().optional(), postalCode: z.string().min(1).optional(), entityRef: z.string().optional(), isBurglaryTarget: z.boolean().optional(), isPurchasable: z.boolean().optional(), units: z.array(z.object({ id: z.string(), houseNumber: z.string().optional(), entrances: z.array(pointGeometry) })).optional(), geometry: polygonGeometry,
  }).passthrough()),
});

export const markersFileSchema = z.object({
  markers: z.array(z.object({
    id: z.string(), type: z.enum(["institution", "shop", "npc", "garage", "landmark", "content", "bus_stop", "gas_station"]),
    name: z.string().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), size: z.number().int().min(20).max(48).optional(),
    iconRef: z.string().optional(), bannerRef: z.string().optional(), entityRef: z.string().optional(), shopType: z.enum(["clothing", "convenience", "restaurant", "bar", "club", "street_vendor", "gun_store", "car_dealership", "jewelry_store", "premium_shop"]).optional(), geometry: pointGeometry,
  }).passthrough()),
});

export const iconsFileSchema = z.object({ images: z.array(z.object({
  id: z.string().regex(/^image_\d{6}$/),
  originalFileName: z.string().min(1),
  filePath: z.string().regex(/^Assets\/images\/(icons|banners)\/image_\d{6}\.(png|jpg|webp)$/),
  format: z.enum(["png", "jpg", "webp"]),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
}).passthrough()) }).passthrough();

export const institutionsFileSchema = z.object({ institutions: z.array(z.object({ id: z.string(), type: z.literal("institution").default("institution"), name: z.string().optional(), description: z.string().optional(), customFields }).passthrough()) });
export const shopsFileSchema = z.object({ shops: z.array(z.object({ id: z.string(), type: z.enum(["clothing", "convenience", "restaurant", "bar", "club", "street_vendor", "gun_store", "car_dealership", "jewelry_store", "premium_shop"]), name: z.string().optional(), description: z.string().optional(), items: z.array(z.string()).optional(), customFields }).passthrough()) });
export const npcsFileSchema = z.object({ npcs: z.array(z.object({ id: z.string(), type: z.literal("npc").default("npc"), name: z.string().optional(), description: z.string().optional(), quests: z.array(z.string()).optional(), location, customFields }).passthrough()) });
export const facilitiesFileSchema = z.object({ facilities: z.array(z.object({ id: z.string(), type: z.enum(["garage", "landmark", "content", "bus_stop", "gas_station"]), name: z.string().optional(), description: z.string().optional(), location, customFields }).passthrough()) });

