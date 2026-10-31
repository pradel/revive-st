import { FieldGroup, TextInput } from "@expo/ui";
import type { AudioMode } from "bose-api-speaker-client";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { useConfigureRun } from "@/features/configure/store";
import { validateSpeakerName } from "@/features/onboarding/session/naming";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useRadioSetupQuery } from "@/features/speakers/hooks/useSpeakerManager";
import { sourceLabel } from "@/features/speakers/lib/playback";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons, type FormIcon } from "@/ui/form/icons";
import {
  FormButtonRow,
  FormFooterText,
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

/** Row icon for what a preset plays. */
function sourceIcon(source: string): FormIcon {
  switch (sourceLabel(source)) {
    case "Radio":
      return formIcons.radio;
    case "Bluetooth":
      return formIcons.bluetooth;
    case "AUX":
      return formIcons.aux;
    case "AirPlay":
      return formIcons.airplay;
    default:
      return formIcons.music;
  }
}

export default function SpeakerSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    speakers,
    setBassMutation,
    setNameMutation,
    setAudioDspControlsMutation,
    setAudioProductToneControlsMutation,
    setAudioProductLevelControlsMutation,
    loadPresets,
  } = useBose();

  const speaker = speakers.find((item) => item.deviceID === id);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (speaker?.deviceID) {
      void loadPresets(speaker.deviceID);
    }
  }, [speaker?.deviceID, loadPresets]);

  const radioSetup = useRadioSetupQuery(speaker?.host ?? "");
  const configureRun = useConfigureRun(id);

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
      loadPresets(speaker.deviceID),
      radioSetup.refetch(),
    ]);
  };

  const saveName = (draft: string) => {
    const problem = validateSpeakerName(draft);
    if (problem !== undefined) {
      setNameError(problem);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed === speaker.name) {
      setNameDraft(null);
      return;
    }
    setNameMutation.mutate(
      { deviceID: speaker.deviceID, name: trimmed },
      {
        onSuccess: () => {
          setNameDraft(null);
          setNameError(null);
        },
        onError: () => {
          setNameError("Couldn't rename the speaker. Try again.");
        },
      },
    );
  };

  const bassCaps = speaker.bassCapabilities;
  const dspControls = speaker.audioDspControls;
  const toneControls = speaker.audioProductToneControls;
  const levelControls = speaker.audioProductLevelControls;
  const hasAudioSliders =
    Boolean(bassCaps?.bassAvailable) ||
    Boolean(toneControls) ||
    Boolean(levelControls);

  const nameChanged = nameDraft !== null && nameDraft.trim() !== speaker.name;

  const settingUp = configureRun.view?.kind === "working";
  const radioStatus = (() => {
    if (settingUp) {
      return { label: "Setting up…", color: color.textSecondary };
    }
    if (radioSetup.isLoading) {
      return { label: "Checking…", color: color.textSecondary };
    }
    if (radioSetup.isError) {
      return { label: "Can't reach speaker", color: color.danger };
    }
    if (radioSetup.data) {
      return { label: "Ready", color: color.textPrimary };
    }
    return { label: "Needs setup", color: color.textSecondary };
  })();

  return (
    <Screen>
      <Stack.Title>{speaker.name}</Stack.Title>
      <Form onRefresh={refresh}>
        <FormSection title="Name">
          <TextInput
            key={speaker.name}
            defaultValue={speaker.name}
            placeholder="Speaker name"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            editable={!setNameMutation.isPending}
            onChangeText={(text) => {
              setNameDraft(text);
              setNameError(null);
            }}
            onSubmitEditing={saveName}
          />
          {nameChanged ? (
            <FormButtonRow
              label={setNameMutation.isPending ? "Saving…" : "Save name"}
              disabled={setNameMutation.isPending}
              onPress={() => {
                saveName(nameDraft);
              }}
            />
          ) : null}
          {nameError !== null ? (
            <FieldGroup.SectionFooter>
              <FormFooterText color={color.danger}>{nameError}</FormFooterText>
            </FieldGroup.SectionFooter>
          ) : null}
        </FormSection>

        {hasAudioSliders ? (
          <FormSection title="Audio">
            {bassCaps?.bassAvailable ? (
              <FormSliderRow
                label="Bass"
                value={speaker.bass ?? bassCaps.bassDefault}
                min={bassCaps.bassMin}
                max={bassCaps.bassMax}
                step={1}
                saving={setBassMutation.isPending}
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

        <FormSection title="Internet radio">
          <FormValueRow
            label="Status"
            value={radioStatus.label}
            valueColor={radioStatus.color}
          />
          {settingUp ? (
            <FormButtonRow
              label="Show progress"
              onPress={() => {
                router.push("./configure");
              }}
            />
          ) : null}
          {!settingUp && radioSetup.isError ? (
            <FormButtonRow
              label="Check again"
              onPress={() => {
                void radioSetup.refetch();
              }}
            />
          ) : null}
          {!settingUp && !radioSetup.isLoading && !radioSetup.isError ? (
            <FormButtonRow
              label={radioSetup.data ? "Set up again" : "Set up internet radio"}
              onPress={() => {
                router.push("./configure");
              }}
            />
          ) : null}
          <FieldGroup.SectionFooter>
            <FormFooterText>
              {radioSetup.isError && !settingUp
                ? "Couldn't reach the speaker. Make sure your phone is on the same Wi-Fi network."
                : "Connects the speaker to Revive ST for internet radio and presets. Setting it up restarts the speaker."}
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>

        <FormSection title="Presets">
          {speaker.presets && speaker.presets.length > 0 ? (
            speaker.presets.map((preset) => (
              <FormValueRow
                key={preset.id}
                icon={sourceIcon(preset.contentItem.source)}
                label={preset.contentItem.itemName || `Preset ${preset.id}`}
                description={`Preset ${preset.id} · ${sourceLabel(preset.contentItem.source)}`}
              />
            ))
          ) : (
            <FormValueRow label="No presets configured" />
          )}
          <FieldGroup.SectionFooter>
            <FormFooterText>
              To save a preset, play something, then press and hold a preset
              button on the speaker or remote until it beeps.
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>

        <FormSection title="Device info">
          <FormValueRow label="Type" value={speaker.type} copyable />
          <FormValueRow label="Device ID" value={speaker.deviceID} copyable />
          <FormValueRow label="IP address" value={speaker.host} copyable />
          <FormValueRow label="Port" value={String(speaker.port)} copyable />
          {speaker.macAddress ? (
            <FormValueRow
              label="MAC address"
              value={speaker.macAddress}
              copyable
            />
          ) : null}
        </FormSection>

        {speaker.components && speaker.components.length > 0 ? (
          <FormSection title="Software">
            {speaker.components.map((component, index) => (
              <FormValueRow
                key={component.serialNumber || index}
                label={component.componentCategory || "Component"}
                value={component.softwareVersion}
                copyable
                stacked
              />
            ))}
          </FormSection>
        ) : null}
      </Form>
    </Screen>
  );
}
