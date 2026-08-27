import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  DEFAULT_APP_FEATURES,
  getAppFeatures,
  type AppFeaturesMap,
  type FeatureKey,
} from "../api/appFeatures";

const CACHE_KEY = "joscity.appFeatures";

export function useAppFeatures() {
  const [features, setFeatures] = useState<AppFeaturesMap>(DEFAULT_APP_FEATURES);

  const load = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AppFeaturesMap;
        setFeatures({ ...DEFAULT_APP_FEATURES, ...parsed });
      }
    } catch {
      // keep defaults
    }

    const next = await getAppFeatures();
    setFeatures(next);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      // ignore cache write errors
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const enabled = useCallback(
    (key: FeatureKey) => Boolean(features[key]?.enabled),
    [features]
  );
  const label = useCallback(
    (key: FeatureKey) => features[key]?.coming_soon_label || "Coming soon",
    [features]
  );

  return { features, enabled, label, reload: load };
}
