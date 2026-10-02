import Link from 'next/link';
import { t } from '@parri/shared';
import { MeshBackground } from '@/components/glass/MeshBackground';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MeshBackground />
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-8 px-[var(--p-gutter)] py-8">
        <Link href="/" className="text-[32px] font-extrabold tracking-[-0.04em]">
          {t('app.name')}
          <span className="text-accent">.</span>
        </Link>
        {children}
      </div>
    </>
  );
}
