import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import TextField from "../TextField";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { formatCbcAmount, type CbcQuote } from "../../utils/cbcQuote";
import { formatNaira } from "../../utils/format";

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
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export default function CbcCardPayForm({ amountNaira, quote, busy, error, onPay }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cardNumber, setCardNumber] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const cbcCopy = formatCbcAmount(amountNaira, quote);

  const submit = () => {
    const number = digits(cardNumber);
    const code = digits(cvc);
    const pin = digits(cardPin);
    if (number.length < 8 || number.length > 19) {
      setLocalError("Enter a valid CBC card number.");
      return;
    }
    if (!code) {
      setLocalError("Enter your CVC.");
      return;
    }
    if (pin.length < 4) {
      setLocalError("Enter your Card PIN.");
      return;
    }
    setLocalError(null);
    onPay({ cardNumber: number, cvc: code, cardPin: pin });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pay with CBC</Text>
      <Text style={styles.lead}>
        Charge {formatNaira(amountNaira)}
        {cbcCopy ? ` ≈ ${cbcCopy}` : ""} from your CBrilliance card. JosCity never stores the card number, CVC, or PIN.
      </Text>
      <TextField
        label="CBC card number"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="number-pad"
        autoCapitalize="none"
        editable={!busy}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="CVC"
            value={cvc}
            onChangeText={setCvc}
            keyboardType="number-pad"
            editable={!busy}
            secureTextEntry
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Card PIN"
            value={cardPin}
            onChangeText={setCardPin}
            keyboardType="number-pad"
            editable={!busy}
            secureTextEntry
          />
        </View>
      </View>
      {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}
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
  });
}
