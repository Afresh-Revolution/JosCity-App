import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Bounds, inBounds, MapPin, Point } from '../api/agent';
import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';
import { clampPoint } from '../state/usePlateauMap';

export type MapViewProps = { pins: MapPin[]; point: Point; me?: Point | null; selection: Point | null; bounds: Bounds; onSelect: (point: Point) => void };

export default function PlateauMapView({ pins, point, me, selection, bounds, onSelect }: MapViewProps) {
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    ref.current?.animateToRegion({ latitude: point.lat, longitude: point.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 400);
  }, [point, ready]);
  return (
    <View style={styles.canvas}>
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: point.lat, longitude: point.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        minZoomLevel={8}
        maxZoomLevel={19}
        pitchEnabled={false}
        rotateEnabled={false}
        onMapReady={() => {
          setReady(true);
          setTimedOut(false);
          ref.current?.setMapBoundaries({ latitude: bounds.maxLat, longitude: bounds.maxLng }, { latitude: bounds.minLat, longitude: bounds.minLng });
        }}
        onPress={event => onSelect({ lat: event.nativeEvent.coordinate.latitude, lng: event.nativeEvent.coordinate.longitude })}
        onRegionChangeComplete={region => {
          const p = { lat: region.latitude, lng: region.longitude };
          if (!inBounds(p, bounds)) {
            const limited = clampPoint(p, bounds);
            ref.current?.animateToRegion({ ...region, latitude: limited.lat, longitude: limited.lng }, 200);
          }
        }}
      >
        {pins.map(p => <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.label} description={p.address} tracksViewChanges={false} />)}
        {me && <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} title="You" description="Your current location" pinColor="#1A73E8" tracksViewChanges={false} />}
        {selection && <Marker coordinate={{ latitude: selection.lat, longitude: selection.lng }} title="Selected position" pinColor="#146a43" />}
      </MapView>
      {(!GOOGLE_MAPS_API_KEY || (timedOut && !ready)) && (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.title}>{GOOGLE_MAPS_API_KEY ? 'Google Maps did not load' : 'Google Maps key missing'}</Text>
          <Text style={styles.copy}>
            {GOOGLE_MAPS_API_KEY
              ? 'Restart Expo, then rebuild the native app so EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is written into Google Maps.'
              : 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env and restart Expo.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { height: 360, width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#E7F3EC' },
  banner: { position: 'absolute', left: 12, right: 12, top: 12, zIndex: 2, padding: 14, borderRadius: 14, backgroundColor: 'rgba(244,241,234,0.94)' },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 16, color: '#0F3D26', marginBottom: 6 },
  copy: { fontFamily: 'Montserrat_400Regular', fontSize: 13, color: '#5C5C5C', lineHeight: 18 },
});
