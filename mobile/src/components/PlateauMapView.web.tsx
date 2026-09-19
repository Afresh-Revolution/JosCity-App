import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';
import GooglePlateauMap, { MapViewProps } from './GooglePlateauMap.web';

export default function PlateauMapView(props: MapViewProps) {
  return <GooglePlateauMap {...props} apiKey={GOOGLE_MAPS_API_KEY} />;
}
