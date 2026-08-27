import { useCallback } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import SplashScreen from "../src/screens/SplashScreen";
import { isOnboardingComplete } from "../src/storage/onboarding";
import { getActiveSession } from "../src/storage/session";

export default function Index() {
  const router = useRouter();

  const onFinished = useCallback((_hasSession: boolean) => {
    void (async () => {
      const session = await getActiveSession();
      if (session?.token) {
        router.replace((session.accountType === "business" ? "/business" : "/home") as never);
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
