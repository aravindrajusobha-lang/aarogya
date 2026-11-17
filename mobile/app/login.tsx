import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../src/api/client';
import { saveSession, Session } from '../src/auth/session';
import { theme } from '../src/theme/tokens';
import { Language, translate } from '../src/i18n';
import { readLanguagePreference } from '../src/languagePreference';

type LoginResult = Session & { mfaRequired?: boolean; mfaSessionToken?: string };
type Role = 'patient' | 'doctor' | 'admin' | 'health_worker';

function isRole(value: string): value is Role {
  return value === 'patient' || value === 'doctor' || value === 'admin' || value === 'health_worker';
}

export default function Login() {
  const { role: requestedRole } = useLocalSearchParams<{ role?: string }>();
  const requested = Array.isArray(requestedRole) ? requestedRole[0] : requestedRole;
  const [role, setRole] = useState<Role>(() => requested && isRole(requested) ? requested : 'patient');
  const [language, setLanguage] = useState<Language>('en');
  const [patientPassword,setPatientPassword]=useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    void readLanguagePreference().then(value => { if (value) setLanguage(value); }).catch(() => setError('Could not load your language preference.'));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };
  const finish = async (data: LoginResult) => {
    if (data.mfaRequired) {
      if (!data.mfaSessionToken) throw new Error('The MFA session was not returned.');
      setMfaToken(data.mfaSessionToken); setMfaCode(''); return;
    }
    if (!data.accessToken || !data.user) throw new Error('The sign-in response did not include a session.');
    await saveSession(data); router.replace('/home');
  };
  const sendOtp = () => run(async () => {
    await api('/api/v1/auth/patient/send-otp', { method: 'POST', body: JSON.stringify({ phone: identifier, purpose: 'LOGIN' }) });
    setSent(true);
  });
  const requestPasswordReset = () => run(async () => {
    await api('/api/v1/patient/auth/forgot-password', { method: 'POST', body: JSON.stringify({ phone: identifier.replace(/\D/g, '').slice(0, 10) }) });
    setResetSent(true);
  });
  const resetPassword = () => run(async () => {
    await api('/api/v1/patient/auth/reset-password', { method: 'POST', body: JSON.stringify({ phone: identifier.replace(/\D/g, '').slice(0, 10), otp, newPassword }) });
    setResetMode(false); setResetSent(false); setOtp(''); setNewPassword(''); setError('Password reset. Sign in with your mobile code.');
  });
  const submit = () => run(async () => {
    const data = role === 'patient'
      ? await api<LoginResult>('/api/v1/patient/auth/login', { method: 'POST', body: JSON.stringify({ phone: identifier, ...(patientPassword?{password}:{otp}), deviceName: 'Aarogya-Drishti Mobile' }) })
      : await api<LoginResult>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: identifier, password, deviceName: 'Aarogya-Drishti Mobile' }) });
    await finish(data);
  });
  const verifyMfa = () => run(async () => {
    const data = await api<LoginResult>('/api/v1/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ mfaSessionToken: mfaToken, code: mfaCode }) });
    setMfaToken(''); await finish(data);
  });
  const title = role === 'patient' ? t('mobileNumber') : t('username');
  const roleTitle = (value: Role) => value === 'patient' ? t('rolePatient') : value === 'doctor' ? t('roleDoctor') : value === 'health_worker' ? t('roleFieldStaff') : t('roleAdmin');

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View style={s.banner}><Text style={s.bannerText}>{t('simulation')}</Text></View>
      <Image source={require('../assets/brand/aarogya-logo-768.png')} style={s.logo} />
      <Text style={s.title}>{t('loginTitle')}</Text><Text style={s.copy}>{t('loginSubtitle')}</Text>
      {!mfaToken && resetMode && <><Text style={s.copy}>{t('resetPassword')}</Text><Text style={s.label}>{title}</Text><TextInput style={s.input} value={identifier} onChangeText={setIdentifier} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile number" accessibilityLabel={title}/>{resetSent&&<><Text style={s.label}>{t('oneTimeCode')}</Text><TextInput style={s.input} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} accessibilityLabel={t('oneTimeCode')}/><Text style={s.label}>{t('newPassword')}</Text><TextInput style={s.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry accessibilityLabel={t('newPassword')}/></>}</>}
      {!mfaToken && !resetMode && <>
        <View style={s.roles}>{(['patient', 'doctor', 'health_worker', 'admin'] as const).map(r => <Pressable accessibilityRole="button" accessibilityState={{ selected: role === r }} key={r} onPress={() => { setRole(r); setSent(false); setError(''); }} style={[s.role, role === r && s.roleSelected]}><Text style={[s.roleText, role === r && { color: '#fff' }]}>{roleTitle(r)}</Text></Pressable>)}</View>
        <Text style={s.label}>{title}</Text>
        <TextInput style={s.input} value={identifier} onChangeText={setIdentifier} keyboardType={role === 'patient' ? 'phone-pad' : 'default'} autoCapitalize="none" placeholder={role === 'patient' ? '10-digit mobile number' : 'Username'} accessibilityLabel={title} />
        {role === 'patient' && !patientPassword ? sent ? <><Text style={s.label}>{t('oneTimeCode')}</Text><TextInput style={s.input} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} accessibilityLabel={t('oneTimeCode')} /></> : null : <><Text style={s.label}>{t('password')}</Text><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel={t('password')} /></>}
      </>}
      {mfaToken && <><Text style={s.copy}>{t('mfaPrompt')}</Text><TextInput style={s.input} value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" maxLength={6} accessibilityLabel={t('oneTimeCode')} /></>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {busy ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : <Pressable style={s.primary} onPress={resetMode?(resetSent?resetPassword:requestPasswordReset):mfaToken ? verifyMfa : role === 'patient' && !sent && !patientPassword ? sendOtp : submit}><Text style={s.primaryText}>{resetMode?(resetSent?t('resetPassword'):t('sendResetCode')):mfaToken ? t('verifyCode') : role === 'patient' && !sent && !patientPassword ? t('sendSignInCode') : t('signIn')}</Text></Pressable>}
      {!mfaToken && !resetMode && role==='patient' && <Pressable style={s.secondary} onPress={()=>{setPatientPassword(!patientPassword);setSent(false);setError('')}}><Text style={s.secondaryText}>{patientPassword?t('useSignInCode'):t('usePassword')}</Text></Pressable>}
      {!mfaToken && !resetMode && !patientPassword && role === 'patient' && sent && <Pressable style={s.secondary} onPress={submit}><Text style={s.secondaryText}>{t('verifyCode')}</Text></Pressable>}
      {!mfaToken && resetMode && <><Pressable style={s.secondary} onPress={resetSent?resetPassword:requestPasswordReset}><Text style={s.secondaryText}>{resetSent?t('resetPassword'):t('sendResetCode')}</Text></Pressable><Pressable style={s.secondary} onPress={()=>{setResetMode(false);setResetSent(false);setError('')}}><Text style={s.secondaryText}>{t('back')}</Text></Pressable></>}
      {!mfaToken && !resetMode && <><Pressable onPress={() => router.push('/register')} style={s.secondary}><Text style={s.secondaryText}>{t('createAccount')}</Text></Pressable>{role==='patient'&&<Pressable onPress={()=>{setResetMode(true);setResetSent(false);setError('')}} style={s.secondary}><Text style={s.secondaryText}>{t('forgotPassword')}</Text></Pressable>}<Text style={s.note}>{t('patientOnlyRegistration')}</Text></>}
      <Pressable onPress={()=>router.replace('/welcome')} style={s.secondary}><Text style={s.secondaryText}>{t('backToHome')}</Text></Pressable>
      <Pressable onPress={()=>router.push('/settings')} style={s.secondary}><Text style={s.secondaryText}>{t('serviceSettings')}</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({ page: { padding: 24, paddingTop: 100, paddingBottom: 40 }, banner: { position: 'absolute', top: 40, left: 16, right: 16, padding: 10, backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.sm }, bannerText: { textAlign: 'center', fontWeight: '700', fontSize: 11, color: theme.colors.danger }, logo: { width: 220, height: 112, resizeMode: 'contain', alignSelf: 'center' }, title: { fontSize: theme.type.display, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginTop: 12 }, copy: { fontSize: theme.type.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 24 }, roles: { flexDirection: 'row', gap: 8, marginBottom: 22 }, role: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, roleSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, roleText: { color: theme.colors.text, fontWeight: '700' }, label: { color: theme.colors.text, fontWeight: '700', marginBottom: 7, marginTop: 12 }, input: { height: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, paddingHorizontal: 14, fontSize: 16, backgroundColor: theme.colors.surface, color: theme.colors.text }, primary: { height: 52, marginTop: 20, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 }, secondary: { alignItems: 'center', padding: 14 }, secondaryText: { color: theme.colors.primary, fontWeight: '700' }, error: { color: theme.colors.danger, marginTop: 14 }, note: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 22 } });
