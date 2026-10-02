// Генерирует css/tokens.css из src/tokens.ts. Запуск: pnpm --filter @parri/ui build
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderTokensCss } from '../src/css';

const out = fileURLToPath(new URL('../css/tokens.css', import.meta.url));
writeFileSync(out, renderTokensCss());
console.log('wrote', out);
