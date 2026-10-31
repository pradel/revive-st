import soundTouch10 from "@revive-st/design/speakers/soundtouch-10.svg";
import soundTouch20 from "@revive-st/design/speakers/soundtouch-20.svg";
import soundTouch30 from "@revive-st/design/speakers/soundtouch-30.svg";
import soundTouchPortable from "@revive-st/design/speakers/soundtouch-portable.svg";

/**
 * The front drawing of a speaker's model (its `/info` `type`, such as
 * "SoundTouch 20"), from packages/design/speakers; undefined for models
 * without one.
 */
export function speakerDrawing(type: string): number | undefined {
  const model = type.toLowerCase();
  if (model.includes("portable")) {
    return soundTouchPortable;
  }
  if (/\b10\b/.test(model)) {
    return soundTouch10;
  }
  if (/\b20\b/.test(model)) {
    return soundTouch20;
  }
  if (/\b30\b/.test(model)) {
    return soundTouch30;
  }
  return undefined;
}
