import type { Building } from "./types";

export function supportsBuildingUnits(building: Building): boolean {
  return building.type === "burglary" || building.type === "residence";
}
