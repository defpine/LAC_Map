import type { MapProject } from "../domain/types";

type PendingWrite = { name: string; text: string };

export async function saveProjectData(root: FileSystemDirectoryHandle, project: MapProject): Promise<void> {
  const data = await root.getDirectoryHandle("Data");
  const writes: PendingWrite[] = [
    { name: "geography.json", text: json({ terrain: project.terrain, zones: project.zones, roads: project.roads }) },
    { name: "buildings.json", text: json({ buildings: project.buildings }) },
    { name: "markers.json", text: json({ markers: project.markers }) },
    { name: "institutions.json", text: json({ institutions: project.institutions }) },
    { name: "shops.json", text: json({ shops: project.shops }) },
    { name: "npcs.json", text: json({ npcs: project.npcs }) },
    { name: "facilities.json", text: json({ facilities: project.facilities }) },
  ];

  const originals = new Map<string, string>();
  for (const write of writes) {
    const handle = await data.getFileHandle(write.name);
    originals.set(write.name, await (await handle.getFile()).text());
  }

  const completed: string[] = [];
  try {
    for (const write of writes) {
      await writeText(data, write.name, write.text);
      completed.push(write.name);
    }
  } catch (error) {
    const restoreFailures: string[] = [];
    for (const name of completed.reverse()) {
      try {
        await writeText(data, name, originals.get(name)!);
      } catch {
        restoreFailures.push(name);
      }
    }
    const suffix = restoreFailures.length ? ` 복원하지 못한 파일: ${restoreFailures.join(", ")}` : " 이전 저장 상태로 복원했습니다.";
    throw new Error(`저장에 실패했습니다.${suffix}`, { cause: error });
  }
}

async function writeText(directory: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await directory.getFileHandle(name);
  const writer = await handle.createWritable();
  await writer.write(text);
  await writer.close();
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
