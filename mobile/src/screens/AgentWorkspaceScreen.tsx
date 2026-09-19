import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import FeedShell from '../components/feed/FeedShell';
import AppButton from '../components/AppButton';
import JosCityLoader from '../components/JosCityLoader';
import { getAuthToken } from '../storage/session';
import { useTheme } from '../theme/ThemeProvider';
import { Editor, useAgentWorkspace } from '../state/useAgentWorkspace';
import { UploadImage } from '../api/agent';

function EditForm({ editor, busy, error, close, save }: { editor: Editor; busy: boolean; error: string; close: () => void; save: (values: Record<string,string>, images: UploadImage[]) => void }) {
  const { colors: c } = useTheme();
  const [values, setValues] = useState<Record<string,string>>(() => Object.fromEntries(editor.fields.map(f => [f.key, f.value || (f.required ? f.options?.[0]?.value : '') || ''])));
  const [images, setImages] = useState<UploadImage[]>([]), [validation, setValidation] = useState('');
  const pick = async () => {
    try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: (editor.imageLimit || 1) - images.length, quality: 0.8 });
      if (!result.canceled) setImages(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' }))].slice(0, editor.imageLimit));
    } catch { setValidation('Could not open photos. Check photo permissions.'); }
  };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) close(); }}><View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }}><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '90%', backgroundColor: c.card, borderRadius: 20 }} contentContainerStyle={{ padding: 20, gap: 15 }}>
    <Text style={{ fontSize: 23, color: c.text, fontWeight: '700' }}>{editor.title}</Text>
    {editor.fields.map(f => <View key={f.key} style={{ gap: 8 }}><Text style={{ color: c.text }}>{f.label}{f.required ? ' *' : ''}</Text>{f.options ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[...(!f.required ? [{ value: '', label: 'None' }] : []), ...f.options].map(o => <Pressable accessibilityRole="button" accessibilityState={{ selected: values[f.key] === o.value }} disabled={busy} key={o.value} onPress={() => setValues(v => ({ ...v, [f.key]: o.value }))} style={{ padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: values[f.key] === o.value ? c.navActive : c.card }}><Text style={{ color: c.text }}>{o.label}</Text></Pressable>)}</View> : <TextInput accessibilityLabel={f.label} editable={!busy} value={values[f.key]} onChangeText={text => setValues(v => ({ ...v, [f.key]: text }))} secureTextEntry={f.type === 'password'} keyboardType={f.type === 'number' ? 'numbers-and-punctuation' : 'default'} multiline={f.type === 'multiline'} style={{ padding: 13, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.text, minHeight: f.type === 'multiline' ? 85 : 46 }} />}</View>)}
    {!!editor.imageLimit && <><AppButton label={`Choose photos (${images.length}/${editor.imageLimit})`} disabled={busy || images.length >= editor.imageLimit} variant="secondary" onPress={() => void pick()} />{images.length > 0 && <AppButton label="Remove selected photos" variant="secondary" onPress={() => setImages([])} />}</>}
    {!!(validation || error) && <Text accessibilityRole="alert" style={{ color: c.error }}>{validation || error}</Text>}
    <AppButton label={busy ? 'Saving…' : 'Confirm'} disabled={busy} onPress={() => { const missing = editor.fields.find(f => f.required && !values[f.key]?.trim()); if (missing) { setValidation(`${missing.label} is required`); return; } setValidation(''); save(values, images); }} />
    <AppButton label="Cancel" variant="secondary" disabled={busy} onPress={close} />
  </ScrollView></View></Modal>;
}

