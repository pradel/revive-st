import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

interface SliderProps {
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  trackHeight?: number;
  thumbSize?: number;
}

export function Slider({
  value,
  minimumValue = 0,
  maximumValue = 100,
  onValueChange,
  onSlidingComplete,
  trackColor = "#18181b", // match dark mode track
  fillColor = "#fafafa",
  thumbColor = "#fafafa",
  trackHeight = 8,
  thumbSize = 24,
}: SliderProps) {
  const isDragging = useSharedValue(false);
  const trackWidth = useSharedValue(0);

  const initialProgress =
    (value - minimumValue) / (maximumValue - minimumValue);
  const progress = useSharedValue(Math.max(0, Math.min(1, initialProgress)));

  useEffect(() => {
    if (!isDragging.value) {
      const newProgress =
        (value - minimumValue) / (maximumValue - minimumValue);
      progress.value = withTiming(Math.max(0, Math.min(1, newProgress)), {
        duration: 150,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, minimumValue, maximumValue]);

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      if (trackWidth.value > 0) {
        progress.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
      }
    })
    .onChange((e) => {
      if (trackWidth.value > 0) {
        progress.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
        if (onValueChange) {
          const val =
            minimumValue + progress.value * (maximumValue - minimumValue);
          // eslint-disable-next-line
          runOnJS(onValueChange)(val);
        }
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      if (onSlidingComplete) {
        const val =
          minimumValue + progress.value * (maximumValue - minimumValue);
        // The user wanted a fluid slide, but typically the backend API expects integer values
        // for volume (0-100) and bass (-9 to 0).
        // eslint-disable-next-line
        runOnJS(onSlidingComplete)(Math.round(val));
      }
    });

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
    transform: [
      { translateX: -thumbSize / 2 },
      { scale: withSpring(isDragging.value ? 1.2 : 1) },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={styles.container}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width;
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View
          style={[
            styles.track,
            {
              backgroundColor: trackColor,
              height: trackHeight,
              borderRadius: trackHeight / 2,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: fillColor, borderRadius: trackHeight / 2 },
              animatedFillStyle,
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbColor,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
            },
            animatedThumbStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: "center",
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  thumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
