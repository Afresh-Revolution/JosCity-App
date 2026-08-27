import { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

const SLOTS = [
  { top: 36, x: 0.0, rotate: "-10deg", w: 0.34, h: 142, z: 2 },
  { top: 8, x: 0.22, rotate: "7deg", w: 0.36, h: 156, z: 5 },
  { top: 42, x: 0.48, rotate: "-6deg", w: 0.32, h: 136, z: 3 },
  { top: 6, x: 0.66, rotate: "11deg", w: 0.34, h: 148, z: 4 },
  { top: 108, x: 0.12, rotate: "5deg", w: 0.28, h: 118, z: 1 },
  { top: 114, x: 0.54, rotate: "-8deg", w: 0.3, h: 124, z: 2 },
] as const;

export default function NewsCollage({ urls }: { urls: string[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const photos = urls.slice(0, 6);

  if (photos.length <= 1) {
    return photos[0] ? (
      <Image source={{ uri: photos[0] }} style={styles.hero} />
    ) : (
      <View style={[styles.hero, styles.fallback]} />
    );
  }

  return (
    <View
      style={styles.stage}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width
        ? photos.map((uri, index) => {
            const slot = SLOTS[index] || SLOTS[SLOTS.length - 1];
            return (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={[
                  styles.polaroid,
                  {
                    top: slot.top,
                    left: Math.round(width * slot.x),
                    width: Math.round(width * slot.w),
                    height: slot.h,
                    zIndex: slot.z,
                    transform: [{ rotate: slot.rotate }],
                  },
                ]}
              />
            );
          })
        : null}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    hero: {
      width: "100%",
      height: 214,
      borderRadius: 18,
      backgroundColor: colors.cream,
    },
    fallback: {
      backgroundColor: colors.border,
    },
    stage: {
      height: 236,
    },
    polaroid: {
      position: "absolute",
      borderRadius: 8,
      borderWidth: 3,
      borderColor: colors.white,
      backgroundColor: colors.cream,
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  });
}
