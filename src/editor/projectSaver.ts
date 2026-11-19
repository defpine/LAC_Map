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
    { name: "images.json", text: json({ images: (project.icons ?? []).map(({ url: _url, pendingFile: _file, ...icon }) => icon) }) },
  ];

  const originals = new Map<string, string>();
  for (const write of writes) {
    const handle = await data.getFileHandle(write.name);
    originals.set(write.name, await (await handle.getFile()).text());
  }

  const completed: string[] = [];
  const createdIcons: string[] = [];
  let iconDirectory: FileSystemDirectoryHandle | undefined;
  try {
    for (const icon of project.icons ?? []) {
      if (!icon.pendingFile) continue;
      const assets = await root.getDirectoryHandle("Assets");
      const images = await assets.getDirectoryHandle("images", { create: true });
      iconDirectory = await images.getDirectoryHandle("icons", { create: true });
      const filename = icon.filePath.split("/").at(-1)!;
      try {
        await iconDirectory.getFileHandle(filename);
        throw new Error(`아이콘 파일이 이미 존재합니다: ${filename}`);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
      }
      const handle = await iconDirectory.getFileHandle(filename, { create: true });
      createdIcons.push(filename);
      const writer = await handle.createWritable();
      await writer.write(icon.pendingFile);
      await writer.close();
    }
    for (const write of writes) {
      completed.push(write.name);
      await writeText(data, write.name, write.text);
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
    for (const name of createdIcons.reverse()) {
      try { await iconDirectory?.removeEntry(name); } catch { restoreFailures.push(`아이콘 ${name}`); }
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
