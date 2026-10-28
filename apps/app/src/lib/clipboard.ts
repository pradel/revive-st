import * as Clipboard from "expo-clipboard";
import { Platform, ToastAndroid } from "react-native";

/**
 * Copies `text` and confirms it where the system doesn't: Android 13+ shows
 * its own clipboard confirmation, Android 11–12 get a toast. Returns `true`
 * on iOS, where the caller should show its own confirmation.
 */
export async function copyText(
  text: string,
  confirmation: string,
): Promise<boolean> {
  await Clipboard.setStringAsync(text);
  if (Platform.OS !== "android") {
    return true;
  }
  if (Platform.Version < 33) {
    ToastAndroid.show(confirmation, ToastAndroid.SHORT);
  }
  return false;
}
