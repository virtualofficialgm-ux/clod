'use client';

import {
  ApiError,
  KB_ARTICLES,
  TICKET_CATEGORIES,
  formatAgo,
  privateDocs,
  support,
  t,
  type FileRef,
  type TicketCategory,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, LifeBuoy, Paperclip, Scale, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { FormError, Input, TextArea } from '@/components/ui/Field';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const MAX = 10 * 1024 * 1024;

export default function SupportPage() {
  const sb = useSupabase();
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [category, setCategory] = useState<TicketCategory>('tasks');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => support.tickets(sb) });
  const create = useApiMutation(
    async (s) => {
      const refs: FileRef[] = [];
      for (const f of files) {
        if (f.size > MAX) throw new ApiError('errors.file_too_big');
        const path = privateDocs.path(me.data!.profile.id, 'support', f.name, crypto.randomUUID());
        await privateDocs.upload(s, path, f, f.type || 'application/octet-stream');
        refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
      }
      return support.create(s, { category, subject, body, files: refs });
    },
    {
      invalidate: () => [['tickets']],
      onSuccess: (tk) => {
        toast(t('support.sent'));
        router.push(`/support/${tk.id}`);
      },
    },
  );
  const needle = q.trim().toLowerCase();
  const articles = KB_ARTICLES.filter(
    (k) => !needle || `${t(`kb.${k}.q`)} ${t(`kb.${k}.a`)}`.toLowerCase().includes(needle),
  );
  const list = (tickets.data ?? []).filter(
    (x) =>
      filter === 'all' ||
      (filter === 'open'
        ? ['open', 'waiting'].includes(x.status)
        : ['resolved', 'closed'].includes(x.status)),
  );

  return (
    <>
      <Header title={t('support.title')} />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-6 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <PageTitle>
            {t('support.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <Card className="flex flex-col gap-3">
            <CardHeader title={t('support.kb')} />
            <label className="flex h-12 items-center gap-2 rounded-pill bg-fill px-4">
              <Search size={18} className="text-text-2" aria-hidden />
              <input
                type="search"
                aria-label={t('support.kbSearch')}
                placeholder={t('support.kbSearch')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-full flex-1 bg-transparent outline-none"
              />
            </label>
            <ul className="flex flex-col gap-2" data-testid="kb">
              {articles.map((k) => (
                <li key={k} className="tile">
                  <button
                    type="button"
                    aria-expanded={open === k}
                    onClick={() => setOpen(open === k ? null : k)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold"
                  >
                    {t(`kb.${k}.q`)}
                    <ChevronDown
                      size={18}
                      className={clsx('shrink-0 transition-transform', open === k && 'rotate-180')}
                    />
                  </button>
                  {open === k && (
                    <p className="px-4 pb-4 text-callout text-text-2">{t(`kb.${k}.a`)}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3">
            <CardHeader
              title={t('support.mine')}
              action={
                <Segmented
                  label={t('support.mine')}
                  value={filter}
                  onChange={setFilter}
                  options={(['all', 'open', 'resolved'] as const).map((v) => ({
                    value: v,
                    label: t(`support.filters.${v}`),
                  }))}
                />
              }
              stack
            />
            {tickets.isLoading ? (
              <CenterSpinner />
            ) : list.length === 0 ? (
              <EmptyState icon={<LifeBuoy size={32} />} title={t('support.empty')} />
            ) : (
              <ul className="flex flex-col gap-2" data-testid="tickets">
                {list.map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`/support/${x.id}`}
                      className="tile flex items-center gap-3 px-4 py-3 hover:bg-fill-strong"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{x.subject}</span>
                        <span className="text-caption text-text-2">
                          {t(`support.categories.${x.category}`)} · {formatAgo(x.updated_at)}
                        </span>
                      </span>
                      <span
                        className={clsx(
                          'rounded-pill px-3 py-1 text-caption font-bold',
                          x.status === 'waiting' ? 'bg-accent text-on-accent' : 'bg-fill',
                        )}
                      >
                        {t(`support.status.${x.status}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link
            href="/disputes"
            className="card flex items-center gap-3 p-5 font-bold hover:bg-fill/40"
          >
            <Scale size={20} /> {t('support.openDispute')} →
          </Link>
        </div>
        <aside>
          <Card className="flex flex-col gap-4 lg:sticky lg:top-24">
            <CardHeader title={t('support.create')} />
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={t('support.category')}
            >
              {TICKET_CATEGORIES.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                  {t(`support.categories.${c}`)}
                </Chip>
              ))}
            </div>
            <Input
              label={t('support.subject')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
            />
            <TextArea
              label={t('support.body')}
              placeholder={t('support.bodyPlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              counterMax={4000}
              maxLength={4000}
            />
            {files.map((f, i) => (
              <div
                key={i}
                className="tile flex items-center justify-between px-4 py-2 text-callout"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={t('common.remove')}
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-pill bg-fill px-5 text-callout font-bold">
              <Paperclip size={16} /> {t('support.attach')}
              <input
                type="file"
                className="sr-only"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  setFiles((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 5));
                  e.target.value = '';
                }}
              />
            </label>
            <span className="text-caption text-text-2">{t('support.attachHint')}</span>
            <FormError error={create.error?.key} />
            <Button
              size="lg"
              block
              disabled={subject.trim().length < 3 || body.trim().length < 10 || create.isPending}
              onClick={() => create.mutate(undefined)}
            >
              {t('support.send')}
            </Button>
          </Card>
        </aside>
      </main>
    </>
  );
}
