'use client';

import {
  BOT_PROMPTS,
  bot,
  formatMoney,
  t,
  type BotMessage,
  type MoneyCurrency,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUp, Bot, Lock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { LinkButton } from '@/components/ui/LinkButton';
import { CenterSpinner, PageTitle } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';

export default function BotPage() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const me = useMe();
  const pro = me.data?.profile.plan === 'pro';
  const history = useQuery({ queryKey: ['bot'], queryFn: () => bot.history(sb), enabled: pro });
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useApiMutation((s, msg: string) => bot.ask(s, msg));
  const clear = useApiMutation((s) => bot.clear(s), { invalidate: () => [['bot']] });
  useEffect(
    () => endRef.current?.scrollIntoView({ block: 'end' }),
    [history.data?.length, pending],
  );

  if (!me.data) return <CenterSpinner />;
  if (!pro) {
    return (
      <>
        <Header title={t('bot.title')} />
        <main
          className="mx-auto flex max-w-[640px] flex-col items-center gap-4 px-[var(--p-gutter)] pt-10 text-center md:px-8"
          data-testid="bot-pro"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Bot size={40} />
          </span>
          <h1 className="text-title2 font-extrabold">{t('bot.proOnly')}</h1>
          <p className="text-text-2">{t('bot.proText')}</p>
          <LinkButton href="/subscription" size="lg">
            <Lock size={18} /> {t('bot.toPro')}
          </LinkButton>
        </main>
      </>
    );
  }

  const messages: (BotMessage | { id: string; role: 'user'; body: string; tasks: [] })[] = [
    ...(history.data ?? []),
    ...(pending ? [{ id: 'pending', role: 'user' as const, body: pending, tasks: [] as [] }] : []),
  ];

  const send = (msg: string) => {
    if (!msg.trim() || ask.isPending) return;
    setPending(msg.trim());
    setText('');
    ask.mutate(msg.trim(), {
      onSettled: async () => {
        await qc.invalidateQueries({ queryKey: ['bot'] });
        setPending(null);
      },
    });
  };

  return (
    <>
      <Header
        title={t('bot.title')}
        actions={
          <Button
            variant="glass"
            size="md"
            onClick={() => clear.mutate(undefined)}
            disabled={!history.data?.length}
          >
            <Trash2 size={16} /> {t('bot.clear')}
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-[var(--p-gutter)] pb-44 pt-2 md:px-8 md:pb-32">
        <PageTitle subtitle={t('bot.intro')}>
          PARRI<span className="text-accent">.</span>
        </PageTitle>
        <div className="flex flex-wrap gap-2">
          {BOT_PROMPTS.map((p) => (
            <Chip key={p} onClick={() => send(t(`bot.prompts.${p}`))}>
              {t(`bot.prompts.${p}`)}
            </Chip>
          ))}
        </div>
        <section className="flex flex-col gap-3" aria-live="polite" data-testid="bot-messages">
          {messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                'flex flex-col gap-2',
                m.role === 'user' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={clsx(
                  'max-w-[85%] rounded-[22px] px-4 py-2.5',
                  m.role === 'user'
                    ? 'rounded-br-md bg-accent text-on-accent'
                    : 'card rounded-bl-md',
                )}
              >
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
              {m.tasks.length > 0 && (
                <ul className="flex w-full max-w-[85%] flex-col gap-2">
                  {m.tasks.map((x) => (
                    <li key={x.id}>
                      <Link
                        href={`/tasks/${x.id}`}
                        className="tile flex items-center justify-between gap-3 px-4 py-3 hover:bg-fill-strong"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{x.title}</span>
                          <span className="text-caption text-text-2">
                            {t(`category.${x.category}` as TranslationKey)} ·{' '}
                            {t(`deadline.${x.deadline}` as TranslationKey)}
                          </span>
                        </span>
                        <span className="tabular font-bold">
                          {formatMoney(x.reward_cents, 'ru-RU', {
                            currency: x.currency as MoneyCurrency,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {ask.isPending && (
            <Card className="w-fit text-callout text-text-2">{t('bot.thinking')}</Card>
          )}
          {ask.error && (
            <p className="text-callout font-semibold text-danger">
              {t(ask.error.key as TranslationKey)}
            </p>
          )}
          <div ref={endRef} />
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-[92px] z-30 px-[var(--p-gutter)] md:bottom-4 md:pl-[calc(var(--p-sidebar-width)+16px)]">
        <div className="mx-auto max-w-[760px] md:px-8">
          <Glass
            as="form"
            radius="2xl"
            className="flex items-end gap-2 p-2"
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              aria-label={t('bot.placeholder')}
              placeholder={t('bot.placeholder')}
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              className="h-11 flex-1 bg-transparent px-3 outline-none placeholder:text-text-2"
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t('bot.send')}
              disabled={!text.trim() || ask.isPending}
            >
              <ArrowUp size={20} strokeWidth={2.8} />
            </Button>
          </Glass>
        </div>
      </div>
    </>
  );
}
