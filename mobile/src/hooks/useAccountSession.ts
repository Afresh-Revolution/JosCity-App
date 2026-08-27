import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  getAccountType,
  hasSession,
  isBusinessAccountType,
  type AccountType,
} from "../storage/session";

export function useAccountType(): AccountType | null {
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const reload = useCallback(async () => {
    const next = await getAccountType();
    setAccountType(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return accountType;
}

export function useRequireBusinessAccount() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await hasSession();
      if (cancelled) return;
      if (!ok) {
        router.replace("/login");
        return;
      }
      const type = await getAccountType();
      if (cancelled) return;
      if (!isBusinessAccountType(type)) {
        router.replace("/home");
        return;
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return allowed;
}
