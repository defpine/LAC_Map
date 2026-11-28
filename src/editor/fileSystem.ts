export const requiredJsonFiles = [
  "buildings.json",
  "geography.json",
  "institutions.json",
  "shops.json",
  "npcs.json",
  "facilities.json",
  "images.json",
  "settings.json",
  "project.json",
] as const;

export type ProjectFolderReport = {
  directoryName: string;
  errors: string[];
  parsedFiles: string[];
};

export function supportsProjectFolderAccess(): boolean {
  return "showDirectoryPicker" in window;
}

export async function chooseProjectFolder(): Promise<FileSystemDirectoryHandle> {
  const picker = window.showDirectoryPicker;
  if (!picker) throw new Error("이 브라우저는 프로젝트 폴더 직접 연결을 지원하지 않습니다. Chrome 또는 Edge 데스크톱에서 실행하세요.");
  return picker.call(window, { mode: "readwrite", id: "fivem-map-project" });
}

export async function validateProjectFolder(root: FileSystemDirectoryHandle): Promise<ProjectFolderReport> {
  const errors: string[] = [];
  const parsedFiles: string[] = [];

  const data = await childDirectory(root, "Data", errors);
  await childDirectory(root, "Assets", errors);
  await childDirectory(root, "Backup", errors);
  if (!data) return { directoryName: root.name, errors, parsedFiles };

  for (const fileName of requiredJsonFiles) {
    try {
      const handle = await data.getFileHandle(fileName);
      const content = await (await handle.getFile()).text();
      JSON.parse(content);
      parsedFiles.push(fileName);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        errors.push(`Data/${fileName} 파일이 없습니다.`);
      } else {
        errors.push(`Data/${fileName} JSON 형식이 올바르지 않습니다.`);
      }
    }
  }

  return { directoryName: root.name, errors, parsedFiles };
}

async function childDirectory(root: FileSystemDirectoryHandle, name: string, errors: string[]): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(name);
  } catch {
    errors.push(`${name}/ 폴더가 없습니다.`);
    return null;
  }
}
