import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { absoluteUrl, initials } from "../../utils/format";

type Props = {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AvatarCircle({ name, uri, size = 40, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        circle: {
          backgroundColor: colors.avatarBg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        letters: {
          fontFamily: "Montserrat_700Bold",
          color: colors.primary,
        },
      }),
    [colors]
  );
  const [failed, setFailed] = useState(false);
  const source = absoluteUrl(uri);
  const showImage = Boolean(source) && !failed;
  const letters = initials(name);
  const fontSize = size >= 56 ? 20 : size >= 44 ? 16 : 13;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: source }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.letters, { fontSize }]}>{letters}</Text>
      )}
    </View>
  );
}
