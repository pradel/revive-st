import { FieldGroup, TextInput } from "@expo/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  isHttpUrl,
  resolveStreamUrl,
  StreamUrlError,
  type StreamUrlProblem,
} from "@/features/radio/lib/stream-url";
import { haptics } from "@/lib/haptics";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { FormButtonRow, FormFooterText } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

type Mode = "play" | "preset";

const PROBLEMS: Record<StreamUrlProblem | "logo", string> = {
  invalid: "Enter a URL starting with http:// or https://.",
  hls: "This is an HLS stream, which SoundTouch speakers can't play. Look for an MP3 or AAC stream of the station.",
  "empty-playlist": "This playlist doesn't list any stream.",
  unreachable:
    "Couldn't reach this stream from your phone. Check the URL, or use it as it is.",
  logo: "Enter a logo URL starting with http:// or https://, or leave it empty.",
};

/** The station's name: as entered, else the stream's host. */
const stationName = (name: string, streamUrl: string) =>
  name.trim() || new URL(streamUrl).host;

/**
 * Plays a stream added by URL, or saves it on a preset. The URL is checked
 * from the phone first: a playlist is opened to its stream, and HLS, which
 * speakers can't play, is refused.
 */
export default function StreamUrlScreen() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [problem, setProblem] = useState<keyof typeof PROBLEMS | null>(null);

  const openStationSheet = (mode: Mode, streamUrl: string) => {
    router.push({
      pathname: "/cast",
      params: {
        mode,
        streamUrl,
        name: stationName(name, streamUrl),
        favicon: logo.trim(),
      },
    });
  };

  const check = useMutation({
    mutationFn: async (mode: Mode) => ({
      mode,
      streamUrl: await resolveStreamUrl(url.trim()),
    }),
    onSuccess: ({ mode, streamUrl }) => {
      openStationSheet(mode, streamUrl);
    },
    onError: (err) => {
      haptics.error();
      setProblem(err instanceof StreamUrlError ? err.problem : "unreachable");
    },
  });

  const start = (mode: Mode) => {
    if (logo.trim() && !isHttpUrl(logo.trim())) {
      haptics.error();
      setProblem("logo");
      return;
    }
    setProblem(null);
    check.mutate(mode);
  };

  return (
    <Screen>
      <Form>
        <FormSection title="Stream">
          <TextInput
            placeholder="https://stream.example.com/radio.mp3"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!check.isPending}
            onChangeText={(text) => {
              setUrl(text);
              setProblem(null);
            }}
          />
          <FieldGroup.SectionFooter>
            <FormFooterText color={problem === null ? undefined : color.danger}>
              {problem === null
                ? "The address of an MP3, AAC or Ogg stream, or of an M3U or PLS playlist."
                : PROBLEMS[problem]}
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>

        <FormSection title="Station">
          <TextInput
            placeholder="Name"
            editable={!check.isPending}
            onChangeText={setName}
          />
          <TextInput
            placeholder="Logo URL (optional)"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!check.isPending}
            onChangeText={(text) => {
              setLogo(text);
              setProblem(null);
            }}
          />
        </FormSection>

        <FormSection>
          <FormButtonRow
            label={check.isPending ? "Checking the stream…" : "Play on…"}
            disabled={check.isPending}
            onPress={() => {
              start("play");
            }}
          />
          <FormButtonRow
            label="Save to preset…"
            disabled={check.isPending}
            onPress={() => {
              start("preset");
            }}
          />
          {problem === "unreachable" && (
            <FormButtonRow
              label="Use the URL as it is"
              onPress={() => {
                setProblem(null);
                openStationSheet(check.variables ?? "play", url.trim());
              }}
            />
          )}
        </FormSection>
      </Form>
    </Screen>
  );
}
