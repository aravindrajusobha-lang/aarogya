import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Language, translate } from '../i18n';
import { theme } from '../theme/tokens';

type Tab={name:string;label:string;icon:string};
const nav:Record<string,Tab[]>={
 patient:[{name:'Dashboard',label:'home',icon:'⌂'},{name:'Appointments',label:'appointments',icon:'▦'},{name:'Screening history',label:'screening',icon:'◎'},{name:'Profile',label:'profile',icon:'♡'}],
 doctor:[{name:'Dashboard',label:'home',icon:'⌂'},{name:'Appointments',label:'appointments',icon:'▦'},{name:'Patient records',label:'records',icon:'▤'},{name:'Availability',label:'availability',icon:'◷'}],
 health_worker:[{name:'Dashboard',label:'home',icon:'⌂'},{name:'Appointments',label:'appointments',icon:'▦'},{name:'New screening',label:'screening',icon:'♧'},{name:'Notifications',label:'notifications',icon:'◉'}],
 admin:[{name:'Dashboard',label:'home',icon:'⌂'},{name:'Doctors',label:'doctors',icon:'♧'},{name:'Facilities',label:'facilities',icon:'⌂'},{name:'Notifications',label:'notifications',icon:'◉'}]
};
export function normalizeRole(value:string){const role=value.toLowerCase();return role==='system_admin'||role==='admin'?'admin':role==='medical_officer'||role.includes('doctor')||role==='specialist_doctor'?'doctor':role==='asha'||role==='asha_worker'||role==='anm'?'health_worker':'patient'}
export function BottomNavigation({role,lang,active='Dashboard'}:{role:string;lang:Language;active?:string}){const items=nav[normalizeRole(role)]||nav.patient;return <View style={s.root}>{items.map(item=>{const selected=item.name===active;return <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>item.name==='Dashboard'?router.replace('/home'):router.push({pathname:'/feature',params:{name:item.name}})} style={s.item}><Text accessibilityElementsHidden style={[s.icon,selected&&s.active]}>{item.icon}</Text><Text numberOfLines={1} style={[s.label,selected&&s.active]}>{translate(lang,item.label as Parameters<typeof translate>[1])}</Text></Pressable>})}</View>}
const s=StyleSheet.create({root:{minHeight:60,paddingBottom:Platform.OS==='ios'?20:6,paddingTop:6,flexDirection:'row',backgroundColor:theme.colors.surface,borderTopColor:theme.colors.border,borderTopWidth:1},item:{flex:1,minHeight:50,alignItems:'center',justifyContent:'center',gap:3},icon:{fontSize:20,color:theme.colors.textMuted},label:{fontSize:10,fontWeight:'700',color:theme.colors.textMuted},active:{color:theme.colors.primary}});

