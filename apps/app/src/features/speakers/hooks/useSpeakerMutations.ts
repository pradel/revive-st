import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Speaker, type SocketModuleLike } from "bose-api-speaker-client";
import TcpSocket from "react-native-tcp-socket";

import { buildMargeRadioPayload } from "@/features/speakers/lib/radio";
import {
  checkMargeAPIStatus,
  configureMargeAPI,
} from "@/features/speakers/lib/telnet";

export function useVolumeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host, volume }: { host: string; volume: number }) => {
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setVolume(volume);
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
    mutationFn: async ({ host }: { host: string }) => {
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.powerToggle();
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function usePlayPauseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host }: { host: string }) => {
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.playPause();
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
  });
}

export function useKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host, key }: { host: string; key: string }) => {
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.triggerKey(key as any);
      if (!result.isOk()) {
        throw result.error;
      }
    },
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.selectSource(source, sourceAccount);
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setBass(value);
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.savePreset(
        presetId as 1 | 2 | 3 | 4 | 5 | 6,
      );
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
      const payload = buildMargeRadioPayload(uri, name);

      const response = await fetch(`http://${host}:8090/select`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: payload,
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
          `Failed to play URI on ${host}: ${response.status} ${response.statusText} - ${errorText}`,
        );
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setName(name);
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setAudioDspControls(audiomode as any);
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setAudioProductToneControls({
        bass,
        treble,
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
      const speaker = new Speaker({ ip: host, deviceID: "temp" });
      const result = await speaker.setAudioProductLevelControls({
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

export function useMargeAPIStatusQuery(host: string) {
  return useQuery({
    queryKey: ["marge-api-status", host],
    queryFn: async () => checkMargeAPIStatus(host),
    enabled: host.length > 0,
    retry: false,
    // 5 minutes
    staleTime: 1000 * 60 * 5,
  });
}

export function useConfigureMargeAPIMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ host }: { host: string }) => {
      const result = await configureMargeAPI(
        host,
        TcpSocket as unknown as SocketModuleLike,
      );
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: (_data, _error, { host }) => {
      void queryClient.invalidateQueries({
        queryKey: ["marge-api-status", host],
      });
    },
  });
}
