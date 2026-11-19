interface Window {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    id?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}

interface FileSystemDirectoryHandle {
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string): Promise<void>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}
