'use client';

import {
  ApiError,
  formatDateTime,
  privateDocs,
  t,
  verification,
  type FileRef,
  type TranslationKey,
  type VerificationKind,
} from '@parri/shared';
import {
  useApiMutation,
  useMe,
  useSession,
  useSkills,
  useSupabase,
  useUniversitySearch,
} from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Camera, Mail, Paperclip, Phone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { Checkbox, FormError, Input, Select, TextArea } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, SoonBadge } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const MAX = 10 * 1024 * 1024;

function useUpload() {
  const me = useMe();
  return async (sb: Parameters<typeof privateDocs.upload>[0], list: File[]) => {
    const refs: FileRef[] = [];
    for (const f of list) {
      if (f.size > MAX) throw new ApiError('errors.file_too_big');
      const path = privateDocs.path(me.data!.profile.id, 'kyc', f.name, crypto.randomUUID());
      await privateDocs.upload(sb, path, f, f.type || 'application/octet-stream');
      refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
    }
    return refs;
  };
}

function FilePick({
  label,
  file,
  onChange,
  accept,
  capture,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accept: string;
  capture?: 'user';
}) {
  return (
    <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-pill bg-fill px-5 text-callout font-bold">
      {capture ? <Camera size={16} /> : <Paperclip size={16} />} {file ? file.name : label}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        capture={capture}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Selfie({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const upload = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const preview = file ? URL.createObjectURL(file) : null;
  const send = useApiMutation(
    async (sb) => verification.submit(sb, 'selfie', {}, await upload(sb, [file!])),
    {
      onSuccess: () => {
        toast(t('verify.sent'));
        setFile(null);
        onSent();
      },
    },
  );
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title={t('verify.selfie')} />
      <p className="text-callout text-text-2">{t('verify.selfieText')}</p>
      <div className="mx-auto flex size-56 items-center justify-center overflow-hidden rounded-[50%] border-4 border-dashed border-accent/60 bg-fill">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <Camera size={40} className="text-text-2" />
        )}
      </div>
      <FilePick
        label={file ? t('verify.selfieRetake') : t('verify.selfieTake')}
        file={null}
        onChange={setFile}
        accept="image/*"
        capture="user"
      />
      <FormError error={send.error?.key} />
      <Button size="lg" disabled={!file || send.isPending} onClick={() => send.mutate(undefined)}>
        {t('verify.send')}
      </Button>
    </Card>
  );
}

