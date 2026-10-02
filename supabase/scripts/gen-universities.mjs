// Генерирует seed/universities.sql из открытого списка Hipo/university-domains-list (MIT).
// node supabase/scripts/gen-universities.mjs path/to/world_universities_and_domains.json
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `array[${(a ?? []).map(q).join(',')}]::text[]`;

const seen = new Set();
const rows = [];
for (const u of src) {
  const code = (u.alpha_two_code ?? '').toUpperCase();
  const name = (u.name ?? '').trim();
  if (!name || code.length !== 2) continue;
  const key = `${name}|${code}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push(`(${q(name)},${q(code)},${q(u.country)},${arr(u.domains)},${q(u.web_pages?.[0])})`);
}
rows.sort();

let out = '-- Вузы мира: Hipo/university-domains-list (MIT). Сгенерировано scripts/gen-universities.mjs\n';
for (let i = 0; i < rows.length; i += 500) {
  out += 'insert into public.universities (name, country_code, country, domains, web_page) values\n';
  out += rows.slice(i, i + 500).join(',\n');
  out += '\non conflict (name, country_code) do nothing;\n';
}
writeFileSync(new URL('../seed/universities.sql', import.meta.url), out);
console.log(`universities: ${rows.length}`);
