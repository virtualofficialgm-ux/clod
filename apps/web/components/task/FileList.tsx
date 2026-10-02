'use client';

import { files as filesApi, t, type Attachment, type FileRef } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { FileText } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

/** Список файлов: открытие по временной подписанной ссылке (бакет приватный) */
export function FileList({ items }: { items: (Attachment | FileRef)[] }) {
  const sb = useSupabase();
  const toast = useToast();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            className="card flex w-full items-center gap-3 px-4 py-3 text-left hover:border-accent/40"
            onClick={async () => {
              try {
                window.open(await filesApi.signedUrl(sb, f.path), '_blank', 'noopener');
              } catch {
                toast(t('errors.download_failed'), 'error');
              }
            }}
          >
            <FileText size={20} className="shrink-0 text-accent-text" aria-hidden />
            <span className="truncate font-semibold">{f.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
