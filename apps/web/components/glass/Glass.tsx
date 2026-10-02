import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ElementType } from 'react';

type Radius = 'lg' | 'xl' | '2xl' | 'pill';

type GlassProps<T extends ElementType> = {
  as?: T;
  radius?: Radius;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

const radiusClass: Record<Radius, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  pill: 'rounded-pill',
};

/** Поверхность из стекла — только для навигации и контролов, не для текста задач. */
export function Glass<T extends ElementType = 'div'>({
  as,
  radius = '2xl',
  className,
  ...rest
}: GlassProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return <Tag className={clsx('glass', radiusClass[radius], className)} {...rest} />;
}
