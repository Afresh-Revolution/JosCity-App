import { type RefObject, useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  inputRef?: RefObject<TextInput | null>;
};

export default function DirectorySearch({
  value,
  onChangeText,
  placeholder,
  inputRef,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 14,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.sheet,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    input: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      paddingVertical: 0,
    },
  });
}
