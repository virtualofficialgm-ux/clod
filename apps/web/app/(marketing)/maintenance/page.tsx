import { t } from '@parri/shared';
import Link from 'next/link';
import { ServiceScreen, btn } from '@/components/service/ServiceScreen';

export default function Maintenance() {
  return (
    <ServiceScreen title={t('service.maintenance')} text={t('service.maintenanceText')}>
      <ul className="grid w-full gap-2 sm:grid-cols-2">
        {(['api', 'site', 'db', 'payments'] as const).map((k) => (
          <li key={k} className="tile flex items-center gap-2 px-4 py-3 text-callout font-semibold">
            <span className="size-2.5 rounded-full bg-warning" /> {t(`admin.serviceNames.${k}`)}
          </li>
        ))}
      </ul>
      <Link href="/feed" className={`${btn} bg-fill`}>
        {t('nav.feed')}
      </Link>
    </ServiceScreen>
  );
}
