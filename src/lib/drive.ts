const GOOGLE_API_KEY = 'AIzaSyD4F2MOxzzWTME1v_Z5iCOl1sFO7IlFzlE';
const DRIVE_FOLDER_ID = '1n3DeGn2r7owzCnqc2LlwWrgikLF-9sD7';

export function getDriveFileUrl(fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
}

export function getDriveStreamUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
}

export async function listDriveFiles(folderId: string = DRIVE_FOLDER_ID): Promise<DriveFile[]> {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${GOOGLE_API_KEY}&fields=files(id,name,mimeType,size,thumbnailLink)&pageSize=1000`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Drive API error: ${response.status}`);
  }
  const data = await response.json();
  return data.files || [];
}

export async function listDriveFolder(folderName: string, parentId: string = DRIVE_FOLDER_ID): Promise<string | null> {
  const url = `https://www.googleapis.com/drive/v3/files?q='${parentId}'+in+parents+and+name='${folderName}'+and+mimeType='application/vnd.google-apps.folder'&key=${GOOGLE_API_KEY}&fields=files(id,name)`;

  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.files?.[0]?.id || null;
}

/**
 * Fetch thumbnail file mappings from Google Drive.
 * Fails gracefully and returns empty map if the .thumbnails folder is not accessible.
 * Thumbnail URLs should be stored directly in the clips table in Supabase.
 */
export async function getThumbnailFiles(): Promise<Map<string, string>> {
  try {
    const thumbFolderId = await listDriveFolder('.thumbnails');
    if (!thumbFolderId) return new Map();

    const files = await listDriveFiles(thumbFolderId);
    const map = new Map<string, string>();
    for (const file of files) {
      // Map "clip-name.jpg" -> file.id
      map.set(file.name, file.id);
    }
    return map;
  } catch (error) {
    // Fail gracefully - CORS/auth issues are expected
    // Use category-based color placeholders instead
    console.debug('Thumbnail folder not accessible; using color placeholders');
    return new Map();
  }
}

export function driveThumbUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
}

/**
 * Fetch video file mappings from the main Drive folder.
 * Maps clip basenames (without extension) to their Drive file IDs.
 * These IDs can be used for iframe preview/playback.
 */
export async function getVideoFiles(): Promise<Map<string, string>> {
  try {
    const files = await listDriveFiles(DRIVE_FOLDER_ID);
    const map = new Map<string, string>();
    for (const file of files) {
      if (file.mimeType?.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        // Map basename (without extension) -> file.id
        const baseName = file.name.replace(/\.[^.]+$/, '');
        map.set(baseName, file.id);
        // Also map full name
        map.set(file.name, file.id);
      }
    }
    return map;
  } catch (error) {
    console.debug('Video folder not accessible:', error);
    return new Map();
  }
}

export { GOOGLE_API_KEY, DRIVE_FOLDER_ID };
