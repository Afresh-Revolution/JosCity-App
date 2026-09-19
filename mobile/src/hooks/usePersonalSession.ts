import { useEffect, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { getActiveSession, hasSession, homeRouteForAccount, isDedicatedAgentAccount } from "../storage/session";

function isPersonalAccountSection(path: string) {
  return (
    path === "/home" ||
    path === "/explore" ||
    path === "/map" ||
    path === "/notifications" ||
    path === "/profile"
  );
}

export function useRequirePersonalAccount() {
  const router = useRouter();
  const pathname = usePathname();
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
      const session = await getActiveSession();
      if (cancelled) return;
      if (
        isDedicatedAgentAccount(session?.user, session?.accountType) &&
        isPersonalAccountSection(pathname)
      ) {
        router.replace(homeRouteForAccount("agent"));
        return;
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return allowed;
}
