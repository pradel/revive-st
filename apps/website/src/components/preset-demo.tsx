"use client";

import {
  Airplay,
  AudioLines,
  Bluetooth,
  Cable,
  Minus,
  Plus,
  Power,
  Volume,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Equalizer } from "@/components/equalizer";

const PRESETS = [
  { station: "Radio Paradise", detail: "Eclectic · California" },
  { station: "FIP", detail: "Eclectic · Paris" },
  { station: "KEXP", detail: "Alternative · Seattle" },
  { station: "Jazz24", detail: "Jazz · Seattle" },
  { station: "SomaFM Groove Salad", detail: "Ambient · San Francisco" },
  { station: "Classic Vinyl HD", detail: "Oldies · Florida" },
];

/** The other sources a speaker plays; the source key steps through them. */
const SOURCES = [
  { name: "AUX", detail: "Turntable, TV or CD player", Icon: Cable },
  { name: "Bluetooth", detail: "Streaming from your phone", Icon: Bluetooth },
  { name: "Spotify", detail: "Playing from the Spotify app", Icon: AudioLines },
  { name: "AirPlay", detail: "From your iPhone or Mac", Icon: Airplay },
];

/** `preset` is null while a source plays; `source` is the source key's label. */
interface Playing {
  preset: number | null;
  source: number;
}

/** The unattended tour: presets, with a press of the source key in between. */
const AUTOPLAY: Playing[] = [
  { preset: 0, source: 0 },
  { preset: 1, source: 0 },
  { preset: null, source: 0 },
  { preset: 2, source: 0 },
  { preset: null, source: 1 },
  { preset: 3, source: 1 },
  { preset: null, source: 2 },
  { preset: 4, source: 2 },
  { preset: null, source: 3 },
  { preset: 5, source: 3 },
];

/*
 * Sizes use container units (cqw) so the keypad scales as one piece; side
 * keys are as tall as a preset row.
 */
const KEY = "flex items-center justify-center rounded-[2.2cqw]";
const SIDE_KEY = `${KEY} aspect-[10/7] bg-surface-2/50 text-fg-tertiary`;
const PRESSABLE =
  "cursor-pointer transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ACTIVE = "bg-accent-muted text-accent";

/**
 * The keypad on top of a SoundTouch 10/20/30, drawn in the site's palette,
 * above what the speaker plays. The presets switch stations; the AUX key
 * switches to a source, then steps through AUX, Bluetooth, Spotify and AirPlay.
 * The demo tours both on its own until the visitor presses a key, and stays
 * put when the visitor prefers reduced motion.
 */
export function PresetDemo() {
  const [playing, setPlaying] = useState<Playing>(AUTOPLAY[0]);
  const [pressedByVisitor, setPressedByVisitor] = useState(false);

  useEffect(() => {
    if (
      pressedByVisitor ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % AUTOPLAY.length;
      setPlaying(AUTOPLAY[step]);
    }, 3200);
    return () => {
      clearInterval(timer);
    };
  }, [pressedByVisitor]);

  const onSource = playing.preset === null;
  const source = SOURCES[playing.source];
  const nowPlaying =
    playing.preset === null
      ? { title: source.name, detail: source.detail }
      : {
          title: PRESETS[playing.preset].station,
          detail: PRESETS[playing.preset].detail,
        };

  return (
    <div className="relative isolate mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-full bg-accent-muted blur-3xl" />

      <div className="@container rounded-3xl bg-surface-1 p-6">
        {/* The keypad on top of the speaker */}
        <div className="flex items-center gap-[3cqw]">
          <div className="flex w-[17%] flex-col gap-[1.5cqw]">
            <span aria-hidden className={SIDE_KEY}>
              <Power className="size-[3.6cqw]" strokeWidth={2.5} />
            </span>
            <button
              type="button"
              aria-pressed={onSource}
              aria-label={`Source: ${source.name}`}
              onClick={() => {
                setPressedByVisitor(true);
                setPlaying((prev) => ({
                  preset: null,
                  // The first press plays the source on the key; later ones step.
                  source:
                    prev.preset === null
                      ? (prev.source + 1) % SOURCES.length
                      : prev.source,
                }));
              }}
              className={`${KEY} ${PRESSABLE} aspect-[10/7] text-[2.6cqw] font-semibold ${
                onSource
                  ? ACTIVE
                  : "bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg"
              }`}
            >
              <span
                key={source.name}
                className="flex motion-safe:animate-fade-up"
              >
                {source.name === "AUX" ? (
                  "AUX"
                ) : (
                  <source.Icon aria-hidden className="size-[4cqw]" />
                )}
              </span>
            </button>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-[1.5cqw]">
            {PRESETS.map((item, index) => (
              <button
                key={item.station}
                type="button"
                aria-pressed={index === playing.preset}
                aria-label={`Preset ${index + 1}: ${item.station}`}
                onClick={() => {
                  setPressedByVisitor(true);
                  setPlaying((prev) => ({
                    preset: index,
                    source: prev.source,
                  }));
                }}
                className={`${KEY} ${PRESSABLE} aspect-[8/5] font-mono text-[4.8cqw] font-bold ${
                  index === playing.preset
                    ? ACTIVE
                    : "bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div aria-hidden className="flex w-[17%] flex-col gap-[1.5cqw]">
            <span className={`${SIDE_KEY} gap-[0.6cqw]`}>
              <Volume className="size-[3cqw] fill-current" />
              <Plus className="size-[2.6cqw]" strokeWidth={3} />
            </span>
            <span className={`${SIDE_KEY} gap-[0.6cqw]`}>
              <Volume className="size-[3cqw] fill-current" />
              <Minus className="size-[2.6cqw]" strokeWidth={3} />
            </span>
          </div>
        </div>

        {/* What the speaker plays */}
        <div
          aria-live="polite"
          className="mt-6 flex items-center gap-4 rounded-2xl bg-bg px-4 py-3.5"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted font-mono font-bold text-accent">
            {playing.preset === null ? (
              <source.Icon aria-hidden className="size-5" />
            ) : (
              playing.preset + 1
            )}
          </div>
          <div
            key={nowPlaying.title}
            className="min-w-0 flex-1 motion-safe:animate-fade-up"
          >
            <p className="truncate font-semibold text-fg">{nowPlaying.title}</p>
            <p className="truncate text-xs text-fg-tertiary">
              {nowPlaying.detail}
            </p>
          </div>
          <Equalizer bars={5} className="h-6 w-8 shrink-0" />
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-fg-tertiary">
        {!pressedByVisitor
          ? "Try it: press a preset, or the source key."
          : onSource
            ? "Bluetooth, AUX, Spotify, AirPlay: it’s all in the app."
            : "That’s it. One press, music starts."}
      </p>
    </div>
  );
}
