import type { ViewerVisibility } from "./types";

export type ViewerAudience = keyof ViewerVisibility;

export function viewerAudience(pathname: string, baseUrl: string): ViewerAudience {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return relative.split("/")[0] === "medical_institution" ? "medical_institution" : "law_enforcement";
}

export function visibleInViewer(feature: { viewerVisibility?: ViewerVisibility }, audience: ViewerAudience): boolean {
  return feature.viewerVisibility?.[audience] === true;
}

