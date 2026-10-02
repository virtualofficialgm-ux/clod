'use client';

import { t } from '@parri/shared';
import Link from 'next/link';
import { ServiceScreen, btn } from '@/components/service/ServiceScreen';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ServiceScreen code="500" title={t('service.error')} text={t('service.errorText')}>
      <button type="button" onClick={reset} className={`${btn} bg-accent text-on-accent`}>
        {t('service.retry')}
      </button>
      <Link href="/" className={`${btn} bg-fill`}>
        {t('service.home')}
      </Link>
      <Link href="/support" className={`${btn} bg-fill`}>
        {t('service.report')}
      </Link>
    </ServiceScreen>
  );
}
