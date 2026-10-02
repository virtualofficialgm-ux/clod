'use client';

import { t } from '@parri/shared';
import { ServiceScreen, btn } from '@/components/service/ServiceScreen';

export default function Offline() {
  return (
    <ServiceScreen title={t('service.offline')} text={t('service.offlineText')}>
      <button
        type="button"
        onClick={() => (history.length > 1 ? history.back() : location.assign('/'))}
        className={`${btn} bg-accent text-on-accent`}
      >
        {t('service.reconnect')}
      </button>
    </ServiceScreen>
  );
}
