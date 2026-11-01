import { useMutation } from "@tanstack/react-query";
import type { Result } from "better-result";
import {
  type AudioMode,
  type BoseApiError,
  BoseHttpAdapter,
  type ContentItem,
  contentItemXml,
  type KeyValue,
  type Speaker,
} from "bose-api-speaker-client";

import { confirmStationPlaying } from "../lib/radio";
import { speakerRegistry } from "../registry/store";

/**
 * How long a rename may take. The speaker normally answers within a second;
 * it only takes longer while its Marge server fails.
 */
const RENAME_TIMEOUT_MS = 15_000;

/** How long one readback of what a speaker plays may take while starting a station. */
const READBACK_TIMEOUT_MS = 2000;

/** How long `/select` may take to accept a station. */
const SELECT_TIMEOUT_MS = 5000;

type PresetSlot = 1 | 2 | 3 | 4 | 5 | 6;

/** What a command re-reads from the speaker afterwards. */
interface AfterCommand {
  /** Re-read once the speaker has had `ms` to act on it. */
  refreshAfterMs?: number;
  /** Re-read when it fails, to undo what the screen assumed. */
  refreshOnError?: boolean;
}

function client(deviceID: string): Speaker {
  const speaker = speakerRegistry.client(deviceID);
  if (!speaker) {
    throw new Error("Speaker not connected");
  }
  return speaker;
}

/** Runs a command on a reached speaker; throws its error. */
async function run(
  deviceID: string,
  command: (speaker: Speaker) => Promise<Result<void, BoseApiError>>,
  { refreshAfterMs, refreshOnError = false }: AfterCommand = {},
): Promise<void> {
  const result = await command(client(deviceID));
  if (result.isErr()) {
    if (refreshOnError) {
      void speakerRegistry.refresh(deviceID);
    }
    throw result.error;
  }
  if (refreshAfterMs !== undefined) {
    setTimeout(() => {
      void speakerRegistry.refresh(deviceID);
    }, refreshAfterMs);
  }
}

