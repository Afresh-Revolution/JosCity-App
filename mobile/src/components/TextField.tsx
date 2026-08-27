import { ReactNode, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Props = TextInputProps & {
  label: string;
  left?: ReactNode;
  right?: ReactNode;
  helper?: string;
  error?: string;
  labelColor?: string;
};

export default function TextField({
  label,
  left,
  right,
  helper,
  error,
  labelColor,
  style,
  ...inputProps
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginBottom: 16,
        },
        label: {
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 13,
          color: colors.text,
          marginBottom: 8,
        },
        field: {
          minHeight: 54,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.fieldBorder,
          backgroundColor: colors.fieldBg,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
        },
        input: {
          flex: 1,
          fontFamily: "Montserrat_400Regular",
          fontSize: 15,
          color: colors.text,
          paddingVertical: 12,
        },
        addon: {
          marginHorizontal: 4,
        },
        helper: {
          marginTop: 6,
          fontFamily: "Montserrat_400Regular",
          fontSize: 12,
          color: colors.textMuted,
        },
        error: {
          marginTop: 6,
          fontFamily: "Montserrat_400Regular",
          fontSize: 12,
          color: colors.error,
        },
        fieldError: {
          borderColor: colors.error,
        },
        fieldLocked: {
          backgroundColor: colors.sheet,
        },
        fieldMultiline: {
          alignItems: "flex-start",
          minHeight: 96,
          paddingVertical: 8,
        },
        inputMultiline: {
          minHeight: 72,
          textAlignVertical: "top",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: labelColor || colors.text }]}>{label}</Text>
      <View
        style={[
          styles.field,
          inputProps.multiline ? styles.fieldMultiline : null,
          error ? styles.fieldError : null,
          inputProps.editable === false ? styles.fieldLocked : null,
        ]}
      >
        {left ? <View style={styles.addon}>{left}</View> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, inputProps.multiline ? styles.inputMultiline : null, style]}
          {...inputProps}
        />
        {right ? <View style={styles.addon}>{right}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}
