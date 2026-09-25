import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../JosCityLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { StoryViewer } from "../../api/stories";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { timeAgo } from "../../utils/format";
import AvatarCircle from "./AvatarCircle";

type Props = {
  visible: boolean;
  loading?: boolean;
  views: number;
  viewers: StoryViewer[];
  onClose: () => void;
  onOpenProfile?: (viewer: StoryViewer) => void;
};

export default function StatusViewsSheet({
  visible,
  loading = false,
  views,
  viewers,
  onClose,
  onOpenProfile,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(520)).current;

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
          duration: 320,
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
              paddingBottom: Math.max(insets.bottom, 18),
              transform: [{ translateY: sheet }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t("status.viewsTitle")}</Text>
              <Text style={styles.subtitle}>
                {views} {views === 1 ? t("status.view") : t("status.views")}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.empty}>
              <JosCityLoader color={colors.primary} />
            </View>
          ) : viewers.length ? (
            <FlatList
              data={viewers}
              keyExtractor={(item) => String(item.id || item.userId)}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenProfile?.(item)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <AvatarCircle name={item.name} uri={item.picture} size={44} />
                  <View style={styles.rowCopy}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.liked ? (
                        <Ionicons
                          name="heart"
                          size={14}
                          color={colors.badge}
                          accessibilityLabel={t("status.liked")}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.when} numberOfLines={1}>
                      {item.timeAgo || timeAgo(item.viewedAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="eye-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t("status.noViews")}</Text>
            </View>
          )}
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
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheet: {
      maxHeight: "72%",
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
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.white,
    },
    list: {
      marginTop: 4,
    },
    listContent: {
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
    },
    rowCopy: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      flexShrink: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    when: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 36,
      gap: 10,
    },
    emptyText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
