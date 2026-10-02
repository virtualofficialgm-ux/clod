// Все переменные с префиксом --p-, чтобы не конфликтовать с пространствами имён Tailwind.
import {
  fonts,
  glass,
  layout,
  motion,
  radii,
  themes,
  typeScaleWeb,
  type ThemeColors,
} from './tokens';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function themeVars(t: ThemeColors): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(t)) {
    if (key === 'blobs') {
      (value as readonly string[]).forEach((c, i) => lines.push(`--p-blob-${i + 1}: ${c};`));
    } else if (key === 'blobOpacity') {
      lines.push(`--p-blob-opacity: ${value};`);
    } else {
      lines.push(`--p-${kebab(key)}: ${value};`);
    }
  }
  return lines;
}

const indent = (lines: string[], n: number) => lines.map((l) => ' '.repeat(n) + l).join('\n');

/** CSS-переменные для веба. Тёмная тема — по системе или принудительно через data-theme. */
export function renderTokensCss(): string {
  const base: string[] = [
    `--p-font-sans: ${fonts.fallbackWeb};`,
    ...Object.entries(radii).map(([k, v]) => `--p-radius-${k}: ${v}px;`),
    `--p-glass-blur: ${glass.blur}px;`,
    `--p-glass-saturate: ${glass.saturate}%;`,
    `--p-glass-shadow-y: ${glass.shadow.y}px;`,
    `--p-glass-shadow-blur: ${glass.shadow.blur}px;`,
    `--p-press-scale: ${motion.pressScale};`,
    `--p-blob-cycle: ${motion.blobCycleMs}ms;`,
    `--p-gutter: ${layout.gutter}px;`,
    `--p-sidebar-width: ${layout.sidebarWidth}px;`,
    `--p-content-max: ${layout.contentMaxWidth}px;`,
    ...Object.entries(typeScaleWeb).flatMap(([k, v]) => [
      `--p-text-${kebab(k)}: ${v.size}px;`,
      `--p-leading-${kebab(k)}: ${v.lineHeight}px;`,
      `--p-weight-${kebab(k)}: ${v.weight};`,
      `--p-tracking-${kebab(k)}: ${v.tracking}em;`,
    ]),
  ];
  return `/* Сгенерировано packages/ui/scripts/gen-css.ts — не редактировать вручную */
:root {
${indent(base, 2)}
${indent(themeVars(themes.light), 2)}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${indent(themeVars(themes.dark), 4)}
    color-scheme: dark;
  }
}

:root[data-theme='dark'] {
${indent(themeVars(themes.dark), 2)}
  color-scheme: dark;
}
`;
}
