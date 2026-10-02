import clsx from 'clsx';
import Link, { type LinkProps } from 'next/link';

type Props = LinkProps & {
  variant?: 'primary' | 'glass';
  size?: 'lg' | 'md';
  className?: string;
  children: React.ReactNode;
};

/** Ссылка, оформленная как кнопка-пилюля (сжатие при нажатии — CSS active:scale) */
export function LinkButton({ variant = 'primary', size = 'md', className, children, ...rest }: Props) {
  return (
    <Link
      {...rest}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 rounded-pill font-bold transition-[transform,background-color] duration-150 active:scale-[0.96] motion-reduce:active:scale-100',
        size === 'lg' ? 'h-14 px-7 text-button' : 'h-12 px-6 text-button',
        variant === 'primary'
          ? 'bg-accent text-on-accent shadow-[0_8px_24px_rgba(255,84,40,0.35)] hover:bg-accent-pressed'
          : 'glass text-text',
        className,
      )}
    >
      {children}
    </Link>
  );
}
