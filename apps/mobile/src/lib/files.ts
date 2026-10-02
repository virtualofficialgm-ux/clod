import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export interface PickedFile {
  name: string;
  size: number;
  mime: string;
  uri: string;
  webFile?: Blob;
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function pickFiles(limit = 10): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.slice(0, limit).map((a) => ({
    name: a.name,
    size: a.size ?? 0,
    mime: a.mimeType ?? 'application/octet-stream',
    uri: a.uri,
    webFile: (a as { file?: Blob }).file,
  }));
}

/** Тело для supabase.storage.upload: в RN Blob не работает, нужен ArrayBuffer */
export async function fileBody(f: PickedFile): Promise<Blob | ArrayBuffer> {
  if (Platform.OS === 'web' && f.webFile) return f.webFile;
  return new File(f.uri).arrayBuffer();
}
