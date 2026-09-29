import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import JosCityLoader from "../../../../src/components/JosCityLoader";
import { resolveShareLink } from "../../../../src/api/share";
import { useTheme } from "../../../../src/theme/ThemeProvider";

export default function ShareLinkScreen() {
  const { kind, code } = useLocalSearchParams<{ kind?: string; code?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void resolveShareLink(String(kind || ""), String(code || "")).then((link) => {
      if (!live) return;
      if (!link?.appPath) {
        setFailed(true);
        return;
      }
      const [screen, id] = link.appPath.split("/");
      if (screen === "listing" && id) {
        router.replace({ pathname: "/listing/[id]", params: { id, source: "marketplace" } });
        return;
      }
      if (screen === "people" && id) {
        router.replace({ pathname: "/people/[id]", params: { id } });
        return;
      }
      if (screen === "business" && id) {
        router.replace({ pathname: "/business/[id]", params: { id } });
        return;
      }
      if (screen === "post" && id) {
        router.replace({ pathname: "/post/[id]", params: { id } });
        return;
      }
      setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [code, kind, router]);

  useEffect(() => {
    if (!failed) return;
    router.replace("/home");
  }, [failed, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <JosCityLoader color={colors.primary} size="large" />
    </View>
  );
}
