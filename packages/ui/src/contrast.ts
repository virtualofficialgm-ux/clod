/** WCAG 2.x: относительная яркость и коэффициент контраста для #RRGGBB */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Наложение rgba-цвета на непрозрачный фон → #RRGGBB */
export function flatten(rgba: string, bg: string): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const [r, g, b, a = 1] = m[1]!.split(',').map((s) => parseFloat(s.trim()));
  const base = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const mix = [r!, g!, b!].map((c, i) => Math.round(c * a + base[i]! * (1 - a)));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}
