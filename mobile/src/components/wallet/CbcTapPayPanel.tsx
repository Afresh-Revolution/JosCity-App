import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  confirmListingCbcTap,
  getCbcTapConfig,
  startListingCbcTap,
} from "../../api/marketplace";
import { nfcHoldHint, type NfcCardRead } from "../../nfc/readCbcCard";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { formatTapCountdown } from "../../utils/cbcNfc";
import { formatNaira } from "../../utils/format";

type Props = {
  orderId: number;
  amountNaira: number;
  disabled?: boolean;
  onPaid: () => void;
  onBusyChange?: (busy: boolean) => void;
  onRequestRead?: () => void;
  onPinFocus?: () => void;
  pendingRead?: { id: number; tag: NfcCardRead } | null;
  pendingError?: { id: number; message: string } | null;
};

type Phase = "idle" | "scanning" | "verifying" | "pin" | "paying";

const PIN_LENGTH = 4;
const RETRY_IN_PLACE = new Set(["PIN_INVALID", "PAY_UNCERTAIN", "FINALIZE_FAILED", "RATE_LIMITED", "NETWORK"]);

let configRequest: Promise<boolean> | null = null;

function fetchTapEnabled(): Promise<boolean> {
  if (!configRequest) {
    configRequest = getCbcTapConfig()
      .then((res) => Boolean(res.success && res.data?.enabled))
      .catch(() => false);
  }
  return configRequest;
}

