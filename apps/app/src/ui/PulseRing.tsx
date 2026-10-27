import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { color } from "./tokens";

interface PulseRingProps {
  delay: number;
  size?: number;
}

export function PulseRing({ delay, size = 80 }: PulseRingProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.set(0);
    animatedValue.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 2400 }), -1, false),
      ),
    );
  }, [animatedValue, delay]);

  const rStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedValue.value * 1.5 + 1 }],
    opacity: (1 - animatedValue.value) * 0.6,
  }));

  const $dynamicStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return <Animated.View style={[$staticPulseRing, $dynamicStyle, rStyle]} />;
}

const $staticPulseRing: ViewStyle = {
  position: "absolute",
  backgroundColor: color.accentMuted,
  borderWidth: 1,
  borderColor: color.accent,
};
