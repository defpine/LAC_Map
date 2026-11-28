import type { MapProject } from "./types";

// This preview data keeps the Viewer usable before an administrator connects a
// real MyMapProject folder in the Editor.
export const demoProject: MapProject = {
  projectName: "FiveM LAC 서버 지도 (법 집행 기관용)",
  image: { url: "/assets/maps/map_000001.png", tileUrlTemplate: "/assets/maps/tiles/map_000001/level_{level}/{x}_{y}.png", width: 8192, height: 12288 },
  terrain: [
    {
      id: "terrain_000001",
      type: "mountain",
      name: "북부 산악 지대",
      geometry: { type: "Polygon", coordinates: [[[0.08, 0.18], [0.30, 0.08], [0.40, 0.27], [0.24, 0.38], [0.08, 0.18]]] },
    },
    {
      id: "terrain_000002",
      type: "lake",
      name: "알라모 호수",
      geometry: { type: "Polygon", coordinates: [[[0.63, 0.18], [0.83, 0.19], [0.86, 0.34], [0.67, 0.38], [0.63, 0.18]]] },
    },
  ],
  zones: [
    {
      id: "zone_000001",
      type: "safe_zone",
      name: "중앙 안전 구역",
      geometry: { type: "Polygon", coordinates: [[[0.36, 0.45], [0.61, 0.45], [0.61, 0.68], [0.36, 0.68], [0.36, 0.45]]] },
    },
  ],
  roads: [
    {
      id: "road_000001",
      type: "highway",
      name: "센트럴 하이웨이",
      width: 36,
      geometry: { type: "LineString", coordinates: [[0.05, 0.78], [0.30, 0.61], [0.54, 0.56], [0.94, 0.37]] },
    },
  ],
  buildings: [
    {
      id: "building_000001",
      type: "shop",
      name: "의류점",
      postalCode: "0123",
      geometry: { type: "Polygon", coordinates: [[[0.47, 0.52], [0.52, 0.52], [0.52, 0.57], [0.47, 0.57], [0.47, 0.52]]] },
    },
  ],
  markers: [],
  institutions: [],
  shops: [],
  npcs: [],
  facilities: [],
};