export default function CbcTapPayPanel({
  orderId,
  amountNaira,
  disabled,
  onPaid,
  onBusyChange,
  onRequestRead,
  onPinFocus,
  pendingRead,
  pendingError,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const [unresolved, setUnresolved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pinRefs = useRef<Array<TextInput | null>>([]);
  const mounted = useRef(true);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    mounted.current = true;
    void fetchTapEnabled().then((value) => {
      if (mounted.current) setEnabled(value);
    });
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const busy = phase !== "idle";
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;
  useEffect(() => {
    onBusyRef.current?.(busy);
  }, [busy]);

  useEffect(() => {
    if (phase !== "scanning") return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const clearPin = useCallback(() => setPin(Array(PIN_LENGTH).fill("")), []);

  const reset = useCallback(
    (message: string | null = null) => {
      abortRef.current?.abort();
      abortRef.current = null;
      clearPin();
      setCardLast4(null);
      setSecondsLeft(0);
      setUnresolved(false);
      setError(message);
      setPhase("idle");
    },
    [clearPin]
  );

  useEffect(() => {
    if (phase !== "pin") return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "pin" && !unresolved && secondsLeft <= 0) {
      reset("Your tap session expired. Tap your card again.");
    }
  }, [phase, secondsLeft, unresolved, reset]);

  const seenRead = useRef(0);
  const seenError = useRef(0);

  const verifyTag = useCallback(
    async (tag: NfcCardRead) => {
      setPhase("verifying");
      const res = await startListingCbcTap(orderId, tag);
      if (!mounted.current) return;
      if (!res.success || !res.data) {
        reset(res.message || "We could not verify this card. Tap it again.");
        return;
      }
      setCardLast4(res.data.card_last4);
      setSecondsLeft(res.data.expires_in_seconds);
      clearPin();
      setPhase("pin");
    },
    [clearPin, orderId, reset]
  );

  useEffect(() => {
    if (!pendingRead || pendingRead.id === seenRead.current) return;
    seenRead.current = pendingRead.id;
    void verifyTag(pendingRead.tag);
  }, [pendingRead, verifyTag]);

  useEffect(() => {
    if (!pendingError || pendingError.id === seenError.current) return;
    seenError.current = pendingError.id;
    reset(pendingError.message);
  }, [pendingError, reset]);

  const startTap = () => {
    if (busy || disabled) return;
    setError(null);
    setPhase("scanning");
    onRequestRead?.();
  };

  const submitPin = async (digits: string[]) => {
    const value = digits.join("");
    if (phase !== "pin" || value.length !== PIN_LENGTH) return;
    setError(null);
    setPhase("paying");
    const res = await confirmListingCbcTap(orderId, value);
    if (!mounted.current) return;
    if (res.success) {
      clearPin();
      setUnresolved(false);
      setPhase("idle");
      onPaid();
      return;
    }
    const code = res.code || "NETWORK";
    if (RETRY_IN_PLACE.has(code)) {
      if (code === "PAY_UNCERTAIN" || code === "FINALIZE_FAILED") setUnresolved(true);
      clearPin();
      setPhase("pin");
      const left =
        typeof res.attemptsLeft === "number"
          ? ` ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.`
          : "";
      setError(`${res.message || "Payment could not be completed."}${code === "PIN_INVALID" ? left : ""}`);
      return;
    }
    reset(res.message || "This payment could not be completed. Tap your card again.");
  };

  const setDigit = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, "");
    if (only.length > 1) {
      const next = Array(PIN_LENGTH).fill("");
      only
        .slice(0, PIN_LENGTH)
        .split("")
        .forEach((digit, i) => {
          next[i] = digit;
        });
      setPin(next);
      pinRefs.current[Math.min(only.length, PIN_LENGTH) - 1]?.focus();
      return;
    }
    const digit = only.slice(-1);
    const next = [...pin];
    next[index] = digit;
    setPin(next);
    if (digit && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus();
  };

  const onPinKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !pin[index] && index > 0) {
      const next = [...pin];
      next[index - 1] = "";
      setPin(next);
      pinRefs.current[index - 1]?.focus();
    }
  };

  const pinComplete = pin.every(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Ionicons name="radio-outline" size={18} color={colors.text} />
        <Text style={styles.title}>Tap to pay</Text>
      </View>

      {enabled === null ? <Text style={styles.lead}>Checking tap to pay…</Text> : null}

      {enabled === false ? (
        <Text style={styles.lead}>Tap to pay is not available right now. Use your card details or wallet instead.</Text>
      ) : null}

      {enabled && phase === "idle" ? (
        <>
          <Text style={styles.lead}>
            Charge {formatNaira(amountNaira)} from your CBrilliance card by tapping it on your phone, then enter your
            PIN. NFC is used only for this tap. JosCity never stores your card details or PIN on this device.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => void startTap()}
            disabled={disabled}
            style={[styles.submit, disabled && styles.submitBusy]}
            accessibilityRole="button"
            accessibilityLabel="Tap card to pay"
          >
            <Text style={styles.submitText}>Tap card to pay</Text>
          </Pressable>
        </>
      ) : null}

      {phase === "scanning" ? (
        <View accessibilityRole="text" style={styles.status}>
          <Animated.View style={{ opacity: pulse }}>
            <Ionicons name="radio-outline" size={32} color={colors.primary} />
          </Animated.View>
          <Text style={styles.lead}>{nfcHoldHint()}</Text>
          <Pressable onPress={() => reset()} style={styles.ghost} accessibilityRole="button">
            <Text style={styles.ghostText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === "verifying" ? (
        <View accessibilityRole="text" style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.lead}>Checking your card…</Text>
        </View>
      ) : null}

      {phase === "pin" || phase === "paying" ? (
        <View>
          <Text style={styles.lead}>
            Card {cardLast4 ? `•••• ${cardLast4}` : "verified"} · {formatNaira(amountNaira)}
            {phase === "pin" && !unresolved ? ` · expires in ${formatTapCountdown(secondsLeft)}` : ""}
          </Text>
          <Text style={styles.lead}>Enter your 4-digit Card PIN.</Text>
          <View style={styles.boxes}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                ref={(node) => {
                  pinRefs.current[index] = node;
                }}
                value={digit}
                onChangeText={(value) => setDigit(index, value)}
                onKeyPress={({ nativeEvent }) => onPinKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={index === 0 ? PIN_LENGTH : 1}
                editable={phase !== "paying"}
                textContentType="none"
                autoComplete="off"
                importantForAutofill="no"
                autoCorrect={false}
                caretHidden
                onFocus={onPinFocus}
                style={styles.box}
                accessibilityLabel={`PIN digit ${index + 1}`}
              />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => void submitPin(pin)}
            disabled={!pinComplete || phase === "paying"}
            style={[styles.submit, (!pinComplete || phase === "paying") && styles.submitBusy]}
            accessibilityRole="button"
            accessibilityLabel={phase === "paying" ? "Processing" : `Pay ${formatNaira(amountNaira)}`}
          >
            <Text style={styles.submitText}>
              {phase === "paying" ? "Processing…" : `Pay ${formatNaira(amountNaira)}`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => reset()}
            disabled={phase === "paying"}
            style={styles.ghost}
            accessibilityRole="button"
          >
            <Text style={styles.ghostText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: {
      marginTop: 8,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cream,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    lead: {
      marginTop: 6,
      marginBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    status: {
      alignItems: "center",
      paddingVertical: 8,
    },
    boxes: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 12,
    },
    box: {
      flex: 1,
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.fieldBg,
      textAlign: "center",
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
    },
    error: {
      marginBottom: 10,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.error,
    },
    submit: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    submitBusy: {
      opacity: 0.7,
    },
    submitText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.white,
    },
    ghost: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
