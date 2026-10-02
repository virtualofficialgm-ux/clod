import { t } from '@parri/shared';
import Link from 'next/link';
import { ServiceScreen, btn } from '@/components/service/ServiceScreen';

export default function NotFound() {
  return (
    <ServiceScreen code="404" title={t('service.notFound')} text={t('service.notFoundText')}>
      <form action="/feed" className="flex w-full max-w-md gap-2">
        <input
          name="q"
          aria-label={t('feed.searchPlaceholder')}
          placeholder={t('feed.searchPlaceholder')}
          className="h-12 min-w-0 flex-1 rounded-pill bg-fill px-5 outline-none"
        />
        <button type="submit" className={`${btn} bg-ink text-on-ink`}>
          {t('common.search')}
        </button>
      </form>
      <Link href="/dashboard" className={`${btn} bg-accent text-on-accent`}>
        {t('service.home')}
      </Link>
      <Link href="/feed" className={`${btn} bg-fill`}>
        {t('nav.feed')}
      </Link>
      <Link href="/support" className={`${btn} bg-fill`}>
        {t('nav.support')}
      </Link>
    </ServiceScreen>
  );
}
