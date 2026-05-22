import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  boseSpeakerClient as createClient,
  escapeXml,
  KeyValue,
} from "bose-api-speaker-client";

async function pressAndRelease(host: string, key: string) {
  const k = key as (typeof KeyValue)[keyof typeof KeyValue];
  const client = createClient({ ip: host });
  let result = await client.pressKey({
    key: k,
    state: "press",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
  result = await client.pressKey({
    key: k,
    state: "release",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
}

export function useVolumeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host, volume }: { host: string; volume: number }) => {
      const result = await createClient({ ip: host }).setVolume({ volume });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function usePowerToggleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ host }: { host: string }) => pressAndRelease(host, "POWER"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function usePlayPauseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ host }: { host: string }) =>
      pressAndRelease(host, "PLAY_PAUSE"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ host, key }: { host: string; key: string }) =>
      pressAndRelease(host, key),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSelectSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      source,
      sourceAccount,
    }: {
      host: string;
      source: string;
      sourceAccount?: string;
    }) => {
      const result = await createClient({ ip: host }).selectSource({
        source,
        sourceAccount,
      });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSetBassMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host, value }: { host: string; value: number }) => {
      const result = await createClient({ ip: host }).setBass(value);
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSavePresetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      presetId,
    }: {
      host: string;
      presetId: number;
    }) => {
      const k =
        `PRESET_${presetId}` as (typeof KeyValue)[keyof typeof KeyValue];
      const client = createClient({ ip: host });
      let result = await client.pressKey({
        key: k,
        state: "press",
        sender: "Gabbo",
      });
      if (!result.isOk()) {
        throw result.error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      result = await client.pressKey({
        key: k,
        state: "release",
        sender: "Gabbo",
      });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function usePlayStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      uri,
      name,
    }: {
      host: string;
      uri: string;
      name: string;
    }) => {
      const payload = `<ContentItem source="INTERNET_RADIO" location="${escapeXml(uri)}" sourceAccount=""><itemName>${escapeXml(name)}</itemName></ContentItem>`;
      const response = await fetch(`http://${host}:8090/select`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: payload,
      });
      if (!response.ok) {
        throw new Error(`Failed to play URI on ${host}`);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSetNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host, name }: { host: string; name: string }) => {
      const result = await createClient({ ip: host }).setName(name);
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSetAudioDspControlsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      audiomode,
    }: {
      host: string;
      audiomode: string;
    }) => {
      const result = await createClient({ ip: host }).setAudioDspControls({
        audiomode: audiomode as
          | "AUDIO_MODE_DIRECT"
          | "AUDIO_MODE_NORMAL"
          | "AUDIO_MODE_DIALOG"
          | "AUDIO_MODE_NIGHT",
      });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSetAudioProductToneControlsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      bass,
      treble,
    }: {
      host: string;
      bass?: { value: number };
      treble?: { value: number };
    }) => {
      const result = await createClient({
        ip: host,
      }).setAudioProductToneControls({ bass, treble });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useSetAudioProductLevelControlsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      host,
      frontCenterSpeakerLevel,
      rearSurroundSpeakersLevel,
    }: {
      host: string;
      frontCenterSpeakerLevel?: { value: number };
      rearSurroundSpeakersLevel?: { value: number };
    }) => {
      const result = await createClient({
        ip: host,
      }).setAudioProductLevelControls({
        frontCenterSpeakerLevel,
        rearSurroundSpeakersLevel,
      });
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}
