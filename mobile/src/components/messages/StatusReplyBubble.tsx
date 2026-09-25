import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getStoryPreview, type StoryType } from "../../api/stories";
import { videoThumbnailUrl } from "../../utils/media";
import type { StatusReply } from "../../utils/statusReply";

type Props = {
  reply: StatusReply;
  mine?: boolean;
  authorName: string;
  textStyle: object;
};

type Preview = {
  type: StoryType;
  src: string;
  backgroundColor?: string;
  textColor?: string;
};

function previewFromReply(reply: StatusReply): Preview | null {
  if (!reply.preview) return null;
  const type: StoryType = reply.kind === "video" ? "video" : reply.kind === "photo" ? "photo" : "text";
  return { type, src: reply.preview };
}

function thumbUri(preview: Preview | null): string {
  if (!preview || preview.type === "text") return "";
  if (preview.type === "video") return videoThumbnailUrl(preview.src) || "";
  return /^https?:\/\//i.test(preview.src) ? preview.src : "";
}

export default function StatusReplyBubble({ reply, mine, authorName, textStyle }: Props) {
  const [preview, setPreview] = useState<Preview | null>(() => previewFromReply(reply));
  const [ready, setReady] = useState(() => Boolean(reply.preview));
  const [gone, setGone] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const embedded = previewFromReply(reply);
    if (embedded) {
      setPreview(embedded);
      setReady(true);
      setGone(false);
      setImageFailed(false);
      return;
    }
    let alive = true;
    setReady(false);
    setGone(false);
    setImageFailed(false);
    void getStoryPreview(reply.storyId).then((story) => {
      if (!alive) return;
      setReady(true);
      if (!story || (story.type !== "text" && !story.src)) {
        setGone(true);
        setPreview(null);
        return;
      }
      setPreview({
        type: story.type,
        src: story.src,
        backgroundColor: story.backgroundColor,
        textColor: story.textColor,
      });
    });
    return () => {
      alive = false;
    };
  }, [reply.kind, reply.preview, reply.storyId]);

  const image = ready && !gone && !imageFailed ? thumbUri(preview) : "";
  const textTile = ready && !gone && preview?.type === "text" && Boolean(preview.src);
  const showFallback = ready && !image && !textTile;

  return (
    <View>
      <View style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}>
        <View style={[styles.bar, mine ? styles.barMine : styles.barTheirs]} />
        <View style={styles.copy}>
          <Text style={[styles.author, mine && styles.authorMine]} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={[styles.label, mine && styles.labelMine]} numberOfLines={2}>
            {reply.label}
          </Text>
        </View>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.thumb}
            onError={() => setImageFailed(true)}
          />
        ) : textTile ? (
          <View
            style={[
              styles.thumb,
              styles.textTile,
              { backgroundColor: preview?.backgroundColor || "#0F3D26" },
            ]}
          >
            <Text
              style={[styles.textTileCopy, { color: preview?.textColor || "#FFFFFF" }]}
              numberOfLines={4}
            >
              {preview?.src}
            </Text>
          </View>
        ) : showFallback ? (
          <View style={[styles.thumb, styles.thumbFallback, mine && styles.thumbFallbackMine]}>
            <Ionicons
              name={reply.kind === "video" ? "videocam" : reply.kind === "text" ? "text" : "image"}
              size={16}
              color={mine ? "rgba(255,255,255,0.9)" : "#0F3D26"}
            />
          </View>
        ) : (
          <View style={styles.thumb} />
        )}
      </View>
      <Text style={textStyle}>{reply.reply}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quote: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 6,
    overflow: "hidden",
    minWidth: 180,
  },
  quoteMine: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  quoteTheirs: {
    backgroundColor: "rgba(15,61,38,0.08)",
  },
  bar: {
    width: 4,
    alignSelf: "stretch",
  },
  barMine: {
    backgroundColor: "#C8F04D",
  },
  barTheirs: {
    backgroundColor: "#0F3D26",
  },
  copy: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  author: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#0F3D26",
  },
  authorMine: {
    color: "#C8F04D",
  },
  label: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#4B5563",
  },
  labelMine: {
    color: "rgba(255,255,255,0.86)",
  },
  thumb: {
    width: 42,
    height: 42,
    margin: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  textTile: {
    padding: 4,
    justifyContent: "center",
  },
  textTileCopy: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 8,
    lineHeight: 10,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,61,38,0.1)",
  },
  thumbFallbackMine: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});
