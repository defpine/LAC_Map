import { ZodError } from "zod";
import { buildingsFileSchema, facilitiesFileSchema, geographyFileSchema, iconsFileSchema, institutionsFileSchema, npcsFileSchema, projectFileSchema, shopsFileSchema } from "../domain/schemas";
import type { MapProject } from "../domain/types";

export async function loadMapProject(root: FileSystemDirectoryHandle): Promise<MapProject> {
  const data = await root.getDirectoryHandle("Data");
  const [projectData, geographyData, buildingsData, institutionsData, shopsData, npcsData, facilitiesData, iconData] = await Promise.all([
    readJson(data, "project.json", projectFileSchema),
    readJson(data, "geography.json", geographyFileSchema),
    readJson(data, "buildings.json", buildingsFileSchema),
    readJson(data, "institutions.json", institutionsFileSchema),
    readJson(data, "shops.json", shopsFileSchema),
    readJson(data, "npcs.json", npcsFileSchema),
    readJson(data, "facilities.json", facilitiesFileSchema),
    readJson(data, "images.json", iconsFileSchema),
  ]);
  const mapImage = projectData.mapImages.find((image) => image.id === projectData.currentMapImageRef);
  if (!mapImage) throw new Error("project.json의 currentMapImageRef가 mapImages에 없습니다.");

  const imageFile = await fileAtPath(root, mapImage.filePath);
  const previewFile = mapImage.previewFilePath ? await fileAtPath(root, mapImage.previewFilePath) : undefined;
  return {
    projectName: projectData.projectName,
    icons: await Promise.all(iconData.images.map(async (icon) => {
      try { return { ...icon, url: URL.createObjectURL(await fileAtPath(root, icon.filePath)) }; }
      catch { return icon; }
    })),
    image: {
      url: URL.createObjectURL(imageFile),
      previewUrl: previewFile ? URL.createObjectURL(previewFile) : undefined,
      tileProvider: mapImage.tileDirectory ? createTileProvider(root, mapImage.tileDirectory) : undefined,
      width: mapImage.width,
      height: mapImage.height,
    },
    terrain: geographyData.terrain,
    zones: geographyData.zones,
    roads: geographyData.roads,
    buildings: buildingsData.buildings,
    markers: [],
    institutions: institutionsData.institutions,
    shops: shopsData.shops,
    npcs: npcsData.npcs,
    facilities: facilitiesData.facilities,
  };
}

function createTileProvider(root: FileSystemDirectoryHandle, directory: string) {
  return async (level: number, x: number, y: number): Promise<string | null> => {
    try {
      const file = await fileAtPath(root, `${directory}/level_${level}/${x}_${y}.png`);
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  };
}

async function readJson<T>(directory: FileSystemDirectoryHandle, name: string, schema: { parse(value: unknown): T }): Promise<T> {
  const handle = await directory.getFileHandle(name);
  const text = await (await handle.getFile()).text();
  try {
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      throw new Error(`Data/${name} 형식 오류: ${first.path.join(".") || "최상위 값"} — ${first.message}`);
    }
    throw new Error(`Data/${name} 파일을 읽지 못했습니다.`);
  }
}

async function fileAtPath(root: FileSystemDirectoryHandle, path: string): Promise<File> {
  const pieces = path.replaceAll("\\", "/").split("/").filter(Boolean);
  if (pieces.length < 2) throw new Error(`지도 이미지 경로가 올바르지 않습니다: ${path}`);
  let directory = root;
  for (const piece of pieces.slice(0, -1)) directory = await directory.getDirectoryHandle(piece);
  return (await directory.getFileHandle(pieces.at(-1)!)).getFile();
}

