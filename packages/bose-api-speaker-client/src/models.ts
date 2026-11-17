/**
 * Whether `/info`'s `type` is a SoundTouch 10, the only model that pairs in
 * stereo and answers `/getGroup` (other models never reply to it). Firmware
 * 27 reports "SoundTouch 10"; "ST10" is the name some tools use.
 */
export const isSoundTouch10 = (type: string): boolean =>
  /\b(?:soundtouch 10|st ?10)\b/i.test(type);
