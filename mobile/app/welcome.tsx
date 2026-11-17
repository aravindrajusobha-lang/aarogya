import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Language, translate } from '../src/i18n';
import { readLanguagePreference } from '../src/languagePreference';
import { openAadhaarRegistration } from '../src/publicRegistration';
import { theme } from '../src/theme/tokens';

export default function Welcome() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = (key: Parameters<typeof translate>[1]) => translate(language || 'en', key);

  useEffect(() => {
    readLanguagePreference().then(value => {
      if (value) setLanguage(value);
      else router.replace('/language');
    }).catch(() => setError('Could not load your language preference. Please select it again.'));
  }, []);

  const openAadhaar = async () => {
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

  if (!language) return <View style={s.loading}>{error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => router.replace('/language')}><Text style={s.link}>{t('changeLanguage')}</Text></Pressable></> : <ActivityIndicator color={theme.colors.primary}/>}</View>;
  const logins: Array<{ label: string; role: string }> = [
    { label: t('patientLogin'), role: 'patient' },
    { label: t('doctorLogin'), role: 'doctor' },
    { label: t('fieldStaffLogin'), role: 'health_worker' },
    { label: t('adminLogin'), role: 'admin' },
  ];

  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.banner}><Text style={s.bannerText}>{t('simulation')}</Text></View>
    <View style={s.header}><Image source={require('../assets/brand/aarogya-icon-512.png')} style={s.logo}/><Text style={s.brand}>Aarogya-Drishti</Text></View>
    <Text style={s.title}>{t('welcomeTitle')}</Text>
    <Text style={s.copy}>{t('welcomeSubtitle')}</Text>
    <View style={s.card}>
      <Text style={s.sectionTitle}>{t('patientRegistration')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/register')} style={s.primary}><Text style={s.primaryText}>{t('profileRegistration')}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openAadhaar()} style={[s.secondary, busy && s.disabled]}>{busy ? <ActivityIndicator color={theme.colors.primary}/> : <Text style={s.secondaryText}>{t('aadhaarRegistration')}</Text>}</Pressable>
      <Text style={s.note}>{t('aadhaarWebOnly')}</Text>
    </View>
    <View style={s.card}>
      <Text style={s.sectionTitle}>{t('signIn')}</Text>
      <View style={s.loginGrid}>{logins.map(item => <Pressable accessibilityRole="button" key={item.role} onPress={() => router.push({ pathname: '/login', params: { role: item.role } })} style={s.loginButton}><Text style={s.loginButtonText}>{item.label}</Text><Text style={s.arrow}>›</Text></Pressable>)}</View>
    </View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <View style={s.footer}><Pressable onPress={() => router.push('/language')}><Text style={s.link}>{t('changeLanguage')}</Text></Pressable><Pressable onPress={() => router.push('/settings')}><Text style={s.link}>{t('serviceSettings')}</Text></Pressable></View>
  </ScrollView>;
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  page: { flexGrow: 1, padding: 20, paddingTop: 70, paddingBottom: 38, backgroundColor: theme.colors.bg },
  banner: { position: 'absolute', top: 34, left: 16, right: 16, padding: 9, backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.sm },
  bannerText: { textAlign: 'center', fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  logo: { width: 48, height: 48, resizeMode: 'contain' },
  brand: { fontSize: 19, fontWeight: '800', color: theme.colors.primary },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '800', textAlign: 'center', color: theme.colors.text, marginTop: 18 },
  copy: { fontSize: 14, textAlign: 'center', color: theme.colors.textSecondary, marginTop: 7, marginBottom: 18 },
  card: { padding: 16, marginTop: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.sm, marginTop: 9 },
  secondaryText: { color: theme.colors.primary, fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 18, color: theme.colors.textMuted, marginTop: 9 },
  loginGrid: { gap: 8 },
  loginButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, backgroundColor: theme.colors.bg, borderRadius: theme.radius.sm },
  loginButtonText: { flex: 1, color: theme.colors.text, fontWeight: '700' },
  arrow: { fontSize: 25, color: theme.colors.primary },
  disabled: { opacity: 0.6 },
  error: { color: theme.colors.danger, textAlign: 'center', marginTop: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4 },
  link: { fontSize: 13, color: theme.colors.primary, fontWeight: '700', paddingVertical: 8 },
});
