const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const isDevClientBuild = profile === "development" || profile === "development-ios";

module.exports = ({ config }) => {
  const ios = {
    ...(config.ios || {}),
    config: {
      ...((config.ios && config.ios.config) || {}),
      googleMapsApiKey: mapsKey,
    },
  };

  // Universal links need Associated Domains on the Apple provisioning profile.
  // Enable them for store/production builds only so development Ad Hoc builds can ship.
  if (!isDevClientBuild) {
    ios.associatedDomains = ["applinks:joscity.com", "applinks:www.joscity.com"];
  } else {
    delete ios.associatedDomains;
  }

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      googleMapsApiKey: mapsKey,
    },
    ios,
    android: {
      ...(config.android || {}),
      config: {
        ...((config.android && config.android.config) || {}),
        googleMaps: { apiKey: mapsKey },
      },
      intentFilters: [...((config.android && config.android.intentFilters) || [])],
      permissions: [
        ...new Set([
          ...((config.android && config.android.permissions) || []),
          "android.permission.ACCESS_COARSE_LOCATION",
          "android.permission.ACCESS_FINE_LOCATION",
          "android.permission.POST_NOTIFICATIONS",
          "android.permission.NFC",
          "android.permission.VIBRATE",
        ]),
      ],
    },
    plugins: [
      ...(config.plugins || []).filter(
        (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== "react-native-maps"
      ),
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: mapsKey,
          iosGoogleMapsApiKey: mapsKey,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            buildArchs: ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"],
            useLegacyPackaging: false,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
  };
};
