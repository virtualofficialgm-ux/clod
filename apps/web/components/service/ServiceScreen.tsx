import Link from 'next/link';

/** Служебный экран: крупный код или значок, заголовок, текст и кнопки */
export function ServiceScreen({
  code,
  title,
  text,
  children,
}: {
  code?: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center gap-5 px-[var(--p-gutter)] text-center"
      data-testid="service-screen"
    >
      {code && (
        <p className="text-[96px] font-extrabold leading-none tracking-[-0.06em] text-accent">
          {code}
        </p>
      )}
      <h1 className="text-title1 font-extrabold">{title}</h1>
      <p className="text-body text-text-2">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
      <Link href="/" className="mt-4 text-[28px] font-extrabold tracking-[-0.04em]">
        Parri<span className="text-accent">.</span>
      </Link>
    </main>
  );
}

export const btn = 'inline-flex h-12 items-center rounded-pill px-6 font-bold';
