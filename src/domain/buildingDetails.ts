import type { Building, MapProject } from "./types";

export function buildingDetails(project: MapProject, building: Building) {
  return [...project.institutions, ...project.shops, ...project.npcs, ...project.facilities].filter(detail =>
    detail.id === building.entityRef || ("location" in detail && detail.location?.type === "building" && detail.location.buildingRef === building.id),
  );
}