/** Starts a station and resolves once the speaker plays it. */
async function playStation(
  deviceID: string,
  contentItem: ContentItem,
): Promise<void> {
  const speaker = client(deviceID);
  const ip = speaker.options.ip;
  const port = speaker.options.port ?? 8090;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SELECT_TIMEOUT_MS);
    const response = await fetch(`http://${ip}:${port}/select`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: contentItemXml(contentItem),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "No response body");
      if (
        errorText.includes('"1005"') ||
        errorText.includes("UNKNOWN_SOURCE_ERROR")
      ) {
        throw new Error("UNKNOWN_SOURCE_ERROR");
      }
      throw new Error(
        `Failed to play URI: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const http = new BoseHttpAdapter({ ip, port });
    await confirmStationPlaying(async () => {
      // A readback the speaker never answers counts as unanswered, so the
      // confirmation keeps to its schedule.
      const readController = new AbortController();
      const readTimeoutId = setTimeout(() => {
        readController.abort();
      }, READBACK_TIMEOUT_MS);
      try {
        const nowPlaying = await http.getNowPlaying({
          signal: readController.signal,
        });
        return nowPlaying.isOk() ? nowPlaying.value : null;
      } finally {
        clearTimeout(readTimeoutId);
      }
    }, contentItem.location);
  } finally {
    void speakerRegistry.refresh(deviceID);
  }
}

/** The commands screens send to reached speakers, each with its pending state. */
export function useSpeakerCommands() {
  return {
    powerToggleMutation: useMutation({
      mutationFn: async ({ deviceID }: { deviceID: string }) =>
        run(deviceID, async (speaker) => speaker.powerToggle(), {
          refreshAfterMs: 800,
          refreshOnError: true,
        }),
    }),
    volumeMutation: useMutation({
      mutationFn: async ({
        deviceID,
        volume,
      }: {
        deviceID: string;
        volume: number;
      }) => {
        speakerRegistry.showVolume(deviceID, volume);
        await run(deviceID, async (speaker) => speaker.setVolume(volume), {
          refreshOnError: true,
        });
      },
    }),
    playPauseMutation: useMutation({
      mutationFn: async ({ deviceID }: { deviceID: string }) =>
        run(deviceID, async (speaker) => speaker.playPause(), {
          refreshAfterMs: 500,
          refreshOnError: true,
        }),
    }),
    keyMutation: useMutation({
      mutationFn: async ({
        deviceID,
        key,
      }: {
        deviceID: string;
        key: KeyValue;
      }) =>
        run(deviceID, async (speaker) => speaker.triggerKey(key), {
          refreshAfterMs: 500,
          refreshOnError: true,
        }),
    }),
    selectSourceMutation: useMutation({
      mutationFn: async ({
        deviceID,
        source,
        sourceAccount,
      }: {
        deviceID: string;
        source: string;
        sourceAccount?: string;
      }) =>
        run(
          deviceID,
          async (speaker) => speaker.selectSource(source, sourceAccount),
          { refreshAfterMs: 500, refreshOnError: true },
        ),
    }),
    /** Holds a preset key: the speaker keeps what it plays there. */
    savePresetMutation: useMutation({
      mutationFn: async ({
        deviceID,
        presetId,
      }: {
        deviceID: string;
        presetId: PresetSlot;
      }) =>
        run(deviceID, async (speaker) => speaker.savePreset(presetId), {
          refreshAfterMs: 0,
        }),
    }),
    setBassMutation: useMutation({
      mutationFn: async ({
        deviceID,
        value,
      }: {
        deviceID: string;
        value: number;
      }) =>
        run(deviceID, async (speaker) => speaker.setBass(value), {
          refreshAfterMs: 0,
        }),
    }),
    storeStationPresetMutation: useMutation({
      mutationFn: async ({
        deviceID,
        presetId,
        contentItem,
      }: {
        deviceID: string;
        presetId: PresetSlot;
        /** The station, as `stationContentItem` makes it for this speaker. */
        contentItem: ContentItem;
      }) => {
        await run(deviceID, async (speaker) =>
          speaker.storePreset(presetId, contentItem),
        );
        // Reloads the presets, which also stores them on our server.
        await speakerRegistry.refresh(deviceID);
      },
    }),
    playStationMutation: useMutation({
      mutationFn: async ({
        deviceID,
        contentItem,
      }: {
        deviceID: string;
        /** The station, as `stationContentItem` makes it for this speaker. */
        contentItem: ContentItem;
      }) => playStation(deviceID, contentItem),
    }),
    setNameMutation: useMutation({
      mutationFn: async ({
        deviceID,
        name,
      }: {
        deviceID: string;
        name: string;
      }) => {
        // A rename waits on the speaker's Marge server, and the speaker can
        // hold its reply while that server fails; give up instead of
        // leaving "Saving…" up forever.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, RENAME_TIMEOUT_MS);
        try {
          await run(deviceID, async (speaker) =>
            speaker.setName(name, { signal: controller.signal }),
          );
        } finally {
          clearTimeout(timeoutId);
        }
      },
    }),
    setAudioDspControlsMutation: useMutation({
      mutationFn: async ({
        deviceID,
        audiomode,
      }: {
        deviceID: string;
        audiomode: AudioMode;
      }) =>
        run(deviceID, async (speaker) =>
          speaker.setAudioDspControls(audiomode),
        ),
    }),
    setAudioProductToneControlsMutation: useMutation({
      mutationFn: async ({
        deviceID,
        bass,
        treble,
      }: {
        deviceID: string;
        bass?: { value: number };
        treble?: { value: number };
      }) =>
        run(deviceID, async (speaker) =>
          speaker.setAudioProductToneControls({ bass, treble }),
        ),
    }),
    setAudioProductLevelControlsMutation: useMutation({
      mutationFn: async ({
        deviceID,
        frontCenterSpeakerLevel,
        rearSurroundSpeakersLevel,
      }: {
        deviceID: string;
        frontCenterSpeakerLevel?: { value: number };
        rearSurroundSpeakersLevel?: { value: number };
      }) =>
        run(deviceID, async (speaker) =>
          speaker.setAudioProductLevelControls({
            frontCenterSpeakerLevel,
            rearSurroundSpeakersLevel,
          }),
        ),
    }),
  };
}
