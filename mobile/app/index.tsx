import { useCallback } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import SplashScreen from "../src/screens/SplashScreen";
import { isOnboardingComplete } from "../src/storage/onboarding";
import { getActiveSession, homeRouteForAccount } from "../src/storage/session";
import { loadSignupDraft, signupDraftRoute } from "../src/storage/signupDraft";

export default function Index() {
  const router = useRouter();

  const onFinished = useCallback((_hasSession: boolean) => {
    void (async () => {
      const session = await getActiveSession();
      if (session?.token) {
        router.replace(homeRouteForAccount(session.accountType) as never);
        return;
      }
      const draft = await loadSignupDraft();
      if (draft) {
        router.replace(signupDraftRoute(draft) as never);
        return;
      }
      const done = await isOnboardingComplete();
      router.replace(done ? "/welcome" : "/onboarding");
    })();
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <SplashScreen onFinished={onFinished} />
    </>
  );
}
