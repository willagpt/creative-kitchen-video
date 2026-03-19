/**
 * Local file loading via File System Access API.
 * This is how V1 loads video clips — from a local folder, not streamed from Drive.
 * Files are matched to Supabase clip metadata by filename.
 */

// Store file handles and blob URLs in memory
const localFileMap = new Map<string, string>(); // basename -> blob URL
let directoryHandle: FileSystemDirectoryHandle | null = null;

// Video extensions we recognize (case-insensitive)
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|mxf|prores|ts|mts|3gp|wmv|flv)$/i;

/**
 * Check if a file is a video file.
 * Checks both MIME type and extension since macOS often returns empty MIME for .mov files.
 */
function isVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith('video/')) return true;
  if (file.type === 'application/mxf') return true;
  if (VIDEO_EXTENSIONS.test(file.name)) return true;
  return false;
}

/**
 * Recursively scan a directory handle for video files.
 */
async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  map: Map<string, string>,
  depth = 0
): Promise<void> {
  // Safety: don't recurse more than 5 levels deep
  if (depth > 5) return;

  // @ts-expect-error — async iterator on FileSystemDirectoryHandle
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      try {
        const file: File = await entry.getFile();
        if (isVideoFile(file)) {
          const blobUrl = URL.createObjectURL(file);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          map.set(baseName, blobUrl);
          map.set(file.name, blobUrl);
        }
      } catch (err) {
        console.warn(`Skipped file ${entry.name}:`, err);
      }
    } else if (entry.kind === 'directory') {
      // Recurse into subdirectories
      try {
        await scanDirectory(entry as FileSystemDirectoryHandle, map, depth + 1);
      } catch (err) {
        console.warn(`Skipped directory ${entry.name}:`, err);
      }
    }
  }
}

/**
 * Prompt user to pick a folder containing video clips.
 * Recursively scans all video files and creates object URLs for playback.
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

    // Recursively scan all files in the directory tree
    await scanDirectory(directoryHandle, localFileMap);

    const fileCount = Math.floor(localFileMap.size / 2);
    console.log(`[CK] Loaded ${fileCount} video files from local folder`);

    // Log some sample entries for debugging
    let shown = 0;
    for (const [key] of localFileMap.entries()) {
      if (shown >= 10) break;
      if (!key.includes('.')) continue; // only show full filenames
      console.log(`  [CK] File: ${key}`);
      shown++;
    }

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

// Audio extensions we recognize
const AUDIO_EXTENSIONS = /\.(mp3|wav|aac|m4a|ogg|flac|wma|aiff|alac)$/i;

function isAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) return true;
  if (AUDIO_EXTENSIONS.test(file.name)) return true;
  return false;
}

async function scanDirectoryForAudio(
  handle: FileSystemDirectoryHandle,
  map: Map<string, string>,
  depth = 0
): Promise<void> {
  if (depth > 5) return;
  // @ts-expect-error — async iterator on FileSystemDirectoryHandle
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      try {
        const file: File = await entry.getFile();
        if (isAudioFile(file)) {
          const blobUrl = URL.createObjectURL(file);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          map.set(baseName, blobUrl);
          map.set(file.name, blobUrl);
        }
      } catch (err) {
        console.warn(`Skipped audio file ${entry.name}:`, err);
      }
    } else if (entry.kind === 'directory') {
      try {
        await scanDirectoryForAudio(entry as FileSystemDirectoryHandle, map, depth + 1);
      } catch (err) {
        console.warn(`Skipped audio directory ${entry.name}:`, err);
      }
    }
  }
}

/**
 * Load a music folder with recursive scanning.
 */
export async function loadMusicFolder(): Promise<Map<string, string>> {
  const musicMap = new Map<string, string>();
  try {
    // @ts-expect-error — File System Access API types
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    if (!handle) return musicMap;

    await scanDirectoryForAudio(handle, musicMap);

    const count = musicMap.size;
    console.log(`[CK] Loaded ${count} music files from local folder`);
    return musicMap;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return musicMap;
    console.error('Failed to load music folder:', err);
    return musicMap;
  }
}

/**
 * Resolve a clip name to a local blob URL for playback.
 * Tries exact name, then basename matching, then fuzzy matching.
 */
export function resolveLocalVideo(clipName: string, fileMap: Map<string, string>): string | null {
  if (!clipName || fileMap.size === 0) return null;

  // Try exact match
  if (fileMap.has(clipName)) return fileMap.get(clipName)!;

  // Try basename (without extension)
  const baseName = clipName.replace(/\.[^.]+$/, '');
  if (fileMap.has(baseName)) return fileMap.get(baseName)!;

  // Try case-insensitive exact match
  const lowerName = clipName.toLowerCase();
  const lowerBase = baseName.toLowerCase();
  for (const [key, url] of fileMap.entries()) {
    if (key.toLowerCase() === lowerName || key.toLowerCase() === lowerBase) {
      return url;
    }
  }

  // Try partial match — clip name might be a substring of file name or vice versa
  for (const [key, url] of fileMap.entries()) {
    const keyBase = key.replace(/\.[^.]+$/, '').toLowerCase();
    if (keyBase.includes(lowerBase) || lowerBase.includes(keyBase)) {
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
