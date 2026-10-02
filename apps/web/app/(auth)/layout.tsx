import Link from 'next/link';
import { t } from '@parri/shared';
import { MeshBackground } from '@/components/glass/MeshBackground';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MeshBackground />
      <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 px-[var(--p-gutter)] py-6 transition-[max-width] duration-300 has-[[data-wide]]:max-w-[1000px] md:py-8">
        <Link href="/" className="text-[32px] font-extrabold tracking-[-0.04em]">
          {t('app.name')}
          <span className="text-accent">.</span>
        </Link>
        {children}
      </div>
    </>
  );
}
