import {
  formatDateTime,
  t,
  verification,
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
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { BadgeCheck, Camera, Mail, Paperclip, Phone } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Label, PageTitle, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, SoonBadge } from '@/components/ui/kit';
import { pickFiles, uploadPrivate, type PickedFile } from '@/lib/files';
import { useTheme } from '@/theme/ThemeProvider';

export default function Verification() {
  const sb = useSupabase();
  const me = useMe();
  const { session } = useSession();
  const toast = useToast();
  const { colors } = useTheme();
  const [tab, setTab] = useState<VerificationKind>('selfie');
  const mine = useQuery({ queryKey: ['verifications'], queryFn: () => verification.mine(sb) });
  const [selfie, setSelfie] = useState<PickedFile | null>(null);
  const [doc, setDoc] = useState<PickedFile | null>(null);
  const [q, setQ] = useState('');
  const unis = useUniversitySearch(q).data ?? [];
  const [uni, setUni] = useState<{ id: number; name: string } | null>(null);
  const [status, setStatus] = useState<'student' | 'teacher' | 'staff' | 'alumni'>('student');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const catalog = useSkills().data ?? [];
  const [skill, setSkill] = useState(me.data?.skills[0] ?? '');
  const [level, setLevel] = useState<'beginner' | 'middle' | 'advanced' | 'expert'>('middle');
  const [links, setLinks] = useState('');

  const submit = useApiMutation(
    async (s) => {
      const uid = me.data!.profile.id;
      if (tab === 'selfie')
        return verification.submit(s, 'selfie', {}, await uploadPrivate(s, uid, 'kyc', [selfie!]));
      if (tab === 'university')
        return verification.submit(
          s,
          'university',
          { university_id: uni!.id, status, email, consent },
          await uploadPrivate(s, uid, 'kyc', [doc!]),
        );
      return verification.submit(
        s,
        'skill',
        { skill, level, links: links.split(/\s+/).filter(Boolean).slice(0, 5) },
        doc ? await uploadPrivate(s, uid, 'kyc', [doc]) : [],
      );
    },
    {
      onSuccess: () => {
        toast(t('verify.sent'));
        setSelfie(null);
        setDoc(null);
        void mine.refetch();
      },
    },
  );

  const takeSelfie = async () => {
    const res =
      Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            cameraType: ImagePicker.CameraType.front,
            quality: 0.8,
          });
    if (res.canceled) return;
    const a = res.assets[0]!;
    setSelfie({
      name: a.fileName ?? 'selfie.jpg',
      size: a.fileSize ?? 0,
      mime: a.mimeType ?? 'image/jpeg',
      uri: a.uri,
      webFile: (a as { file?: Blob }).file,
    });
  };

  const canSend =
    tab === 'selfie' ? !!selfie : tab === 'university' ? !!uni && !!doc && consent : !!skill;

  return (
    <Screen title={t('verify.title')} leading={<BackButton />} onRefresh={() => mine.refetch()}>
      <PageTitle>{t('verify.title')}</PageTitle>
      {me.data?.profile.verified_at ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <BadgeCheck size={18} color={colors.success} />
          <AppText variant="bodyStrong" color="success">
            {t('verify.verified')}
          </AppText>
        </View>
      ) : null}
      <ListGroup title={t('verify.contacts')}>
        <ListRow
          icon={(c) => <Mail size={18} color={c} />}
          title={session?.user.email ?? ''}
          subtitle={t('verify.emailDone')}
        />
        <ListRow
          icon={(c) => <Phone size={18} color={c} />}
          title={me.data?.private.phone ?? t('verify.phone')}
          subtitle={t('verify.phoneSoon')}
          trailing={<SoonBadge />}
        />
      </ListGroup>
      <Segmented
        value={tab}
        onChange={setTab}
        options={(['selfie', 'university', 'skill'] as const).map((v) => ({
          value: v,
          label: t(`verify.${v}`),
        }))}
      />
      <Card>
        {tab === 'selfie' ? (
          <>
            <CardHeader title={t('verify.selfie')} />
            <AppText variant="callout" color="textSecondary">
              {t('verify.selfieText')}
            </AppText>
            <View
              style={{
                alignSelf: 'center',
                width: 200,
                height: 240,
                borderRadius: 120,
                borderWidth: 3,
                borderStyle: 'dashed',
                borderColor: colors.accent,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.fill,
              }}
            >
              {selfie ? (
                <Image source={{ uri: selfie.uri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Camera size={40} color={colors.textSecondary} />
              )}
            </View>
            <Button
              variant="glass"
              icon={<Camera size={16} color={colors.text} />}
              label={selfie ? t('verify.selfieRetake') : t('verify.selfieTake')}
              onPress={takeSelfie}
            />
          </>
        ) : tab === 'university' ? (
          <>
            <CardHeader title={t('verify.university')} />
            {uni ? (
              <ListRow title={uni.name} value={t('common.edit')} onPress={() => setUni(null)} />
            ) : (
              <>
                <TextField label={t('onb.universitySearch')} value={q} onChangeText={setQ} />
                <Row>
                  {unis.slice(0, 6).map((u) => (
                    <Chip
                      key={u.id}
                      label={u.name}
                      onPress={() => setUni({ id: u.id, name: u.name })}
                    />
                  ))}
                </Row>
              </>
            )}
            <Label>{t('verify.uniStatus')}</Label>
            <Row>
              {(['student', 'teacher', 'staff', 'alumni'] as const).map((v) => (
                <Chip
                  key={v}
                  label={t(`verify.uniStatuses.${v}`)}
                  selected={status === v}
                  onPress={() => setStatus(v)}
                />
              ))}
            </Row>
            <TextField
              label={t('verify.uniEmail')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button
              variant="glass"
              icon={<Paperclip size={16} color={colors.text} />}
              label={doc ? doc.name : t('verify.uniDoc')}
              onPress={async () => setDoc((await pickFiles(1))[0] ?? null)}
            />
            <AppText variant="caption" color="textSecondary">
              {t('verify.uniDocHint')}
            </AppText>
            <Checkbox checked={consent} onChange={setConsent} label={t('verify.consent')} />
          </>
        ) : (
          <>
            <CardHeader title={t('verify.skill')} />
            <Row>
              {(me.data?.skills.length
                ? me.data.skills
                : catalog.slice(0, 12).map((s) => s.slug)
              ).map((s) => (
                <Chip
                  key={s}
                  label={t(`skill.${s}` as TranslationKey)}
                  selected={skill === s}
                  onPress={() => setSkill(s)}
                />
              ))}
            </Row>
            <Segmented
              value={level}
              onChange={setLevel}
              options={(['beginner', 'middle', 'advanced', 'expert'] as const).map((v) => ({
                value: v,
                label: t(`verify.skillLevels.${v}`),
              }))}
            />
            <Button
              variant="glass"
              icon={<Paperclip size={16} color={colors.text} />}
              label={doc ? doc.name : t('verify.uniDoc')}
              onPress={async () => setDoc((await pickFiles(1))[0] ?? null)}
            />
            <TextField
              label={t('verify.skillLinks')}
              value={links}
              onChangeText={setLinks}
              autoCapitalize="none"
            />
          </>
        )}
        <FormError error={submit.error?.key} />
        <Button
          size="lg"
          block
          label={t('verify.send')}
          disabled={!canSend || submit.isPending}
          onPress={() => submit.mutate(undefined)}
        />
      </Card>
      <ListGroup title={t('verify.history')}>
        {(mine.data ?? []).map((r) => (
          <ListRow
            key={r.id}
            title={t(`verify.${r.kind}`)}
            subtitle={`${formatDateTime(r.created_at)}${r.note ? ` · ${r.note}` : ''}`}
            value={t(`verify.status.${r.status}`)}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
