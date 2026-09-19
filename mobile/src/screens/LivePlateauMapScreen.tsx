import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import FeedShell, { TAB_BAR_SPACE } from '../components/feed/FeedShell';
import PlateauMapView from '../components/PlateauMapView';
import AppButton from '../components/AppButton';
import { useTheme } from '../theme/ThemeProvider';
import { requestMapLocationAccess } from '../location/permissions';
import { agentApi as api } from '../api/agent';
import { directionsUrl, usePlateauMap } from '../state/usePlateauMap';

export default function LivePlateauMapScreen({ mode = 'personal' }: { mode?: 'personal' | 'business' | 'agent' }) {
  const { colors: c } = useTheme(), router = useRouter(), m = usePlateauMap(mode);
  const [label, setLabel] = useState(''), [address, setAddress] = useState(''), [locating, setLocating] = useState(false);
  const lastSent = useRef(0);
  const [focused, setFocused] = useState(true);
  const located = useRef(false);
  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await requestMapLocationAccess(true);
      if (!permission?.granted) {
        if (permission && !permission.canAskAgain) Alert.alert('Location access is off', 'Enable location access in device settings.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open settings', onPress: () => void Linking.openSettings() }]);
        else m.setNotice('You can browse the map without location access.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      m.locate({ lat: result.coords.latitude, lng: result.coords.longitude });
    } catch { m.setError('Could not find your location. Check device location services and try again.'); }
    finally { setLocating(false); }
  };
  useFocusEffect(useCallback(() => {
    setFocused(true);
    if (!located.current) {
      located.current = true;
      void locate();
    }
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    if (!focused || !m.sharing || !m.accepting || mode !== 'agent') return;
    let watcher: Location.LocationSubscription | undefined, disposed = false, starting = false, sending = false;
    const stop = () => { watcher?.remove(); watcher = undefined; };
    const start = async () => {
      if (watcher || starting || AppState.currentState !== 'active') return;
      starting = true;
      try {
        const permission = await requestMapLocationAccess(true);
        if (!permission?.granted) { m.setSharing(false); m.setError('Location permission is needed to share your agent location.'); return; }
        if (disposed || AppState.currentState !== 'active') return;
        const send = (lat: number, lng: number) => {
          if (disposed || AppState.currentState !== 'active' || sending || Date.now() - lastSent.current < 30000) return;
          lastSent.current = Date.now(); sending = true;
          void api.liveLocation({ lat, lng }).catch(e => { m.setError(e.message); m.setSharing(false); }).finally(() => { sending = false; });
        };
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          send(current.coords.latitude, current.coords.longitude);
        } catch { /* watch below still starts */ }
        if (disposed || AppState.currentState !== 'active') return;
        const next = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 100 }, position => {
          send(position.coords.latitude, position.coords.longitude);
        });
        if (disposed || AppState.currentState !== 'active') next.remove(); else watcher = next;
      } catch { m.setSharing(false); m.setError('Location sharing could not start.'); }
      finally { starting = false; }
    };
    void start();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void start(); else stop(); });
    return () => { disposed = true; stop(); subscription.remove(); };
  }, [focused, m.sharing, m.accepting, mode]);
  const card = { padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.card, gap: 12 } as const;
  const text = { color: c.text, lineHeight: 22 }, title = { color: c.text, fontSize: 20, fontWeight: '700' as const };
  return <FeedShell tab={mode === 'business' ? 'overview' : 'explore'}>
    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 18, paddingBottom: TAB_BAR_SPACE + 36, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center', flexGrow: 1 }}>
      <Text style={{ ...title, fontSize: 27 }}>Plateau map</Text>
      <Text style={text}>Find places, businesses, and your delivery locations.</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{['Places','Businesses','Deliveries'].map(layer => <AppButton key={layer} label={layer} variant={m.layer === layer ? 'primary' : 'secondary'} onPress={() => m.setLayer(layer)} />)}</View>
      {m.layer !== 'Deliveries' && <TextInput accessibilityLabel="Search Plateau places" placeholder="Search places in Plateau" placeholderTextColor={c.textMuted} value={m.query} onChangeText={m.setQuery} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, color: c.text }} />}
      {!!m.error && <Text accessibilityRole="alert" style={{ color: c.error }}>{m.error}</Text>}
      {!!m.notice && <Text accessibilityLiveRegion="polite" style={text}>{m.notice}</Text>}
      <View>
        <PlateauMapView pins={m.pins} point={m.point} me={m.me} selection={m.selection} bounds={m.config.bounds} onSelect={m.select} />
        <View style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 4 }}><AppButton label={locating ? 'Locating…' : 'My location'} disabled={locating} onPress={() => void locate()} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}><AppButton label="Refresh" variant="secondary" disabled={m.loading || m.busy} onPress={m.refresh} /></View>
      <Text style={text}>Tap the map to select a position. You can browse without sharing your location.</Text>
      {m.selection && <Text selectable style={text}>Selected: {m.selection.lat.toFixed(6)}, {m.selection.lng.toFixed(6)}</Text>}
      {mode === 'agent' && <View style={card}><Text style={title}>Agent location sharing</Text><Text style={text}>Share your position for nearby request matching while this map is open and the app is in use. Stops when you leave or switch it off.</Text><Switch accessibilityLabel="Share agent location" value={m.sharing} onValueChange={(on) => void m.setSharing(on)} /><Text style={text}>{m.sharing ? 'Your live position is being shared.' : 'Turn this on to share your position while the map is open.'}</Text></View>}
      {m.loading && <ActivityIndicator color={c.primary} />}
      {!m.loading && !m.pins.length && !m.error && <Text style={text}>{m.layer === 'Places' ? 'Enter at least two characters to search places.' : 'No map pins found.'}</Text>}
      {m.layer === 'Places' && <Text style={text}>Place results powered by Google Maps.</Text>}
      {m.pins.map(pin => <View key={pin.id} style={card}><Text style={title}>{pin.label}</Text>{!!pin.address && <Text style={text}>{pin.address}</Text>}{pin.attributions?.map((a,i) => <Text key={i} style={text}>{a.provider}</Text>)}<AppButton label="Show on map" variant="secondary" onPress={() => { m.select(pin); if (pin.address) setAddress(pin.address); }} /><AppButton label="Directions" variant="secondary" onPress={() => void Linking.openURL(directionsUrl(pin))} /></View>)}
      {m.layer === 'Deliveries' && <><Text style={text}>Only your active jobs appear here. Customer addresses are private.</Text><TextInput accessibilityLabel="Address for selected position" placeholder="Address for selected position" value={address} onChangeText={setAddress} placeholderTextColor={c.textMuted} style={{ ...text, padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: 12 }} />{m.jobs.map(job => <View key={job.job_id} style={card}><Text style={title}>Job #{job.job_id}</Text><Text style={text}>Pickup: {job.pickup_address || 'Not set'}</Text><Text style={text}>Delivery: {job.destination_address || 'Not set'}</Text><AppButton label={mode === 'agent' ? 'Set pickup to selected position' : 'Set delivery to selected position'} disabled={!m.selection || !address.trim() || m.busy} onPress={() => void m.run(() => api.jobLocations(job.job_id, { [mode === 'agent' ? 'pickup' : 'destination']: { ...m.selection, address } }), 'Job location saved.')} /></View>)}</>}
      {mode === 'business' && <View style={card}><Text style={title}>Add to map</Text><Text style={text}>{m.config.listing_price ? `Publish a named pin for NGN ${m.config.listing_price.toLocaleString('en-NG')}, paid from your wallet.` : 'Map listing payments have not been enabled yet.'}</Text><AppButton label="Save selected position" disabled={!m.selection || m.busy} onPress={() => void m.run(() => api.createPin(m.selection!), 'Position saved. Name and pay below to publish.')} /><TextInput accessibilityLabel="Business location name" placeholder="Business location name" value={label} onChangeText={setLabel} placeholderTextColor={c.textMuted} style={{ ...text, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12 }} />{m.mine.map(pin => <View key={pin.id} style={{ gap: 10 }}><Text style={text}>{pin.label || 'Unnamed location'} · {pin.payment_status}</Text>{pin.payment_status !== 'paid' && <AppButton label={`Pay NGN ${m.config.listing_price || '—'} and publish`} disabled={!m.config.listing_price || !label.trim() || m.busy} onPress={() => Alert.alert('Publish location?', `Charge NGN ${m.config.listing_price} from your wallet for “${label.trim()}”?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Pay and publish', onPress: () => void m.run(() => api.payPin(pin.id, label, m.config.listing_price!), 'Your business pin is published.') }])} />}</View>)}<AppButton label="Wallet / top up" variant="secondary" onPress={() => router.push('/business/wallet' as never)} /></View>}
      <View style={card}><Text style={title}>How this map works</Text><Text style={text}>1. Search or browse pins without turning on location.</Text><Text style={text}>2. Your pin is your current location. Tap My location to refresh it.</Text><Text style={text}>3. Business listings appear after they are paid and published.</Text><Text style={text}>4. Delivery pins are limited to jobs you are part of.</Text></View>
    </ScrollView>
  </FeedShell>;
}
