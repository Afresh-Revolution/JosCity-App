import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LISTING_CATEGORIES } from "../../constants/listingCategories";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { categoryIcon } from "./MarketFilters";

type Props = {
  visible: boolean;
  category: string;
  categories?: readonly string[];
  onClose: () => void;
  onSelect: (category: string) => void;
};

export default function MarketCategorySheet({
  visible,
  category,
  categories = LISTING_CATEGORIES,
  onClose,
  onSelect,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(520)).current;
  const options = ["All", ...categories];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    overlay.setValue(0);
    sheet.setValue(520);
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
          <Text style={styles.title}>{t("listing.category")}</Text>
          <Text style={styles.subtitle}>{t("listing.categoryPlaceholder")}</Text>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((item) => {
              const active = item === category;
              const label = item === "All" ? t("explore.marketAll") : item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[styles.row, active && styles.rowActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                    <Ionicons
                      name={categoryIcon(item)}
                      size={18}
                      color={active ? colors.white : colors.primary}
                    />
                  </View>
                  <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                    {label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      maxHeight: "72%",
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      paddingHorizontal: 16,
    },
    handle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      marginBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: 8,
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.sheet,
    },
    rowActive: {
      backgroundColor: colors.navActive,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    iconWrapActive: {
      backgroundColor: colors.primary,
    },
    rowText: {
      flex: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    rowTextActive: {
      color: colors.primary,
      fontFamily: "Montserrat_700Bold",
    },
    checkSpacer: {
      width: 20,
    },
  });
}
