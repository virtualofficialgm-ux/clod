import type { Category, Deadline, TaskKind } from './constants';
import { t } from './i18n';

/** Демо-карточки для витрины компонентов (не данные приложения). */
export interface ShowcaseTask {
  id: string;
  title: string;
  rewardCents: number;
  kind: TaskKind;
  category: Category;
  deadline: Deadline;
  distanceM?: number;
  campusName?: string;
}

export const showcaseTasks: ShowcaseTask[] = [
  { id: 's1', title: t('showcase.sampleTitle1'), rewardCents: 2500, kind: 'online', category: 'presentations', deadline: '24h' },
  { id: 's2', title: t('showcase.sampleTitle2'), rewardCents: 800, kind: 'nearby', category: 'photo', deadline: '1h', distanceM: 1200 },
  { id: 's3', title: t('showcase.sampleTitle3'), rewardCents: 1500, kind: 'campus', category: 'study', deadline: '3d', campusName: 'МГУ' },
  { id: 's4', title: t('showcase.sampleTitle4'), rewardCents: 4000, kind: 'online', category: 'translation', deadline: '24h' },
];
