import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
import { absoluteUrl, initials } from "../../utils/format";

type Props = {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  preview?: boolean;
};

export default function AvatarCircle({
  name,
  uri,
  size = 40,
  style,
  preview = false,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [open, setOpen] = useState(false);
  const source = absoluteUrl(uri);
  const showImage = Boolean(source) && !failed;
  const letters = initials(name);
  const fontSize = size >= 56 ? 20 : size >= 44 ? 16 : 13;
  const canPreview = preview && showImage;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const circle = (
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

  if (!canPreview) return circle;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="View profile photo"
      >
        {circle}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={viewer.root}>
          <Pressable style={viewer.imageWrap} onPress={() => setOpen(false)}>
            <Image source={{ uri: source }} style={viewer.full} resizeMode="contain" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setOpen(false)}
            style={[viewer.close, { top: Math.max(insets.top, 12) }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const viewer = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imageWrap: {
    flex: 1,
  },
  full: {
    width: "100%",
    height: "100%",
  },
  close: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
});
