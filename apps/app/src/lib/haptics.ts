import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from "expo-haptics";
import { Platform } from "react-native";

const android = Platform.OS === "android";

/** Haptics are a nicety: a device without them must not surface an error. */
function play(feedback: Promise<void>) {
  feedback.catch(() => undefined);
}

/**
 * Semantic haptic feedback. Android uses the system haptic constants (the
 * same feedback native controls give), iOS the UIKit feedback generators.
 */
export const haptics = {
  /** A button that acts immediately: play/pause, skip, preset. */
  tap() {
    play(
      android
        ? performAndroidHapticsAsync(AndroidHaptics.Virtual_Key)
        : impactAsync(ImpactFeedbackStyle.Light),
    );
  },
  /** Picking one option among several: segments, filters. */
  selection() {
    play(
      android
        ? performAndroidHapticsAsync(AndroidHaptics.Clock_Tick)
        : selectionAsync(),
    );
  },
  /** Turning something on or off: favorite, mute. */
  toggle(on: boolean) {
    play(
      android
        ? performAndroidHapticsAsync(
            on ? AndroidHaptics.Toggle_On : AndroidHaptics.Toggle_Off,
          )
        : selectionAsync(),
    );
  },
  /** A long press opened a menu (iOS context menus play their own). */
  longPress() {
    play(
      android
        ? performAndroidHapticsAsync(AndroidHaptics.Long_Press)
        : impactAsync(ImpactFeedbackStyle.Medium),
    );
  },
  /** A longer task finished: casting started, speaker configured. */
  success() {
    play(
      android
        ? performAndroidHapticsAsync(AndroidHaptics.Confirm)
        : notificationAsync(NotificationFeedbackType.Success),
    );
  },
  /** A longer task failed. */
  error() {
    play(
      android
        ? performAndroidHapticsAsync(AndroidHaptics.Reject)
        : notificationAsync(NotificationFeedbackType.Error),
    );
  },
};
