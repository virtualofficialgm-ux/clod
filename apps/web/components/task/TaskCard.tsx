'use client';

import { motion } from 'framer-motion';
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

/** Карточка задачи: почти непрозрачная, крупная цена, формат и срок. */
export function TaskCard({ task, onClick }: { task: TaskCardData; onClick?: () => void }) {
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const kindLabel =
    task.kind === 'nearby' && task.distanceM != null
      ? `${t('kind.nearby')} · ${formatDistance(task.distanceM)}`
      : task.kind === 'campus' && task.campusName
        ? task.campusName
        : t(`kind.${task.kind}`);

  return (
    <motion.article
      whileTap={onClick ? { scale: 0.98 } : undefined}
      whileHover={onClick ? { y: -2 } : undefined}
      transition={springs.press}
      onClick={onClick}
      className="card flex flex-col gap-3 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="tabular text-price font-extrabold text-accent-text">
          {formatMoney(task.rewardCents)}
        </span>
        <span className="rounded-pill bg-separator px-3 py-1 text-caption text-text-2">
          {t(`category.${task.category}`)}
        </span>
      </div>
      <h3 className="text-title3 font-bold text-text">{task.title}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-callout font-semibold text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <KindIcon size={16} strokeWidth={2.4} aria-hidden />
          {kindLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={16} strokeWidth={2.4} aria-hidden />
          {t(`deadline.${task.deadline}`)}
        </span>
      </div>
    </motion.article>
  );
}
