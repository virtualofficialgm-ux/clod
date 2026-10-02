import qrcode from 'qrcode-generator';

/** QR-код как матрица модулей (true — тёмный): рисуется SVG на вебе и в приложении */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** SVG-путь для матрицы: один path из квадратов (быстро рендерится) */
export function qrPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  return d;
}

/** Ссылка на задачу для «Поделиться» */
export function taskShareUrl(origin: string, id: string): string {
  return `${origin.replace(/\/$/, '')}/tasks/${id}`;
}
