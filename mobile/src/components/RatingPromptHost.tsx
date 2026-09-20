import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "./JosCityLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  dismissOrderReview,
  getPendingRatings,
  getRatingPrompt,
  submitOrderReview,
  type PendingRating,
} from "../api/marketplace";
import { ErrorBanner, showNotice } from "./AppNotice";
import { useI18n } from "../i18n/I18nProvider";
import {
  clearRequestedRatingOrder,
  getRequestedRatingOrderId,
  onRatingPromptRequest,
} from "../state/ratingPrompt";
import { getAccountType, isBusinessAccountType } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const STAR_GOLD = "#E8B923";

export default function RatingPromptHost() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [prompt, setPrompt] = useState<PendingRating | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const close = useCallback(() => {
    setPrompt(null);
    setRating(0);
    setComment("");
    setError(null);
    clearRequestedRatingOrder();
  }, []);

  const showPrompt = useCallback((next: PendingRating | null) => {
    if (!next) {
      close();
      return;
    }
    setPrompt(next);
    setRating(0);
    setComment("");
    setError(null);
  }, [close]);

  const loadAuto = useCallback(async () => {
    const accountType = await getAccountType();
    if (isBusinessAccountType(accountType)) return;
    if (promptRef.current) return;
    const data = await getPendingRatings();
    if (getRequestedRatingOrderId()) return;
    if (data.next) showPrompt(data.next);
  }, [showPrompt]);

  const loadRequested = useCallback(async (orderId: number) => {
    const accountType = await getAccountType();
    if (isBusinessAccountType(accountType)) return;
    const result = await getRatingPrompt(orderId);
    if (result.success && result.data) {
      showPrompt(result.data);
      return;
    }
    if (/already rated/i.test(String(result.message || ""))) {
      showNotice({ title: result.message || t("rating.already"), tone: "info" });
      return;
    }
    const data = await getPendingRatings();
    const hit = data.items.find((item) => item.order_id === orderId);
    if (hit) showPrompt(hit);
  }, [showPrompt]);

  useEffect(() => {
    void loadAuto();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadAuto();
    });
    return () => sub.remove();
  }, [loadAuto]);

  useEffect(() => {
    return onRatingPromptRequest(() => {
      const orderId = getRequestedRatingOrderId();
      if (orderId) {
        void loadRequested(orderId);
        return;
      }
      void loadAuto();
    });
  }, [loadAuto, loadRequested]);

  const onLater = async () => {
    const orderId = prompt?.order_id;
    close();
    if (orderId) void dismissOrderReview(orderId);
  };

  const onSubmit = async () => {
    if (!prompt) return;
    if (rating < 1) {
      setError(t("rating.chooseStars"));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await submitOrderReview(prompt.order_id, {
      rating,
      comment: comment.trim(),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message || t("rating.submitError"));
      return;
    }
    close();
    showNotice({
      title: t("rating.thanksTitle"),
      message: t("rating.thanksBody"),
      tone: "success",
    });
    void loadAuto();
  };

  if (!prompt) return null;

  const service = prompt.listing_kind === "service";
  const headline = service
    ? t("rating.serviceTitle", { business: prompt.business_name })
    : t("rating.productTitle", { business: prompt.business_name });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void onLater()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <Pressable style={styles.dim} onPress={() => void onLater()} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>{t("rating.kicker")}</Text>
          <Text style={styles.title}>{headline}</Text>
          <Text style={styles.item}>{prompt.listing_title}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  setRating(value);
                  setError(null);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("help.star", { count: value })}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={36}
                  color={value <= rating ? STAR_GOLD : colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t("rating.commentPlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} /></View> : null}
          <Pressable
            onPress={() => void onSubmit()}
            disabled={saving}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          >
            {saving ? (
              <JosCityLoader color={colors.white} />
            ) : (
              <Text style={styles.submitText}>{t("rating.submit")}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => void onLater()} disabled={saving} style={styles.later}>
            <Text style={styles.laterText}>{t("rating.later")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 6,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
      lineHeight: 28,
    },
    item: {
      marginTop: 8,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    stars: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 20,
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    input: {
      minHeight: 88,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      textAlignVertical: "top",
    },
    submit: {
      marginTop: 16,
      minHeight: 50,
      borderRadius: 25,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    submitText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    later: {
      marginTop: 10,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    laterText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
