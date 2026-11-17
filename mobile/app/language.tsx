import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Language, translate } from '../src/i18n';
import { readLanguagePreference, saveLanguagePreference } from '../src/languagePreference';
import { theme } from '../src/theme/tokens';

const choices: Array<{ code: Language; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

export default function LanguageSelection() {
  const [selected, setSelected] = useState<Language>('en');
  const [busy, setBusy] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [error, setError] = useState('');
  const t = (key: Parameters<typeof translate>[1]) => translate(selected, key);

  useEffect(() => {
    void readLanguagePreference()
      .then(value => { if (value) setSelected(value); })
      .catch(() => setError('Could not load your saved language. Select a language to continue.'))
      .finally(() => setPreferenceLoaded(true));
  }, []);

  const continueToHome = async () => {
    setBusy(true);
    setError('');
    try {
      await saveLanguagePreference(selected);
      router.replace('/welcome');
    } catch {
      setError('Could not save your language preference securely. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.banner}><Text style={s.bannerText}>{t('simulation')}</Text></View>
    <Text style={s.brand}>Aarogya-Drishti</Text>
    <Text style={s.title}>{t('languageTitle')}</Text>
    <Text style={s.copy}>{t('languageSubtitle')}</Text>
    <View style={s.options}>{choices.map(choice => <Pressable key={choice.code} accessibilityRole="radio" accessibilityState={{ selected: selected === choice.code }} onPress={() => setSelected(choice.code)} style={[s.option, selected === choice.code && s.optionSelected]}>
      <View style={[s.radio, selected === choice.code && s.radioSelected]} />
      <View style={s.optionText}><Text style={s.optionNative}>{choice.native}</Text><Text style={s.optionLabel}>{choice.label}</Text></View>
      {selected === choice.code && <Text style={s.check}>✓</Text>}
    </Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || !preferenceLoaded} onPress={() => void continueToHome()} style={[s.primary, (busy || !preferenceLoaded) && s.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{t('continue')}</Text>}</Pressable>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: 78, paddingBottom: 36, backgroundColor: theme.colors.bg },
  banner: { position: 'absolute', top: 38, left: 18, right: 18, padding: 10, backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.sm },
  bannerText: { textAlign: 'center', fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  brand: { textAlign: 'center', fontSize: 17, fontWeight: '800', color: theme.colors.primary, marginBottom: 26 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: theme.colors.text },
  copy: { fontSize: 15, textAlign: 'center', color: theme.colors.textSecondary, marginTop: 8, marginBottom: 24 },
  options: { gap: 10 },
  option: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  optionSelected: { borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.border },
  radioSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  optionText: { flex: 1, marginLeft: 13 },
  optionNative: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  optionLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 3 },
  check: { fontSize: 20, fontWeight: '800', color: theme.colors.primary },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, marginTop: 24 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: theme.colors.danger, marginTop: 14, textAlign: 'center' },
});
