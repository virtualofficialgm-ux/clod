import { t } from '@parri/shared';
import Link from 'next/link';

export function LegalPage({ title, sections }: { title: string; sections: [string, string[]][] }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--p-gutter)] py-10 md:px-8">
      <Link href="/" className="text-[28px] font-extrabold tracking-[-0.04em]">
        Parri<span className="text-accent">.</span>
      </Link>
      <h1 className="text-title1 font-extrabold">{title}</h1>
      <p className="text-caption text-text-2">{t('legal.updated')}</p>
      {sections.map(([h, ps], i) => (
        <section key={h} className="card flex flex-col gap-2 p-6">
          <h2 className="text-title3 font-bold">
            {i + 1}. {h}
          </h2>
          {ps.map((p, j) => (
            <p key={j} className="text-body leading-relaxed text-text-2">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
