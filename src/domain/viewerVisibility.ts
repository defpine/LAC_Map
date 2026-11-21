import type { ViewerVisibility } from "./types";

export type ViewerAudience = keyof ViewerVisibility;

export function viewerTitle(pathname: string, baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const page = pathname.startsWith(base) ? pathname.slice(base.length).split("/")[0] : "";
  if (page === "law_enforcement") return "FiveM LAC 공무 지도 (법 집행 기관)";
  if (page === "medical_institution") return "FiveM LAC 공무 지도 (의료 기관)";
  return "FiveM LAC 공무 지도";
}

export function viewerAudience(pathname: string, baseUrl: string): ViewerAudience {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return relative.split("/")[0] === "medical_institution" ? "medical_institution" : "law_enforcement";
}

export function visibleInViewer(feature: { viewerVisibility?: ViewerVisibility }, audience: ViewerAudience): boolean {
  return feature.viewerVisibility?.[audience] === true;
}

