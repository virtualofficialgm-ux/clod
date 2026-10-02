'use client';

import {
  formatDateTime,
  formatMoney,
  people,
  t,
  type Connection,
  type ConnectionKind,
  type Invitation,
} from '@parri/shared';
import { keys, useApiMutation, useConnections, useInvitations } from '@parri/shared/react';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

type Tab = ConnectionKind | 'invitations';
const TABS: Tab[] = ['followers', 'following', 'contacts', 'requests', 'invitations'];

function PersonRow({ c, kind }: { c: Connection; kind: ConnectionKind }) {
  const inv = () => [['connections'], ['profile']];
  const remove = useApiMutation(
    (sb) =>
      kind === 'following' ? people.follow(sb, c.id, false) : people.contactRemove(sb, c.id),
    { invalidate: inv },
  );
  const respond = useApiMutation((sb, accept: boolean) => people.contactRespond(sb, c.id, accept), {
    invalidate: inv,
  });
  return (
    <li className="card flex flex-wrap items-center gap-3 p-4">
      <Link href={`/u/${c.username ?? c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={c.name} url={c.avatar_url} size={48} />
        <span className="min-w-0">
          <span className="block truncate font-bold">{c.name}</span>
          <span className="block truncate text-caption text-text-2">
            {[c.headline, c.city].filter(Boolean).join(' · ') || formatDateTime(c.since)}
          </span>
        </span>
      </Link>
      {kind === 'requests' && c.incoming ? (
        <div className="flex gap-2">
          <Button size="md" onClick={() => respond.mutate(true)} disabled={respond.isPending}>
            {t('connections.accept')}
          </Button>
          <Button
            size="md"
            variant="glass"
            onClick={() => respond.mutate(false)}
            disabled={respond.isPending}
          >
            {t('connections.decline')}
          </Button>
        </div>
      ) : kind === 'requests' ? (
        <Button size="md" variant="glass" onClick={() => remove.mutate(undefined)}>
          {t('connections.cancel')}
        </Button>
      ) : kind !== 'followers' ? (
        <Button size="md" variant="glass" onClick={() => remove.mutate(undefined)}>
          {t('connections.remove')}
        </Button>
      ) : null}
    </li>
  );
}

function InvitationRow({ i }: { i: Invitation }) {
  const toast = useToast();
  const router = useRouter();
  const respond = useApiMutation(
    (sb, accept: boolean) => people.respondInvitation(sb, i.id, accept),
    {
      invalidate: () => [keys.invitations, ['my-tasks'], keys.task(i.task_id)],
      onSuccess: (_r, accept) => {
        if (accept) {
          toast(t('connections.accepted'));
          router.push(`/tasks/${i.task_id}/room`);
        }
      },
    },
  );
  return (
    <li className="card flex flex-col gap-3 p-4" data-testid="invitation">
      <div className="flex items-center gap-3">
        <Avatar
          name={i.incoming ? i.from_name : i.to_name}
          url={i.incoming ? i.from_avatar : null}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{i.title}</p>
          <p className="text-caption text-text-2">
            {i.incoming ? i.from_name : `→ ${i.to_name}`} ·{' '}
            {formatMoney(i.reward_cents, 'ru-RU', { currency: i.currency })}
          </p>
        </div>
        <span className="rounded-pill bg-fill px-3 py-1 text-caption font-bold">
          {t(`connections.inviteStatus.${i.status}`)}
        </span>
      </div>
      {i.message && <p className="text-callout">{i.message}</p>}
      {i.status === 'pending' && (
        <p className="text-caption text-text-2">
          {t('connections.respondBy', { date: formatDateTime(i.respond_by) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {i.incoming && i.status === 'pending' && (
          <>
            <Button size="md" onClick={() => respond.mutate(true)} disabled={respond.isPending}>
              {t('connections.accept')}
            </Button>
            <Button
              size="md"
              variant="glass"
              onClick={() => respond.mutate(false)}
              disabled={respond.isPending}
            >
              {t('connections.decline')}
            </Button>
          </>
        )}
        <LinkButton href={`/tasks/${i.task_id}`} size="md" variant="glass">
          {t('connections.viewTask')}
        </LinkButton>
        {i.incoming && (
          <LinkButton href={`/u/${i.from_id}`} size="md" variant="glass">
            {t('connections.customerProfile')}
          </LinkButton>
        )}
      </div>
      {respond.error && (
        <p className="text-callout font-semibold text-danger">{t(respond.error.key as never)}</p>
      )}
    </li>
  );
}

function ConnectionsList({ kind, q }: { kind: ConnectionKind; q: string }) {
  const { data = [], isLoading } = useConnections(kind);
  const needle = q.trim().toLowerCase();
  const items = data.filter(
    (c) => !needle || `${c.name} ${c.headline ?? ''}`.toLowerCase().includes(needle),
  );
  if (isLoading) return <CenterSpinner />;
  if (!items.length)
    return (
      <EmptyState
        title={t('connections.empty')}
        action={<LinkButton href="/people">{t('connections.findPeople')}</LinkButton>}
      />
    );
  return (
    <ul className="flex flex-col gap-3" data-testid="connections">
      {items.map((c) => (
        <PersonRow key={c.id} c={c} kind={kind} />
      ))}
    </ul>
  );
}

function Invitations() {
  const { data = [], isLoading } = useInvitations();
  if (isLoading) return <CenterSpinner />;
  if (!data.length) return <EmptyState title={t('connections.empty')} />;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((i) => (
        <InvitationRow key={i.id} i={i} />
      ))}
    </ul>
  );
}

function Connections() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get('tab') as Tab) ?? 'followers';
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : 'followers');
  const [q, setQ] = useState('');
  return (
    <>
      <Header title={t('connections.title')} />
      <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle subtitle={t('connections.followNote')}>{t('connections.title')}</PageTitle>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t('connections.title')}
        >
          {TABS.map((x) => (
            <Chip
              key={x}
              selected={tab === x}
              onClick={() => {
                setTab(x);
                router.replace(`/connections?tab=${x}`);
              }}
            >
              {t(`connections.tabs.${x}`)}
            </Chip>
          ))}
        </div>
        {tab !== 'invitations' && (
          <Glass radius="pill" className="flex h-12 items-center gap-2 px-4">
            <Search size={18} className="text-text-2" aria-hidden />
            <input
              type="search"
              aria-label={t('connections.search')}
              placeholder={t('connections.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-full flex-1 bg-transparent outline-none placeholder:text-text-2"
            />
          </Glass>
        )}
        {tab === 'invitations' ? <Invitations /> : <ConnectionsList kind={tab} q={q} />}
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/people" variant="glass">
            {t('connections.findPeople')}
          </LinkButton>
          <LinkButton href="/settings?tab=privacy" variant="glass">
            {t('connections.privacy')}
          </LinkButton>
        </div>
      </main>
    </>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <Connections />
    </Suspense>
  );
}