function AuthenticatedWorkspace({ role = 'agent', page = 'dashboard' }: { role?: 'agent' | 'requester'; page?: string }) {
  const { colors: c } = useTheme(), router = useRouter();
  const params = useLocalSearchParams<{ service?: string; agent?: string }>();
  const w = useAgentWorkspace(role, page === 'settings' ? 'profile' : page, params.service === 'deliver' ? 'delivery' : 'buy', params.agent || '');
  return <FeedShell tab="explore"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 130, gap: 16, maxWidth: 1000, width: '100%', alignSelf: 'center' }}>
    <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>{role === 'agent' ? 'Agent workspace' : 'Shopping & delivery'}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{w.tabs.map(tab => <Pressable key={tab} accessibilityRole="button" accessibilityState={{ selected: w.tab === tab }} onPress={() => w.setTab(tab)} style={{ padding: 12, borderRadius: 16, backgroundColor: w.tab === tab ? c.navActive : c.card }}><Text style={{ color: c.text, textTransform: 'capitalize' }}>{tab}</Text></Pressable>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><AppButton label="Map" variant="secondary" onPress={() => router.push((role === 'agent' ? '/agents/map' : '/map') as never)} /><AppButton label="Wallet / top up" variant="secondary" onPress={() => router.push((role === 'agent' ? '/agents/wallet' : '/profile/wallet') as never)} /><AppButton label="Refresh" variant="secondary" disabled={w.loading || w.busy} onPress={w.refresh} /></View>
    {['directory', 'requests'].includes(w.tab) && <View style={{ flexDirection: 'row', gap: 8 }}>{(['buy','delivery'] as const).map(type => <AppButton key={type} label={type === 'buy' ? 'Help me buy' : 'Help me deliver'} variant={w.service === type ? 'primary' : 'secondary'} onPress={() => w.setService(type)} />)}</View>}
    {['directory', 'catalogue'].includes(w.tab) && <TextInput accessibilityLabel="Search" placeholder="Search" placeholderTextColor={c.textMuted} value={w.search} onChangeText={w.setSearch} style={{ color: c.text, borderWidth: 1, borderColor: c.border, padding: 14, borderRadius: 14 }} />}
    {role === 'requester' && <AppButton label="Create request" onPress={() => w.openRequest()} />}
    {role === 'agent' && w.tab === 'catalogue' && <AppButton label="Add catalogue item" onPress={() => w.catalogueEditor()} />}
    {!!w.error && <Text accessibilityRole="alert" style={{ color: c.error }}>{w.error}</Text>}{!!w.notice && <Text accessibilityLiveRegion="polite" style={{ color: c.primary }}>{w.notice}</Text>}
    {w.loading ? <ActivityIndicator color={c.primary} /> : w.panels.length === 0 && !w.error ? <Text style={{ color: c.textMuted }}>Nothing here yet.</Text> : w.panels.map(panel => <View key={panel.key} style={{ padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.card, gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>{panel.title}</Text>{panel.lines.filter(Boolean).map((line,i) => <Text selectable key={i} style={{ color: c.textMuted, lineHeight: 22 }}>{line}</Text>)}
      {!!panel.images?.length && <ScrollView horizontal>{panel.images.map((uri,i) => <Image key={i} source={{ uri }} style={{ width: 120, height: 100, borderRadius: 12, marginRight: 8 }} />)}</ScrollView>}
      {panel.actions?.map(action => <AppButton key={action.label} label={action.label} variant="secondary" disabled={w.busy || action.disabled} onPress={action.run} />)}
    </View>)}
    {(['requests','jobs','directory'].includes(w.tab) || w.tab === 'catalogue' && role === 'requester') && <View style={{ flexDirection: 'row', gap: 12 }}><AppButton label="Previous" disabled={w.page <= 1 || w.loading} onPress={() => w.setPage(p => p - 1)} /><Text style={{ color: c.text }}>Page {w.page}</Text><AppButton label="Next" disabled={w.panels.length < 20 || w.loading} onPress={() => w.setPage(p => p + 1)} /></View>}
    {page === 'settings' && <AppButton label="Account settings" variant="secondary" onPress={() => router.push('/profile/settings' as never)} />}
  </ScrollView>{w.editor && <EditForm key={w.editor.title} editor={w.editor} error={w.error} busy={w.busy} close={() => w.setEditor(null)} save={(v, images) => void w.run(() => w.editor!.submit(v, images))} />}</FeedShell>;
}

export default function AgentWorkspaceScreen(props: { role?: 'agent' | 'requester'; page?: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null), router = useRouter();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const role = props.role || 'agent';
  useFocusEffect(useCallback(() => {
    let active = true;
    void getAuthToken().then(token => { if (active) setAuthenticated(Boolean(token)); });
    return () => { active = false; };
  }, []));
  if (authenticated === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}><JosCityLoader color={c.primary} size="large" /></View>;
  }
  if (!authenticated) {
    const agent = role === 'agent';
    return <FeedShell tab="explore" showTabBar={!agent} hideHeader={agent}>
      <View style={{ padding: 24, paddingTop: Math.max(insets.top, 24), gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {agent && <AppButton label="Back" variant="secondary" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/welcome' as never); }} />}
        <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>{agent ? 'Become an agent' : 'Shopping & delivery'}</Text>
        <Text style={{ color: c.text, lineHeight: 22 }}>{agent ? 'Sign in with your JosCity account to offer shopping and delivery, or create an account first.' : 'Sign in with your JosCity account to request shopping and delivery. Your existing account and wallet are used.'}</Text>
        <AppButton label="Sign in" onPress={() => router.push({ pathname: '/login', params: { type: agent ? 'agent' : 'personal' } })} />
        <AppButton label={agent ? 'Create an agent account' : 'Create a personal account'} variant="secondary" onPress={() => router.push((agent ? '/register/agent' : '/register/personal') as never)} />
      </View>
    </FeedShell>;
  }
  return <AuthenticatedWorkspace {...props} />;
}
