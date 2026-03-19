/**
 * Local file loading via File System Access API.
 * This is how V1 loads video clips — from a local folder, not streamed from Drive.
 * Files are matched to Supabase clip metadata by filename.
 */

// Store file handles and blob URLs in memory
const localFileMap = new Map<string, string>(); // basename -> blob URL
let directoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Prompt user to pick a folder containing video clips.
 * Scans all video files and creates object URLs for playback.
 * Returns a map of basename -> blob URL.
 */
export async function loadClipsFolder(): Promise<Map<string, string>> {
  try {
    // @ts-expect-error — File System Access API types
    directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    if (!directoryHandle) return localFileMap;

    // Clear previous entries
    for (const url of localFileMap.values()) {
      URL.revokeObjectURL(url);
    }
    localFileMap.clear();

    // Scan all files in the directory
    // @ts-expect-error — async iterator
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        const file: File = await entry.getFile();
        const isVideo = file.type.startsWith('video/') ||
          file.name.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i);

        if (isVideo) {
          const blobUrl = URL.createObjectURL(file);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          localFileMap.set(baseName, blobUrl);
          localFileMap.set(file.name, blobUrl);
        }
      }
    }

    console.log(`Loaded ${localFileMap.size / 2} video files from local folder`);
    return new Map(localFileMap);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // User cancelled the picker
      return localFileMap;
    }
    console.error('Failed to load clips folder:', err);
    return localFileMap;
  }
}

/**
 * Load a music folder similarly.
 */
export async function loadMusicFolder(): Promise<Map<string, string>> {
  const musicMap = new Map<string, string>();
  try {
    // @ts-expect-error — File System Access API types
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    if (!handle) return musicMap;

    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file: File = await entry.getFile();
        const isAudio = file.type.startsWith('audio/') ||
          file.name.match(/\.(mp3|wav|aac|m4a|ogg|flac)$/i);

        if (isAudio) {
          const blobUrl = URL.createObjectURL(file);
          musicMap.set(file.name, blobUrl);
        }
      }
    }
    return musicMap;
  } catch {
    return musicMap;
  }
}

/**
 * Resolve a clip name to a local blob URL for playback.
 * Tries exact name, then basename matching.
 */
export function resolveLocalVideo(clipName: string, fileMap: Map<string, string>): string | null {
  // Try exact match
  if (fileMap.has(clipName)) return fileMap.get(clipName)!;

  // Try basename (without extension)
  const baseName = clipName.replace(/\.[^.]+$/, '');
  if (fileMap.has(baseName)) return fileMap.get(baseName)!;

  // Try partial match — clip name might be a substring of file name or vice versa
  for (const [key, url] of fileMap.entries()) {
    const keyBase = key.replace(/\.[^.]+$/, '');
    if (keyBase.includes(baseName) || baseName.includes(keyBase)) {
      return url;
    }
  }

  return null;
}

export function getLocalFileMap(): Map<string, string> {
  return localFileMap;
}

export function hasLocalFiles(): boolean {
  return localFileMap.size > 0;
}
