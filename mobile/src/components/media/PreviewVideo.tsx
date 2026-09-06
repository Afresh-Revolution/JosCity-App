import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView, type VideoContentFit } from "expo-video";
import { runVideoPlayer } from "../../utils/videoPlayer";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  playing?: boolean;
  muted?: boolean;
  loop?: boolean;
};

export default function PreviewVideo({
  uri,
  style,
  contentFit = "cover",
  playing = false,
  muted = true,
  loop = false,
}: Props) {
  const player = useVideoPlayer(uri || null, (next) => {
    next.loop = loop;
    next.muted = muted;
    runVideoPlayer(next, (item) => {
      if (playing) item.play?.();
      else item.pause?.();
    });
  });

  useEffect(() => {
    runVideoPlayer(player, (item) => {
      item.loop = loop;
    });
  }, [loop, player]);

  useEffect(() => {
    runVideoPlayer(player, (item) => {
      item.muted = muted;
    });
  }, [muted, player]);

  useEffect(() => {
    runVideoPlayer(player, (item) => {
      if (playing) item.play?.();
      else item.pause?.();
    });
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      pointerEvents="none"
    />
  );
}
