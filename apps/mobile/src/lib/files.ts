import { ApiError, privateDocs, type FileRef } from '@parri/shared';
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

/** Загрузить выбранные файлы в приватное хранилище документов (поддержка, проверка личности) */
export async function uploadPrivate(
  sb: Parameters<typeof privateDocs.upload>[0],
  userId: string,
  area: 'support' | 'kyc',
  list: PickedFile[],
) {
  const refs: FileRef[] = [];
  for (const f of list) {
    if (f.size > 10 * 1024 * 1024) throw new ApiError('errors.file_too_big');
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const path = privateDocs.path(userId, area, f.name, id);
    await privateDocs.upload(sb, path, await fileBody(f), f.mime);
    refs.push({ path, name: f.name, size: f.size, mime: f.mime });
  }
  return refs;
}
