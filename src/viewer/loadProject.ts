import * as schemas from "../domain/schemas";
import type { MapProject } from "../domain/types";

export const assetUrl = (path: string) => {
  const clean = path.replaceAll("\\", "/");
  if (clean.startsWith("/") || clean.includes(":") || clean.split("/").includes("..")) throw new Error(`잘못된 정적 파일 경로: ${path}`);
  return `${import.meta.env.BASE_URL}${clean}`;
};
async function read<T>(name: string, schema: { parse(value: unknown): T }, signal: AbortSignal, version: string): Promise<T> {
  const response = await fetch(`${assetUrl(`Data/${name}.json`)}?v=${encodeURIComponent(version)}`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`${name}.json 로딩 실패 (${response.status})`);
  return schema.parse(await response.json());
}
export async function loadProject(signal: AbortSignal): Promise<MapProject> {
  const version = Date.now().toString();
  const [project, geography, buildings, markers, institutions, shops, npcs, facilities, iconData] = await Promise.all([
    read("project", schemas.projectFileSchema, signal, version), read("geography", schemas.geographyFileSchema, signal, version),
    read("buildings", schemas.buildingsFileSchema, signal, version), read("markers", schemas.markersFileSchema, signal, version),
    read("institutions", schemas.institutionsFileSchema, signal, version), read("shops", schemas.shopsFileSchema, signal, version),
    read("npcs", schemas.npcsFileSchema, signal, version), read("facilities", schemas.facilitiesFileSchema, signal, version),
    read("images", schemas.iconsFileSchema, signal, version),
  ]);
  const image = project.mapImages.find(item => item.id === project.currentMapImageRef);
  if (!image) throw new Error("선택한 지도 이미지가 없습니다.");
  return { projectName: project.projectName, icons: iconData.images.map(icon => ({ ...icon, url: `${assetUrl(icon.filePath)}?v=${encodeURIComponent(version)}` })), ...geography, ...buildings, ...markers, ...institutions, ...shops, ...npcs, ...facilities,
    image: { width: image.width, height: image.height, url: assetUrl(image.filePath), previewUrl: image.previewFilePath ? assetUrl(image.previewFilePath) : undefined,
      tileUrlTemplate: image.tileDirectory ? assetUrl(`${image.tileDirectory}/level_{level}/{x}_{y}.png`) : undefined } };
}
