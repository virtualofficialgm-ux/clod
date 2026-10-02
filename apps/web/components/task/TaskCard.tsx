'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, GraduationCap, Globe, MapPin } from 'lucide-react';
import {
  formatDistance,
  formatMoney,
  t,
  type Category,
  type Deadline,
  type TaskKind,
} from '@parri/shared';
import { springs } from '@/lib/springs';
import { categoryIcon } from './categoryIcon';

export interface TaskCardData {
  id: string;
  title: string;
  rewardCents: number;
  kind: TaskKind;
  category: Category;
  deadline: Deadline;
  distanceM?: number;
  campusName?: string;
}

interface TaskCardProps {
  task: TaskCardData;
  onClick?: () => void;
  href?: string;
  /** Дополнительная строка внизу (заказчик, отклики, статус) */
  footer?: React.ReactNode;
  /** Кнопки действий (взять, сохранить) — вне ссылки, чтобы не вкладывать интерактивные элементы */
  actions?: React.ReactNode;
}

/**
 * Карточка задачи в стиле Cal AI: белая, мягкая тень, иконка категории в круге,
 * крупная цена и срок отдельной плашкой.
 */
export function TaskCard({ task, onClick, href, footer, actions }: TaskCardProps) {
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const CatIcon = categoryIcon(task.category);
  const kindLabel =
    task.kind === 'nearby' && task.distanceM != null
      ? formatDistance(task.distanceM)
      : task.kind === 'campus' && task.campusName
        ? task.campusName
        : t(`kind.${task.kind}`);

  const interactive = !!(onClick || href);
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <CatIcon size={20} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-callout font-bold">{t(`category.${task.category}`)}</p>
          <p className="flex items-center gap-1 truncate text-caption text-text-2">
            <KindIcon size={13} strokeWidth={2.6} aria-hidden />
            {kindLabel}
          </p>
        </div>
      </div>
      <h3 className="line-clamp-3 text-title3 font-bold text-text">{task.title}</h3>
      <div className="mt-auto flex items-end justify-between gap-3 pt-1">
        <span className="tabular text-price font-extrabold">{formatMoney(task.rewardCents)}</span>
        <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-fill px-3 text-caption text-text">
          <Clock size={14} strokeWidth={2.6} aria-hidden />
          {t(`deadline.${task.deadline}`)}
        </span>
      </div>
      {footer}
    </>
  );

  return (
    <motion.article
      whileTap={interactive ? { scale: 0.98 } : undefined}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={springs.press}
      className="card flex h-full flex-col gap-4 p-5"
    >
      {href ? (
        <Link href={href} aria-label={`${task.title}, ${formatMoney(task.rewardCents)}`} className="flex flex-1 flex-col gap-4 rounded-md">
          {content}
        </Link>
      ) : (
        <div onClick={onClick} className="flex flex-1 flex-col gap-4">
          {content}
        </div>
      )}
      {actions && <div className="flex gap-2">{actions}</div>}
    </motion.article>
  );
}
