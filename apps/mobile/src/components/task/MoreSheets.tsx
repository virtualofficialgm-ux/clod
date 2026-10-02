import {
  formatMoney,
  parseDollars,
  qrMatrix,
  qrPath,
  t,
  taskExtras,
  taskShareUrl,
  work,
  type ComplaintReason,
  type MoneyCurrency,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation } from '@parri/shared/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Copy, Share2, Star, Zap } from '@/components/icons';
import { FormError, TextField } from '@/components/ui/TextField';
import { Label, Row, useToast } from '@/components/ui/bits';
import { OptionTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

/** «Взять задачу»: сразу закрепляется за исполнителем */
export function TakeSheet({
  task,
  takesLeft,
  pro,
  onClose,
}: {
  task: { id: string; title: string; reward_cents: number; currency?: MoneyCurrency } | null;
  takesLeft?: number;
  pro?: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const take = useApiMutation((sb, id: string) => work.take(sb, id), {
    invalidate: (id) => [keys.task(id), keys.mine('executor'), ['feed']],
    onSuccess: (_r, id) => {
      onClose();
      router.push(`/task/${id}`);
    },
  });
  return (
    <BottomSheet
      open={!!task}
      onClose={onClose}
      title={t('task.take')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={take.error?.key} />
          <Button
            size="lg"
            block
            testID="take-confirm"
            icon={<Zap size={18} color={colors.onAccent} />}
            label={`${t('task.take')} · ${task ? formatMoney(task.reward_cents, 'ru-RU', { currency: task.currency ?? 'USD' }) : ''}`}
            disabled={take.isPending}
            onPress={() => task && take.mutate(task.id)}
          />
        </View>
      }
    >
      {task ? (
        <View style={{ gap: 10 }}>
          <AppText variant="title3">{task.title}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('task.takeHint')}
          </AppText>
          <AppText variant="callout" color="textSecondary">
            {t('task.yoursText', { m: 25 })}
          </AppText>
          {takesLeft != null && (
            <AppText variant="bodyStrong">{t('task.takesLeft', { n: takesLeft })}</AppText>
          )}
          {pro && (
            <AppText variant="callout" color="accentText">
              {t('task.takeBonus')}
            </AppText>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const siteOrigin = () =>
  Platform.OS === 'web' && typeof location !== 'undefined'
    ? location.origin
    : (process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000');

/** «Поделиться»: QR-код и ссылка (на телефоне — системное меню «Поделиться») */
export function ShareSheet({
  open,
  onClose,
  taskId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  title: string;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const url = taskShareUrl(siteOrigin(), taskId);
  const matrix = useMemo(() => qrMatrix(url), [url]);
  const n = matrix.length;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('task.share')}
      footer={
        <View style={{ gap: 10 }}>
          <Button
            size="lg"
            block
            icon={<Copy size={18} color={colors.onAccent} />}
            label={t('task.copyLink')}
            onPress={() => {
              if (Platform.OS === 'web') void navigator.clipboard?.writeText(url);
              else void Share.share({ message: url });
              toast(t('task.linkCopied'));
            }}
          />
          <Button
            variant="glass"
            block
            icon={<Share2 size={18} color={colors.text} />}
            label={t('common.share')}
            onPress={() => void Share.share({ message: `${title}\n${url}` })}
          />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <AppText variant="bodyStrong" style={{ textAlign: 'center' }}>
          {title}
        </AppText>
        <View
          style={{ backgroundColor: '#fff', padding: 10, borderRadius: 18 }}
          accessibilityRole="image"
          accessibilityLabel={`QR: ${url}`}
        >
          <Svg width={200} height={200} viewBox={`-2 -2 ${n + 4} ${n + 4}`}>
            <Path d={qrPath(matrix)} fill="#0B0B0F" />
          </Svg>
        </View>
        <AppText variant="caption" color="textSecondary" selectable style={{ textAlign: 'center' }}>
          {url}
        </AppText>
      </View>
    </BottomSheet>
  );
}

const REASONS: ComplaintReason[] = [
  'fraud',
  'prohibited',
  'discrimination',
  'wrong_category',
  'spam',
  'other',
];

export function ReportSheet({
  open,
  onClose,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ComplaintReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useApiMutation((sb) => taskExtras.complain(sb, taskId, reason!, details), {
    onSuccess: () => {
      toast(t('task.reportSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('task.reportTitle')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={send.error?.key} />
          <Button
            size="lg"
            block
            label={t('common.send')}
            disabled={!reason || send.isPending}
            onPress={() => send.mutate(undefined)}
          />
        </View>
      }
    >
      <AppText variant="callout" color="textSecondary">
        {t('task.reportHint')}
      </AppText>
      {REASONS.map((r) => (
        <OptionTile
          key={r}
          selected={reason === r}
          onPress={() => setReason(r)}
          title={t(`task.reasons.${r}`)}
        />
      ))}
      <TextField
        label={`${t('refund.details')} · ${t('common.optional')}`}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
      />
    </BottomSheet>
  );
}

function Stars({
  value,
  onChange,
  label,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 4 }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={String(n)}
          onPress={() => onChange(n)}
          hitSlop={4}
        >
          <Star
            size={size}
            color={n <= value ? colors.accent : colors.textTertiary}
            fill={n <= value ? colors.accent : 'transparent'}
          />
        </Pressable>
      ))}
    </View>
  );
}

const ASPECTS = ['quality', 'communication', 'deadlines', 'requirements'] as const;

export function RateSheet({ d, onClose }: { d: TaskDetail; onClose: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<Record<(typeof ASPECTS)[number], number>>({
    quality: 0,
    communication: 0,
    deadlines: 0,
    requirements: 0,
  });
  const [pub, setPub] = useState('');
  const [priv, setPriv] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [again, setAgain] = useState<boolean | null>(null);
  const send = useApiMutation(
    (sb) =>
      work.review_counterpart(sb, d.task.id, {
        rating,
        ...Object.fromEntries(ASPECTS.map((a) => [a, aspects[a] || null])),
        publicText: pub,
        privateText: priv,
        skills,
        workAgain: again,
      }),
    {
      invalidate: () => [keys.task(d.task.id), ['my-tasks']],
      onSuccess: () => {
        toast(t('rate.done'));
        onClose();
      },
    },
  );
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('rate.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={send.error?.key} />
          <Button
            size="lg"
            block
            label={t('rate.publish')}
            disabled={!rating || send.isPending}
            onPress={() => send.mutate(undefined)}
          />
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('rate.immutable')}
          </AppText>
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText variant="bodyStrong">{t('rate.overall')}</AppText>
        <Stars value={rating} onChange={setRating} label={t('rate.overall')} size={40} />
        {rating > 0 && (
          <AppText variant="callout" color="textSecondary">
            {t(`rate.labels.${rating}` as TranslationKey)}
          </AppText>
        )}
      </View>
      <Label>{t('rate.aspects')}</Label>
      {ASPECTS.map((a) => (
        <View
          key={a}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <AppText variant="callout">{t(`rate.${a}`)}</AppText>
          <Stars
            value={aspects[a]}
            onChange={(v) => setAspects((s) => ({ ...s, [a]: v }))}
            label={t(`rate.${a}`)}
            size={22}
          />
        </View>
      ))}
      <TextField
        label={t('rate.public')}
        hint={t('rate.publicHint')}
        value={pub}
        onChangeText={setPub}
        multiline
        maxLength={1000}
      />
      <TextField
        label={t('rate.private')}
        hint={t('rate.privateHint')}
        value={priv}
        onChangeText={setPriv}
        multiline
        maxLength={1000}
      />
      {d.viewer_role === 'customer' && d.task.skills.length > 0 && (
        <>
          <Label>{t('rate.skills')}</Label>
          <Row>
            {d.task.skills.map((s) => (
              <Chip
                key={s}
                label={t(`skill.${s}` as TranslationKey)}
                selected={skills.includes(s)}
                onPress={() =>
                  setSkills((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))
                }
              />
            ))}
          </Row>
        </>
      )}
      <Label>{t('rate.again')}</Label>
      <Row>
        <Chip label={t('rate.yes')} selected={again === true} onPress={() => setAgain(true)} />
        <Chip label={t('rate.no')} selected={again === false} onPress={() => setAgain(false)} />
      </Row>
    </BottomSheet>
  );
}

const EXT_MINUTES = [15, 30, 60, 180, 1440] as const;

export function ExtensionSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState<number>(60);
  const [reason, setReason] = useState('');
  const m = useApiMutation((sb) => work.requestExtension(sb, taskId, minutes, reason), {
    invalidate: () => [keys.task(taskId), keys.messages(taskId)],
    onSuccess: () => {
      toast(t('room.extensionSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('room.extensionTitle')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            label={t('room.extension')}
            disabled={m.isPending}
            onPress={() => m.mutate(undefined)}
          />
        </View>
      }
    >
      <Label>{t('room.extensionMinutes')}</Label>
      <Row>
        {EXT_MINUTES.map((x) => (
          <Chip
            key={x}
            label={t(`room.minutes.${x}`)}
            selected={minutes === x}
            onPress={() => setMinutes(x)}
          />
        ))}
      </Row>
      <TextField
        label={t('room.extensionReason')}
        value={reason}
        onChangeText={setReason}
        maxLength={300}
      />
    </BottomSheet>
  );
}

export function TipSheet({ d, onClose }: { d: TaskDetail; onClose: () => void }) {
  const toast = useToast();
  const [preset, setPreset] = useState<number | null>(300);
  const [custom, setCustom] = useState('');
  const cents = preset ?? parseDollars(custom) ?? 0;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: d.task.currency });
  const m = useApiMutation((sb) => work.tip(sb, d.task.id, cents), {
    invalidate: () => [keys.task(d.task.id), keys.messages(d.task.id), keys.me, keys.ledger],
    onSuccess: () => {
      toast(t('room.tipSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('room.tipTitle')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            label={t('room.tipSend', { v: fmt(cents) })}
            disabled={m.isPending || cents < 100}
            onPress={() => m.mutate(undefined)}
          />
        </View>
      }
    >
      <AppText variant="callout" color="textSecondary">
        {t('room.tipHint')}
      </AppText>
      <Row>
        {[100, 300, 500, 1000].map((c) => (
          <Chip key={c} label={fmt(c)} selected={preset === c} onPress={() => setPreset(c)} />
        ))}
        <Chip
          label={t('room.tipCustom')}
          selected={preset === null}
          onPress={() => setPreset(null)}
        />
      </Row>
      {preset === null && (
        <TextField
          label={t('room.tipCustom')}
          value={custom}
          onChangeText={setCustom}
          keyboardType="decimal-pad"
        />
      )}
    </BottomSheet>
  );
}
