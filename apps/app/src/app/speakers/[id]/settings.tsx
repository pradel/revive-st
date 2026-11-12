import { FieldGroup, RNHostView } from "@expo/ui";
import {
  type AudioMode,
  isSoundTouch10,
  type KeyValue,
} from "bose-api-speaker-client";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { useConfigureRun } from "@/features/configure/store";
import { serverHost } from "@/features/server/server-url";
import { PresetStrip } from "@/features/speakers/components/PresetStrip";
import {
  SpeakerSettingsHeader,
  type SpeakerStatus,
} from "@/features/speakers/components/SpeakerSettingsHeader";
import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import { speakerDrawing } from "@/features/speakers/lib/drawing";
import {
  pairLedBy,
  roleLabel,
  roleOf,
} from "@/features/speakers/lib/stereo-pair";
import {
  speakerRegistry,
  useSpeaker,
  useSpeakers,
} from "@/features/speakers/registry/store";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons } from "@/ui/form/icons";
import {
  FormButtonRow,
  FormFooterText,
  FormLinkRow,
  FormPickerRow,
  FormSliderRow,
  FormValueRow,
} from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

const AUDIO_MODES: readonly {
  value: AudioMode;
  label: string;
  description: string;
}[] = [
  {
    value: "AUDIO_MODE_NORMAL",
    label: "Normal",
    description: "Standard audio processing.",
  },
  {
    value: "AUDIO_MODE_DIRECT",
    label: "Direct",
    description: "Bypasses DSP processing.",
  },
  {
    value: "AUDIO_MODE_DIALOG",
    label: "Dialog",
    description: "Enhances speech clarity.",
  },
  {
    value: "AUDIO_MODE_NIGHT",
    label: "Night",
    description: "Reduces dynamic range.",
  },
];

/**
 * Words a level at the ends of its range: bass on a SoundTouch 10 runs from
 * −9 to 0, where a bare "0" at the right end reads like a broken slider.
 */
const levelLabel = (min: number, max: number) => (value: number) => {
  if (value === max) {
    return "Max";
  }
  if (value === min) {
    return "Min";
  }
  return String(value);
};

