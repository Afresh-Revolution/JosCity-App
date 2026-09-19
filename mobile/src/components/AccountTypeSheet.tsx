import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../theme/colors";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPersonal: () => void;
  onBusiness: () => void;
  onAgent: () => void;
};

export default function AccountTypeSheet({
  visible,
  onClose,
  onPersonal,
  onBusiness,
  onAgent,
}: Props) {
  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    overlay.setValue(0);
    sheet.setValue(420);
  }, [overlay, sheet, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.dim, { opacity: overlay }]} />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY: sheet }],
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>What are you joining as?</Text>
          <Text style={styles.subtitle}>
            Choose how you want to be part of JOSCITY.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onPersonal}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Personal account</Text>
              <Text style={styles.cardBody}>
                Discover the city, shop the marketplace and use your wallet.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onBusiness}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Business account</Text>
              <Text style={styles.cardBody}>
                List your shop, get discovered in Jos, and manage your business on JOSCITY.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onAgent} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.iconWrap}><Ionicons name="bicycle-outline" size={22} color="#8B5CF6" /></View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Agents</Text>
              <Text style={styles.cardBody}>Help people buy and deliver across the city with your JosCity account.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D5D0C8",
    marginBottom: 18,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.iconSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardCopy: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
