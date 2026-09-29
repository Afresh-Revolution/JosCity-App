import { useMemo, useState } from "react";
import { NativeSyntheticEvent, Pressable, StyleSheet, Text, TextInputFocusEventData, View } from "react-native";
import { ErrorBanner } from "../AppNotice";
import TextField from "../TextField";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { formatCbcAmount, type CbcQuote } from "../../utils/cbcQuote";
import { formatNaira } from "../../utils/format";
import { fieldErrorMap, missingFields, type FieldCheck } from "../../utils/formValidation";

type CardDetails = {
  cardNumber: string;
  cvc: string;
  cardPin: string;
};

type Props = {
  amountNaira: number;
  quote?: CbcQuote | null;
  busy?: boolean;
  error?: string | null;
  onPay: (details: CardDetails) => void;
  onPinFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export default function CbcCardPayForm({ amountNaira, quote, busy, error, onPay, onPinFocus }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cardNumber, setCardNumber] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [requiredLabels, setRequiredLabels] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cbcCopy = formatCbcAmount(amountNaira, quote);

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = () => {
    const number = digits(cardNumber);
    const code = digits(cvc);
    const pin = digits(cardPin);
    const checks: FieldCheck[] = [
      {
        key: "cardNumber",
        label: "CBC card number",
        ok: number.length >= 8 && number.length <= 19,
      },
      { key: "cvc", label: "CVC", ok: code.length > 0 },
      { key: "cardPin", label: "Card PIN", ok: pin.length >= 4 },
    ];
    const missing = missingFields(checks);
    if (missing.length) {
      setFieldErrors(fieldErrorMap(missing));
      setRequiredLabels(missing.map((item) => item.label));
      setLocalError(
        missing.length === 1
          ? `Add your ${missing[0].label.toLowerCase()}, then try again.`
          : "Fill in these card details, then try again."
      );
      return;
    }
    setLocalError(null);
    setRequiredLabels([]);
    setFieldErrors({});
    onPay({ cardNumber: number, cvc: code, cardPin: pin });
  };

  const bannerMessage = localError || error;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pay with CBC</Text>
      <Text style={styles.lead}>
        Charge {formatNaira(amountNaira)}
        {cbcCopy ? ` ≈ ${cbcCopy}` : ""} from your CBrilliance card. JosCity never stores the card number, CVC, or PIN.
      </Text>
      {bannerMessage ? (
        <ErrorBanner
          title={requiredLabels.length ? "Almost there" : undefined}
          message={bannerMessage}
          required={requiredLabels}
        />
      ) : null}
      <TextField
        label="CBC card number"
        value={cardNumber}
        onChangeText={(value) => {
          setCardNumber(value);
          clearFieldError("cardNumber");
        }}
        error={fieldErrors.cardNumber}
        keyboardType="number-pad"
        autoCapitalize="none"
        editable={!busy}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="CVC"
            value={cvc}
            onChangeText={(value) => {
              setCvc(value);
              clearFieldError("cvc");
            }}
            error={fieldErrors.cvc}
            keyboardType="number-pad"
            editable={!busy}
            secureTextEntry
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Card PIN"
            value={cardPin}
            onChangeText={(value) => {
              setCardPin(value);
              clearFieldError("cardPin");
            }}
            error={fieldErrors.cardPin}
            onFocus={onPinFocus}
            keyboardType="number-pad"
            editable={!busy}
            secureTextEntry
          />
        </View>
      </View>
      <Pressable
        onPress={submit}
        disabled={busy}
        style={[styles.submit, busy && styles.submitBusy]}
        accessibilityRole="button"
        accessibilityLabel="Pay with CBC"
      >
        <Text style={styles.submitText}>{busy ? "Charging card…" : "Pay with CBC"}</Text>
      </Pressable>
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
    row: {
      flexDirection: "row",
      gap: 12,
    },
    half: {
      flex: 1,
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
      fontSize: 15,
      color: colors.white,
    },
  });
}