export default function SpeakerSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    keyMutation,
    setBassMutation,
    setAudioDspControlsMutation,
    setAudioProductToneControlsMutation,
    setAudioProductLevelControlsMutation,
    leavePairMutation,
  } = useSpeakerCommands();

  const speaker = useSpeaker(id);
  const { all } = useSpeakers();
  const deviceID = speaker?.deviceID;

  useEffect(() => {
    if (deviceID) {
      void speakerRegistry.refresh(deviceID);
    }
  }, [deviceID]);

  const configureRun = useConfigureRun(id);
  const [presetsWidth, setPresetsWidth] = useState<number>();

  if (!speaker) {
    return (
      <Screen>
        <Stack.Title>Settings</Stack.Title>
        <EmptyState
          icon={icons.speaker}
          title="Speaker not found"
          actions={
            <Button
              label="Go back"
              variant="secondary"
              onPress={() => {
                router.back();
              }}
            />
          }
        />
      </Screen>
    );
  }

  // Re-reads the speaker's state (name, audio, presets, info) and re-checks
  // its internet radio setup.
  const refresh = async () => {
    await Promise.allSettled([
      speakerRegistry.refresh(speaker.deviceID),
      speakerRegistry.refreshRadio(speaker.deviceID),
    ]);
  };

  const playPreset = (slot: number) => {
    haptics.tap();
    keyMutation.mutate({
      deviceID: speaker.deviceID,
      key: `PRESET_${slot}` as KeyValue,
    });
  };

  const bassCaps = speaker.bassCapabilities;
  const dspControls = speaker.audioDspControls;
  const toneControls = speaker.audioProductToneControls;
  const levelControls = speaker.audioProductLevelControls;
  const hasAudioSliders =
    Boolean(bassCaps?.bassAvailable) ||
    Boolean(toneControls) ||
    Boolean(levelControls);

  const { pair } = speaker;
  const pairRole = pair && roleOf(pair, speaker.deviceID);
  // The pair its master no longer leads (or that isn't listed any more):
  // only this speaker still holds it, and only it can leave it.
  const pairMaster =
    pair && all.find((other) => other.deviceID === pair.masterDeviceID);
  const stalePair =
    pair !== undefined &&
    pair.masterDeviceID !== speaker.deviceID &&
    (pairMaster === undefined || pairLedBy(pairMaster)?.id !== pair.id);

  const leavePair = () => {
    Alert.alert(
      `Leave ${pair?.name ?? "the pair"}?`,
      `${speaker.speakerName} then plays on its own again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave pair",
          style: "destructive",
          onPress: () => {
            haptics.tap();
            leavePairMutation.mutate(
              { deviceID: speaker.deviceID },
              {
                onSuccess: () => {
                  haptics.success();
                },
                onError: (error) => {
                  logger.warn("[Pair] Failed to leave the pair:", error);
                  haptics.error();
                  Alert.alert(
                    "Couldn't leave the pair",
                    "Make sure the speaker is on and on the same Wi-Fi network as your phone, then try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  };

  const settingUp = configureRun.view?.kind === "working";
  const radioCheckFailed = speaker.radio.kind === "unreachable";
  const radio = ((): { value: string; status: SpeakerStatus } => {
    if (settingUp) {
      return {
        value: "Setting up…",
        status: { label: "Setting up internet radio…", tone: "neutral" },
      };
    }
    const radioState = speaker.radio;
    if (radioState.kind === "unreachable") {
      return {
        value: "Unavailable",
        status: { label: "Couldn't check internet radio", tone: "danger" },
      };
    }
    if (radioState.kind === "checking") {
      return {
        value: "Checking…",
        status: { label: "Checking…", tone: "neutral" },
      };
    }
    // Its server puts its own settings back at every start: it can't be set up.
    if (
      radioState.kind === "needsSetup" &&
      radioState.setup.kind === "blocked"
    ) {
      return {
        value: "Not ready",
        status: {
          label: `Online · Internet radio not ready on ${radioState.setup.server}`,
          tone: "warning",
        },
      };
    }
    if (radioState.kind === "needsSetup") {
      return {
        value: "Needs setup",
        status: {
          label: "Online · Internet radio needs setup",
          tone: "warning",
        },
      };
    }
    if (radioState.through === null) {
      return {
        value: "Ready",
        status: { label: "Online · Internet radio ready", tone: "ok" },
      };
    }
    return {
      value: radioState.through,
      status: {
        label: `Online · Internet radio through ${radioState.through}`,
        tone: "ok",
      },
    };
  })();

  return (
    <Screen>
      <Stack.Title>{speaker.speakerName}</Stack.Title>
      <Form onRefresh={refresh}>
        <FormSection>
          <RNHostView matchContents={{ vertical: true }}>
            <SpeakerSettingsHeader
              name={speaker.speakerName}
              model={speaker.type}
              host={speaker.host}
              drawing={speakerDrawing(speaker.type)}
              status={radio.status}
            />
          </RNHostView>
        </FormSection>

        <FormSection title="General">
          <FormLinkRow
            label="Name"
            value={speaker.speakerName}
            onPress={() => {
              router.push("./rename");
            }}
          />
        </FormSection>

        {hasAudioSliders ? (
          <FormSection title="Sound">
            {bassCaps?.bassAvailable ? (
              <FormSliderRow
                label="Bass"
                value={speaker.bass ?? bassCaps.bassDefault}
                min={bassCaps.bassMin}
                max={bassCaps.bassMax}
                step={1}
                saving={setBassMutation.isPending}
                formatValue={levelLabel(bassCaps.bassMin, bassCaps.bassMax)}
                showRange
                onCommit={(value) => {
                  setBassMutation.mutate({
                    deviceID: speaker.deviceID,
                    value: Math.round(value),
                  });
                }}
              />
            ) : null}
            {toneControls ? (
              <>
                <FormSliderRow
                  label="Bass EQ"
                  value={toneControls.bass.value}
                  min={toneControls.bass.minValue}
                  max={toneControls.bass.maxValue}
                  step={toneControls.bass.step}
                  saving={setAudioProductToneControlsMutation.isPending}
                  formatValue={levelLabel(
                    toneControls.bass.minValue,
                    toneControls.bass.maxValue,
                  )}
                  showRange
                  onCommit={(value) => {
                    setAudioProductToneControlsMutation.mutate({
                      deviceID: speaker.deviceID,
                      bass: { value },
                    });
                  }}
                />
                <FormSliderRow
                  label="Treble EQ"
                  value={toneControls.treble.value}
                  min={toneControls.treble.minValue}
                  max={toneControls.treble.maxValue}
                  step={toneControls.treble.step}
                  saving={setAudioProductToneControlsMutation.isPending}
                  formatValue={levelLabel(
                    toneControls.treble.minValue,
                    toneControls.treble.maxValue,
                  )}
                  showRange
                  onCommit={(value) => {
                    setAudioProductToneControlsMutation.mutate({
                      deviceID: speaker.deviceID,
                      treble: { value },
                    });
                  }}
                />
              </>
            ) : null}
            {levelControls ? (
              <>
                <FormSliderRow
                  label="Front center"
                  value={levelControls.frontCenterSpeakerLevel.value}
                  min={levelControls.frontCenterSpeakerLevel.minValue}
                  max={levelControls.frontCenterSpeakerLevel.maxValue}
                  step={levelControls.frontCenterSpeakerLevel.step}
                  saving={setAudioProductLevelControlsMutation.isPending}
                  formatValue={levelLabel(
                    levelControls.frontCenterSpeakerLevel.minValue,
                    levelControls.frontCenterSpeakerLevel.maxValue,
                  )}
                  showRange
                  onCommit={(value) => {
                    setAudioProductLevelControlsMutation.mutate({
                      deviceID: speaker.deviceID,
                      frontCenterSpeakerLevel: { value },
                    });
                  }}
                />
                <FormSliderRow
                  label="Rear surround"
                  value={levelControls.rearSurroundSpeakersLevel.value}
                  min={levelControls.rearSurroundSpeakersLevel.minValue}
                  max={levelControls.rearSurroundSpeakersLevel.maxValue}
                  step={levelControls.rearSurroundSpeakersLevel.step}
                  saving={setAudioProductLevelControlsMutation.isPending}
                  formatValue={levelLabel(
                    levelControls.rearSurroundSpeakersLevel.minValue,
                    levelControls.rearSurroundSpeakersLevel.maxValue,
                  )}
                  showRange
                  onCommit={(value) => {
                    setAudioProductLevelControlsMutation.mutate({
                      deviceID: speaker.deviceID,
                      rearSurroundSpeakersLevel: { value },
                    });
                  }}
                />
              </>
            ) : null}
          </FormSection>
        ) : null}

        {dspControls ? (
          <FormSection>
            <FormPickerRow
              label="Audio mode"
              value={dspControls.audiomode}
              options={AUDIO_MODES}
              disabled={setAudioDspControlsMutation.isPending}
              onChange={(mode) => {
                setAudioDspControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  audiomode: mode,
                });
              }}
            />
            <FieldGroup.SectionFooter>
              <FormFooterText>
                {AUDIO_MODES.find(
                  (mode) => mode.value === dspControls.audiomode,
                )?.description ?? ""}
              </FormFooterText>
            </FieldGroup.SectionFooter>
          </FormSection>
        ) : null}

        <FormSection title="Presets">
          {speaker.presets ? (
            <RNHostView
              matchContents={{ vertical: true }}
              onLayout={(event) => {
                setPresetsWidth(event.nativeEvent.layout.width);
              }}
            >
              <PresetStrip
                presets={speaker.presets}
                width={presetsWidth}
                onPlay={playPreset}
              />
            </RNHostView>
          ) : (
            <FormValueRow label="Loading presets…" />
          )}
          <FieldGroup.SectionFooter>
            <FormFooterText>
              To save a preset, play something, then press and hold a preset
              button on the speaker or remote until it beeps.
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>

        {isSoundTouch10(speaker.type) ? (
          <FormSection title="Stereo pair">
            {pair && stalePair ? (
              <FormButtonRow
                label={leavePairMutation.isPending ? "Leaving…" : "Leave pair"}
                disabled={leavePairMutation.isPending}
                onPress={leavePair}
              />
            ) : pair ? (
              <FormLinkRow
                icon={formIcons.speaker}
                label={pair.name}
                description={
                  pairRole ? `${roleLabel(pairRole)} speaker` : undefined
                }
                onPress={() => {
                  router.push(
                    `/speakers/${encodeURIComponent(pair.masterDeviceID)}/pair`,
                  );
                }}
              />
            ) : (
              <FormLinkRow
                icon={formIcons.speaker}
                label="Pair with another SoundTouch 10"
                onPress={() => {
                  router.push("./create-pair");
                }}
              />
            )}
            <FieldGroup.SectionFooter>
              <FormFooterText>
                {pair && stalePair
                  ? `${speaker.speakerName} still holds ${pair.name}, which its other speaker no longer reports. Leave it to play on ${speaker.speakerName} alone.`
                  : pair
                    ? "Volume, power and source set on either speaker of the pair apply to both."
                    : "Two SoundTouch 10s can play as one stereo pair: one plays the left channel, the other the right."}
              </FormFooterText>
            </FieldGroup.SectionFooter>
          </FormSection>
        ) : null}

        <FormSection title="Advanced">
          <FormLinkRow
            icon={formIcons.radio}
            label="Internet radio setup"
            value={radio.value}
            onPress={() => {
              router.push("./configure");
            }}
          />
          {speaker.radio.kind === "ready" ||
          speaker.radio.kind === "needsSetup" ? (
            <FormValueRow
              icon={formIcons.server}
              label="Server"
              description={serverHost(speaker.radio.margeURL)}
              value={speaker.radio.serverName}
            />
          ) : null}
          {!settingUp && radioCheckFailed ? (
            <FormButtonRow
              label="Check again"
              onPress={() => {
                void speakerRegistry.refreshRadio(speaker.deviceID);
              }}
            />
          ) : null}
          <FormLinkRow
            icon={formIcons.info}
            label="About this speaker"
            onPress={() => {
              router.push("./about");
            }}
          />
          {!settingUp && radioCheckFailed ? (
            <FieldGroup.SectionFooter>
              <FormFooterText color={color.danger}>
                Couldn't check internet radio. Make sure your phone is on the
                same Wi-Fi network as the speaker.
              </FormFooterText>
            </FieldGroup.SectionFooter>
          ) : null}
        </FormSection>
      </Form>
    </Screen>
  );
}
