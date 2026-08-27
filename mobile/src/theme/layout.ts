import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);

  const scale = (size: number) => (width / BASE_WIDTH) * size;
  const verticalScale = (size: number) => (height / BASE_HEIGHT) * size;
  const moderateScale = (size: number, factor = 0.5) =>
    size + (scale(size) - size) * factor;

  return {
    width,
    height,
    shortest,
    longest,
    scale,
    verticalScale,
    moderateScale,
    logoSize: Math.min(Math.max(shortest * 0.3, 112), 196),
    titleSize: Math.min(Math.max(shortest * 0.055, 18), 26),
    titleTracking: Math.min(Math.max(shortest * 0.026, 7), 12),
    progressWidth: Math.min(Math.max(width * 0.18, 68), 110),
    progressHeight: Math.max(2, Math.round(shortest * 0.0045)),
    progressBottom: height * 0.145,
  };
}
