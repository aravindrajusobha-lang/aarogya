import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { router } from 'expo-router';
import { api, mutationId } from '../src/api/client';
import { saveSession, Session } from '../src/auth/session';
import { Language, translate } from '../src/i18n';
import { readLanguagePreference } from '../src/languagePreference';
import { openAadhaarRegistration } from '../src/publicRegistration';
import { theme } from '../src/theme/tokens';

type Registration = Session & { user: Session['user'] };

export default function Register() {
  const [language, setLanguage] = useState<Language>('en');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [year, setYear] = useState('');
  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    void readLanguagePreference().then(value => { if (value) setLanguage(value); }).catch(() => setError('Could not load your language preference.'));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (password && password.length < 6) throw new Error(t('passwordTooShort'));
      if (!consent) throw new Error(t('consentRequired'));
      if (fullName.trim().length < 2 || !/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(year) || !village.trim() || !mandal.trim()) {
        throw new Error(t('registrationFieldsRequired'));
      }
      const result = await api<Registration>('/api/v1/patient/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone,
          ...(password ? { password } : {}),
          gender,
          yearOfBirth: Number(year),
          village: village.trim(),
          mandal: mandal.trim(),
          ...(pincode ? { pincode } : {}),
          address,
          hospitalId: 'hosp_paderu_dh',
          consentGiven: true,
          clientMutationId: mutationId(),
        }),
      });
      await saveSession(result);
      router.replace('/home');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const openWebRegistration = async () => {
    setBusy(true);
    setError('');
    try {
      await openAadhaarRegistration();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('webRegistrationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (next: string) => void, props: TextInputProps = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={set} style={s.input} {...props} />
    </View>
  );

  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.banner}><Text style={s.bannerText}>{t('simulation')}</Text></View>
    <View style={s.topLinks}>
      <Pressable onPress={() => router.replace('/welcome')}><Text style={s.link}>‹ {t('backToHome')}</Text></Pressable>
      <Pressable onPress={() => router.push('/language')}><Text style={s.link}>{t('changeLanguage')}</Text></Pressable>
    </View>
    <Text style={s.title}>{t('registrationTitle')}</Text>
    <Text style={s.copy}>{t('registrationCopy')}</Text>
    {field(t('fullName'), fullName, setFullName, { autoCapitalize: 'words' })}
    {field(t('mobileNumber'), phone, setPhone, { keyboardType: 'phone-pad', maxLength: 10 })}
    {field(t('optionalPassword'), password, setPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
    <Text style={s.label}>{t('gender')}</Text>
    <View style={s.genders}>{(['female', 'male', 'other'] as const).map(value => (
      <Pressable key={value} onPress={() => setGender(value)} style={[s.gender, gender === value && s.genderOn]}>
        <Text style={{ color: gender === value ? '#fff' : theme.colors.text, fontWeight: '700' }}>{t(value)}</Text>
      </Pressable>
    ))}</View>
    {field(t('yearOfBirth'), year, setYear, { keyboardType: 'number-pad', maxLength: 4 })}
    {field(t('village'), village, setVillage)}
    {field(t('mandal'), mandal, setMandal)}
    {field(t('pincodeOptional'), pincode, setPincode, { keyboardType: 'number-pad', maxLength: 6 })}
    {field(t('addressLandmarkOptional'), address, setAddress, { multiline: true })}
    <Pressable style={s.consent} onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
      <Text style={s.check}>{consent ? '☑' : '□'}</Text>
      <Text style={s.consentText}>{t('registrationConsent')}</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {busy ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} /> : <>
      <Pressable accessibilityRole="button" onPress={() => void submit()} style={s.submit}><Text style={s.submitText}>{t('consentCreateAccount')}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void openWebRegistration()} style={s.webButton}><Text style={s.webButtonText}>{t('useAadhaarWeb')}</Text></Pressable>
    </>}
    <Text style={s.privacy}>{t('noAadhaarOrOtp')}</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { padding: 20, paddingTop: 72, paddingBottom: 44, backgroundColor: theme.colors.bg },
  banner: { padding: 10, backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.sm, marginBottom: 18 },
  bannerText: { textAlign: 'center', fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  topLinks: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  link: { fontSize: 13, color: theme.colors.primary, fontWeight: '700', paddingVertical: 6 },
  title: { fontSize: 27, fontWeight: '800', color: theme.colors.text },
  copy: { fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 8, marginBottom: 12 },
  field: { marginTop: 12 },
  label: { fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, paddingHorizontal: 12, backgroundColor: theme.colors.surface, fontSize: 16, color: theme.colors.text },
  genders: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  gender: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface },
  genderOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface },
  check: { fontSize: 20, color: theme.colors.primary },
  consentText: { flex: 1, color: theme.colors.textSecondary, lineHeight: 20 },
  submit: { marginTop: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  webButton: { marginTop: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.sm },
  webButtonText: { color: theme.colors.primary, fontWeight: '800' },
  error: { color: theme.colors.danger, marginTop: 12 },
  privacy: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 18 },
});
