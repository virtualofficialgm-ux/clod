import { t } from '@parri/shared';
import Link from 'next/link';
import { ServiceScreen, btn } from '@/components/service/ServiceScreen';

export default function Forbidden() {
  return (
    <ServiceScreen code="403" title={t('service.forbidden')} text={t('service.forbiddenText')}>
      <Link href="/account/edit" className={`${btn} bg-accent text-on-accent`}>
        {t('service.changeRole')}
      </Link>
      <Link href="/verification" className={`${btn} bg-fill`}>
        {t('service.passVerification')}
      </Link>
      <Link href="/support" className={`${btn} bg-fill`}>
        {t('service.requestAccess')}
      </Link>
    </ServiceScreen>
  );
}
