import { Image, StyleSheet, View } from "react-native";
import type { MessageReceipt as Receipt } from "../../api/chat";

const logo = require("../../../assets/logo.png");

type Props = {
  status: Receipt;
  label: string;
};

export default function MessageReceipt({ status, label }: Props) {
  const doubled = status === "received" || status === "read";
  const opacity = status === "sending" ? 0.35 : status === "sent" ? 0.55 : status === "received" ? 0.78 : 1;

  return (
    <View
      style={[styles.cluster, doubled && styles.clusterWide]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {doubled ? (
        <Image source={logo} style={[styles.mark, styles.back, { opacity }]} />
      ) : null}
      <Image source={logo} style={[styles.mark, doubled && styles.front, { opacity }]} />
      {status === "read" ? <View style={styles.readDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    width: 13,
    height: 13,
  },
  clusterWide: {
    width: 20,
  },
  mark: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
  back: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  front: {
    position: "absolute",
    left: 7,
    top: 0,
  },
  readDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C8F04D",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
