import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  DEFAULT_MEMBERSHIP_SETTINGS,
  getMembershipSettings,
  isPersonalMembershipEnabled,
  type MembershipPlan,
  type MembershipSettings,
} from "../api/membership";

const CACHE_KEY = "joscity.membershipSettings";

function withPlan(fallback: MembershipPlan, row?: Partial<MembershipPlan>): MembershipPlan {
  const items =
    Array.isArray(row?.items) && row.items.length ? row.items : fallback.items;
  return { ...fallback, ...row, items };
}

export function useMembershipSettings() {
  const [settings, setSettings] = useState<MembershipSettings>(
    DEFAULT_MEMBERSHIP_SETTINGS
  );
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as MembershipSettings;
        setSettings({
          personal: withPlan(DEFAULT_MEMBERSHIP_SETTINGS.personal, parsed.personal),
          business: withPlan(DEFAULT_MEMBERSHIP_SETTINGS.business, parsed.business),
        });
        setReady(true);
      }
    } catch {
      // keep defaults
    }

    const next = await getMembershipSettings();
    setSettings(next);
    setReady(true);
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

  return {
    settings,
    ready,
    personalEnabled: isPersonalMembershipEnabled(settings),
    personalPlan: settings.personal,
    businessPlan: settings.business,
    reload: load,
  };
}
