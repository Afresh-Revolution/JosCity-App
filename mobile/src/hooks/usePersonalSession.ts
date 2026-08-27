import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { hasSession } from "../storage/session";

export function useRequirePersonalAccount() {
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
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return allowed;
}
