'use client';

import { qrMatrix, qrPath, t, taskShareUrl } from '@parri/shared';
import { Copy, Download } from 'lucide-react';
import { useMemo } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { useToast } from '@/components/ui/Toast';

/** «Поделиться»: ссылка и QR-код (скачивается картинкой PNG) */
export function ShareSheet({
  open,
  onClose,
  taskId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  title: string;
}) {
  const toast = useToast();
  const url = typeof location === 'undefined' ? '' : taskShareUrl(location.origin, taskId);
  const matrix = useMemo(() => (url ? qrMatrix(url) : []), [url]);
  const n = matrix.length;

  const download = () => {
    const scale = 12;
    const pad = 4;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = (n + pad * 2) * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0B0B0F';
    matrix.forEach((row, y) =>
      row.forEach(
        (dark, x) => dark && ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale),
      ),
    );
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `parri-${taskId.slice(0, 8)}.png`;
    a.click();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('task.share')}>
      <div className="flex flex-col items-center gap-5">
        <p className="text-center text-body font-bold">{title}</p>
        {n > 0 && (
          <svg
            viewBox={`-2 -2 ${n + 4} ${n + 4}`}
            className="size-56 rounded-lg bg-white p-1"
            role="img"
            aria-label={`QR: ${url}`}
            shapeRendering="crispEdges"
          >
            <path d={qrPath(matrix)} fill="#0B0B0F" />
          </svg>
        )}
        <div className="tile w-full break-all px-4 py-3 text-center font-mono text-callout">
          {url}
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(url);
              toast(t('task.linkCopied'));
            }}
          >
            <Copy size={18} />
            {t('task.copyLink')}
          </Button>
          <Button variant="glass" onClick={download}>
            <Download size={18} />
            {t('task.downloadQr')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
