import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { readSession } from '../src/auth/session';
import { theme } from '../src/theme/tokens';
import { readLanguagePreference } from '../src/languagePreference';

export default function Splash() {
  const [error, setError] = useState('');
  const openApp = async () => {
    setError('');
    try {
      const session = await readSession();
      if (session) {
        router.replace('/home');
        return;
      }
      router.replace(await readLanguagePreference() ? '/welcome' : '/language');
    } catch {
      setError('Could not open the app securely. Please try again.');
    }
  };
  useEffect(() => { void openApp(); }, []);
  return <View style={styles.root}><Image source={require('../assets/brand/aarogya-icon-512.png')} style={styles.logo}/><Text style={styles.name}>Aarogya-Drishti</Text><Text style={styles.sub}>Community health support</Text>{error ? <Pressable onPress={() => void openApp()}><Text style={styles.error}>{error} Tap to retry.</Text></Pressable> : <ActivityIndicator color={theme.colors.primary} style={{marginTop: 28}}/>}<Text style={styles.sim}>⚠️ SIMULATION SYSTEM — DEMO DATA ONLY — NOT FOR CLINICAL USE</Text></View>;
}
const styles = StyleSheet.create({root:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:theme.colors.bg},logo:{width:112,height:112,resizeMode:'contain'},name:{fontSize:theme.type.title,fontWeight:'800',color:theme.colors.text,marginTop:18},sub:{fontSize:theme.type.body,color:theme.colors.textSecondary,marginTop:8},error:{color:theme.colors.danger,marginTop:20,textAlign:'center'},sim:{position:'absolute',top:50,left:18,right:18,textAlign:'center',fontSize:11,fontWeight:'700',color:theme.colors.danger,backgroundColor:theme.colors.dangerSoft,padding:12,borderRadius:theme.radius.sm}});