function University({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const upload = useUpload();
  const [q, setQ] = useState('');
  const unis = useUniversitySearch(q).data ?? [];
  const [uni, setUni] = useState<{ id: number; name: string } | null>(null);
  const [faculty, setFaculty] = useState('');
  const [status, setStatus] = useState<'student' | 'teacher' | 'staff' | 'alumni'>('student');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const send = useApiMutation(
    async (sb) =>
      verification.submit(
        sb,
        'university',
        { university_id: uni!.id, faculty, status, email, comment, consent },
        await upload(sb, [file!]),
      ),
    {
      onSuccess: () => {
        toast(t('verify.sent'));
        onSent();
      },
    },
  );
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title={t('verify.university')} />
      {uni ? (
        <div className="tile flex items-center justify-between px-4 py-3">
          <span className="font-semibold">{uni.name}</span>
          <Button variant="plain" size="md" onClick={() => setUni(null)}>
            {t('common.edit')}
          </Button>
        </div>
      ) : (
        <>
          <Input
            label={t('onb.universitySearch')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {unis.slice(0, 6).map((u) => (
              <Chip key={u.id} onClick={() => setUni({ id: u.id, name: u.name })}>
                {u.name}
              </Chip>
            ))}
          </div>
        </>
      )}
      <Input
        label={t('verify.faculty')}
        value={faculty}
        onChange={(e) => setFaculty(e.target.value)}
        maxLength={120}
      />
      <Segmented
        label={t('verify.uniStatus')}
        value={status}
        onChange={setStatus}
        options={(['student', 'teacher', 'staff', 'alumni'] as const).map((v) => ({
          value: v,
          label: t(`verify.uniStatuses.${v}`),
        }))}
      />
      <Input
        label={t('verify.uniEmail')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex flex-col gap-1">
        <FilePick
          label={t('verify.uniDoc')}
          file={file}
          onChange={setFile}
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
        <span className="text-caption text-text-2">{t('verify.uniDocHint')}</span>
      </div>
      <TextArea
        label={t('verify.comment')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={500}
      />
      <Checkbox checked={consent} onChange={setConsent}>
        {t('verify.consent')}
      </Checkbox>
      <FormError error={send.error?.key} />
      <Button
        size="lg"
        disabled={!uni || !file || !consent || send.isPending}
        onClick={() => send.mutate(undefined)}
      >
        {t('verify.send')}
      </Button>
    </Card>
  );
}

function Skill({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const upload = useUpload();
  const me = useMe();
  const catalog = useSkills().data ?? [];
  const [skill, setSkill] = useState(me.data?.skills[0] ?? '');
  const [level, setLevel] = useState<'beginner' | 'middle' | 'advanced' | 'expert'>('middle');
  const [links, setLinks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const send = useApiMutation(
    async (sb) =>
      verification.submit(
        sb,
        'skill',
        { skill, level, links: links.split(/\s+/).filter(Boolean).slice(0, 5) },
        file ? await upload(sb, [file]) : [],
      ),
    {
      onSuccess: () => {
        toast(t('verify.sent'));
        onSent();
      },
    },
  );
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title={t('verify.skill')} />
      <Select
        label={t('people.skill')}
        value={skill}
        onChange={(e) => setSkill(e.target.value)}
        options={(me.data?.skills.length ? me.data.skills : catalog.map((s) => s.slug)).map(
          (s) => ({ value: s, label: t(`skill.${s}` as TranslationKey) }),
        )}
      />
      <Segmented
        label={t('verify.skillLevel')}
        value={level}
        onChange={setLevel}
        options={(['beginner', 'middle', 'advanced', 'expert'] as const).map((v) => ({
          value: v,
          label: t(`verify.skillLevels.${v}`),
        }))}
      />
      <FilePick
        label={t('verify.uniDoc')}
        file={file}
        onChange={setFile}
        accept="application/pdf,image/*"
      />
      <Input
        label={t('verify.skillLinks')}
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder="https://"
      />
      <FormError error={send.error?.key} />
      <Button size="lg" disabled={!skill || send.isPending} onClick={() => send.mutate(undefined)}>
        {t('verify.send')}
      </Button>
    </Card>
  );
}

export default function VerificationPage() {
  const sb = useSupabase();
  const me = useMe();
  const { session } = useSession();
  const [tab, setTab] = useState<VerificationKind>('selfie');
  const mine = useQuery({ queryKey: ['verifications'], queryFn: () => verification.mine(sb) });
  return (
    <>
      <Header title={t('verify.title')} />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-6 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PageTitle>
            {t('verify.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          {me.data?.profile.verified_at && (
            <p className="flex items-center gap-2 font-bold text-success">
              <BadgeCheck size={20} /> {t('verify.verified')}
            </p>
          )}
          <ListGroup title={t('verify.contacts')}>
            <ListRow
              icon={<Mail size={18} />}
              title={session?.user.email ?? ''}
              subtitle={t('verify.emailDone')}
              trailing={<BadgeCheck size={18} className="text-success" />}
            />
            <ListRow
              icon={<Phone size={18} />}
              title={me.data?.private.phone ?? t('verify.phone')}
              subtitle={t('verify.phoneSoon')}
              trailing={<SoonBadge />}
            />
          </ListGroup>
          <Segmented
            label={t('verify.title')}
            value={tab}
            onChange={setTab}
            options={(['selfie', 'university', 'skill'] as const).map((v) => ({
              value: v,
              label: t(`verify.${v}`),
            }))}
          />
          {tab === 'selfie' && <Selfie onSent={() => mine.refetch()} />}
          {tab === 'university' && <University onSent={() => mine.refetch()} />}
          {tab === 'skill' && <Skill onSent={() => mine.refetch()} />}
        </div>
        <aside>
          <Card className="flex flex-col gap-3 lg:sticky lg:top-24">
            <CardHeader title={t('verify.history')} />
            {(mine.data ?? []).length === 0 ? (
              <p className="text-callout text-text-2">—</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="verifications">
                {mine.data!.map((r) => (
                  <li key={r.id} className="tile flex flex-col gap-0.5 px-4 py-3">
                    <span className="flex justify-between gap-2 font-semibold">
                      {t(`verify.${r.kind}`)}
                      <span className="text-caption">{t(`verify.status.${r.status}`)}</span>
                    </span>
                    <span className="text-caption text-text-2">{formatDateTime(r.created_at)}</span>
                    {r.note && <span className="text-callout">{r.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </main>
    </>
  );
}
