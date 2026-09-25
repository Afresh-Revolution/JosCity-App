const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    googleMapsApiKey: mapsKey,
  },
  ios: {
    ...(config.ios || {}),
    config: {
      ...((config.ios && config.ios.config) || {}),
      googleMapsApiKey: mapsKey,
    },
  },
  android: {
    ...(config.android || {}),
    config: {
      ...((config.android && config.android.config) || {}),
      googleMaps: { apiKey: mapsKey },
    },
    permissions: [...new Set([
      ...((config.android && config.android.permissions) || []),
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ])],
  },
  plugins: [
    ...(config.plugins || []).filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'react-native-maps'),
    ['react-native-maps', {
      androidGoogleMapsApiKey: mapsKey,
      iosGoogleMapsApiKey: mapsKey,
    }],
    ['expo-build-properties', {
      android: {
        minSdkVersion: 24,
        buildArchs: ['armeabi-v7a', 'arm64-v8a'],
        useLegacyPackaging: true,
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    }],
  ],
});
