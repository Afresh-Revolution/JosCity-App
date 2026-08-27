import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AvatarCircle from "../feed/AvatarCircle";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  name?: string;
  uri?: string | null;
  size?: number;
  /** true = green dot, false = grey dot, null/undefined = hide status */
  online?: boolean | null;
};

const ONLINE = "#22C55E";
const OFFLINE = "#9CA3AF";

export default function PresenceAvatar({ name, uri, size = 48, online }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const dot = Math.max(10, Math.round(size * 0.26));
  const showStatus = online === true || online === false;

  return (
    <View style={{ width: size, height: size }}>
      <AvatarCircle name={name} uri={uri} size={size} />
      {showStatus ? (
        <View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              borderColor: colors.background,
              backgroundColor: online ? ONLINE : OFFLINE,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    dot: {
      position: "absolute",
      right: 0,
      bottom: 0,
      borderWidth: 2,
    },
  });
}
