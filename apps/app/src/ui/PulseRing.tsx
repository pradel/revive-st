import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/lib/useReduceMotion";

import { color } from "./tokens";

interface PulseRingProps {
  delay: number;
  size?: number;
}

/** Expanding, fading ring. Renders nothing when the OS reduce-motion setting is on. */
export function PulseRing({ delay, size = 80 }: PulseRingProps) {
  const reduceMotion = useReduceMotion();
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    animatedValue.set(0);
    animatedValue.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 2400 }), -1, false),
      ),
    );
    return () => {
      cancelAnimation(animatedValue);
    };
  }, [animatedValue, delay, reduceMotion]);

  const rStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedValue.value * 1.5 + 1 }],
    opacity: (1 - animatedValue.value) * 0.6,
  }));

  const $dynamicStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (reduceMotion) {
    return null;
  }

  return <Animated.View style={[$staticPulseRing, $dynamicStyle, rStyle]} />;
}

const $staticPulseRing: ViewStyle = {
  position: "absolute",
  backgroundColor: color.accentMuted,
  borderWidth: 1,
  borderColor: color.accent,
};
