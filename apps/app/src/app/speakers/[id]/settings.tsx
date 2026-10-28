import { Host, Slider } from "@expo/ui";
import {
  BottomSheetModal,
  BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import type { AudioMode } from "bose-api-speaker-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useMargeAPIStatusQuery } from "@/features/speakers/hooks/useSpeakerManager";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { SegmentedControl } from "@/ui/ds/SegmentedControl";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { color, radius, space, type ColorName } from "@/ui/tokens";

interface AudioModeDisplay {
  value: AudioMode;
  label: string;
  description: string;
}

const AUDIO_MODES: AudioModeDisplay[] = [
  {
    value: "AUDIO_MODE_NORMAL",
    label: "Normal",
    description: "Standard audio processing",
  },
  {
    value: "AUDIO_MODE_DIRECT",
    label: "Direct",
    description: "Bypasses DSP processing",
  },
  {
    value: "AUDIO_MODE_DIALOG",
    label: "Dialog",
    description: "Enhances speech clarity",
  },
  {
    value: "AUDIO_MODE_NIGHT",
    label: "Night",
    description: "Reduces dynamic range",
  },
];

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

  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [bassSliderValue, setBassSliderValue] = useState<number | null>(null);

  useEffect(() => {
    if (speaker?.deviceID) {
      void loadPresets(speaker.deviceID);
    }
  }, [speaker?.deviceID, loadPresets]);

  const margeAPIStatus = useMargeAPIStatusQuery(speaker?.host ?? "");

  const goBack = () => {
    router.back();
  };

  const handleSaveName = () => {
    if (!speaker) {
      return;
    }
    const trimmed = nameValue.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    if (trimmed.length > 50) {
      setNameError("Name must be at most 50 characters");
      return;
    }
    if (trimmed === speaker.name) {
      setNameValue("");
      Keyboard.dismiss();
      return;
    }
    setNameMutation.mutate(
      { deviceID: speaker.deviceID, name: trimmed },
      {
        onSuccess: () => {
          setNameValue("");
          setNameError(null);
          Keyboard.dismiss();
        },
        onError: () => {
          setNameValue(speaker.name);
        },
      },
    );
  };

  if (!speaker) {
    return (
      <Screen title="Settings" onBack={goBack}>
        <EmptyState
          icon={icons.speaker}
          title="Speaker not found"
          actions={
            <Button label="Go back" variant="secondary" onPress={goBack} />
          }
        />
      </Screen>
    );
  }

  const bassCaps = speaker.bassCapabilities;
  const dspControls = speaker.audioDspControls;
  const toneControls = speaker.audioProductToneControls;
  const levelControls = speaker.audioProductLevelControls;

  const showBass = bassCaps?.bassAvailable;
  const showDsp = dspControls !== null && dspControls !== undefined;
  const showTone = toneControls !== null && toneControls !== undefined;
  const showLevels = levelControls !== null && levelControls !== undefined;

  const bassValue =
    bassSliderValue ?? bassCaps?.bassDefault ?? bassCaps?.bassMin ?? -9;

  const margeStatus = (() => {
    if (margeAPIStatus.isLoading) {
      return <ActivityIndicator size="small" color={color.textSecondary} />;
    }
    if (margeAPIStatus.isError) {
      return <StatusText color="danger">Connection failed</StatusText>;
    }
    if (margeAPIStatus.data) {
      return <StatusText color="textPrimary">Configured</StatusText>;
    }
    return <StatusText color="textSecondary">Not configured</StatusText>;
  })();

  return (
    <Screen title={speaker.name} onBack={goBack}>
      <ScrollView
        contentContainerStyle={$content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="subhead" color="textSecondary" style={$subtitle}>
          {speaker.type} · {speaker.host}
        </Text>

        <SectionHeader title="Name" />
        {nameValue !== "" ? (
          <View style={$block}>
            <TextField
              value={nameValue}
              onChangeText={(text) => {
                setNameValue(text);
                setNameError(null);
              }}
              placeholder={speaker.name}
              maxLength={50}
              editable={!setNameMutation.isPending}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              onBlur={() => {
                if (!setNameMutation.isPending) {
                  setNameValue("");
                  setNameError(null);
                }
              }}
              trailing={
                setNameMutation.isPending ? (
                  <View style={$fieldAction}>
                    <ActivityIndicator
                      size="small"
                      color={color.textSecondary}
                    />
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSaveName}
                    hitSlop={8}
                    style={({ pressed }) => [$fieldAction, pressed && $pressed]}
                  >
                    <Text variant="headline" color="accent">
                      Save
                    </Text>
                  </Pressable>
                )
              }
            />
            {nameError ? (
              <Text variant="caption" color="danger">
                {nameError}
              </Text>
            ) : null}
          </View>
        ) : (
          <ListRow
            title="Rename speaker"
            leading={
              <View style={$iconWell}>
                <Icon name={{ ios: "pencil", android: "edit", web: "edit" }} />
              </View>
            }
            trailing={
              setNameMutation.isPending ? (
                <ActivityIndicator size="small" color={color.textSecondary} />
              ) : (
                <Chevron />
              )
            }
            onPress={() => {
              setNameValue(speaker.name);
            }}
          />
        )}

        <SectionHeader title="Audio" />
        {showBass && bassCaps ? (
          <NativeSliderSetting
            label="Bass"
            value={bassValue}
            min={bassCaps.bassMin}
            max={bassCaps.bassMax}
            step={1}
            isSaving={setBassMutation.isPending}
            onValueChange={(value) => {
              const rounded = Math.round(value);
              setBassSliderValue(rounded);
              setBassMutation.mutate({
                deviceID: speaker.deviceID,
                value: rounded,
              });
            }}
          />
        ) : null}

        {showDsp && dspControls ? (
          <View style={$block}>
            <Text variant="body">Audio mode</Text>
            <SegmentedControl
              options={AUDIO_MODES}
              value={dspControls.audiomode}
              onChange={(mode) => {
                setAudioDspControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  audiomode: mode,
                });
              }}
            />
            <Text variant="subhead" color="textSecondary">
              {
                AUDIO_MODES.find(
                  (option) => option.value === dspControls.audiomode,
                )?.description
              }
            </Text>
          </View>
        ) : null}

        {showTone && toneControls ? (
          <>
            <NativeSliderSetting
              label="Bass EQ"
              value={toneControls.bass.value}
              min={toneControls.bass.minValue}
              max={toneControls.bass.maxValue}
              step={toneControls.bass.step}
              isSaving={setAudioProductToneControlsMutation.isPending}
              onValueChange={(newValue) => {
                setAudioProductToneControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  bass: { value: newValue },
                });
              }}
            />
            <NativeSliderSetting
              label="Treble EQ"
              value={toneControls.treble.value}
              min={toneControls.treble.minValue}
              max={toneControls.treble.maxValue}
              step={toneControls.treble.step}
              isSaving={setAudioProductToneControlsMutation.isPending}
              onValueChange={(newValue) => {
                setAudioProductToneControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  treble: { value: newValue },
                });
              }}
            />
          </>
        ) : null}

        {showLevels && levelControls ? (
          <>
            <NativeSliderSetting
              label="Front center"
              value={levelControls.frontCenterSpeakerLevel.value}
              min={levelControls.frontCenterSpeakerLevel.minValue}
              max={levelControls.frontCenterSpeakerLevel.maxValue}
              step={levelControls.frontCenterSpeakerLevel.step}
              isSaving={setAudioProductLevelControlsMutation.isPending}
              onValueChange={(newValue) => {
                setAudioProductLevelControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  frontCenterSpeakerLevel: { value: newValue },
                });
              }}
            />
            <NativeSliderSetting
              label="Rear surround"
              value={levelControls.rearSurroundSpeakersLevel.value}
              min={levelControls.rearSurroundSpeakersLevel.minValue}
              max={levelControls.rearSurroundSpeakersLevel.maxValue}
              step={levelControls.rearSurroundSpeakersLevel.step}
              isSaving={setAudioProductLevelControlsMutation.isPending}
              onValueChange={(newValue) => {
                setAudioProductLevelControlsMutation.mutate({
                  deviceID: speaker.deviceID,
                  rearSurroundSpeakersLevel: { value: newValue },
                });
              }}
            />
          </>
        ) : null}

        <SectionHeader title="Internet radio" />
        <ValueRow label="Marge API radio" value={margeStatus} />
        {margeAPIStatus.isError && (
          <View style={$block}>
            <Text variant="subhead" color="textSecondary">
              Failed to connect to the speaker via Telnet. Ensure your device is
              on the same network.
            </Text>
            <Button
              label="Retry connection"
              variant="secondary"
              icon={icons.refresh}
              onPress={() => {
                void margeAPIStatus.refetch();
              }}
            />
          </View>
        )}
        {!margeAPIStatus.isLoading && !margeAPIStatus.isError && (
          <View style={$block}>
            <Text variant="subhead" color="textSecondary">
              Enable custom internet radio streams on this speaker. This will
              reboot the device.
            </Text>
            <Button
              label={
                margeAPIStatus.data
                  ? "Re-configure for Marge API"
                  : "Configure for Marge API"
              }
              variant={margeAPIStatus.data ? "secondary" : "primary"}
              onPress={() => {
                router.push("./configure");
              }}
            />
          </View>
        )}

        <SectionHeader title="Presets" />
        <Text variant="subhead" color="textSecondary" style={$paragraph}>
          Press and hold the desired preset button on your device or remote
          until you hear a beep. From now on you can start the stream by
          pressing the preset button.
        </Text>
        {speaker.presets && speaker.presets.length > 0 ? (
          speaker.presets.map((preset) => (
            <ListRow
              key={preset.id}
              title={preset.contentItem.source}
              subtitle={preset.contentItem.location || undefined}
              leading={
                <View style={[$iconWell, $presetBadge]}>
                  <Text variant="headline">{preset.id}</Text>
                </View>
              }
            />
          ))
        ) : (
          <Text variant="body" color="textTertiary" style={$paragraph}>
            No presets configured.
          </Text>
        )}

        <SectionHeader title="Device info" />
        <ValueRow label="Device ID" value={speaker.deviceID} />
        <ValueRow label="IP address" value={speaker.host} />
        <ValueRow label="Port" value={String(speaker.port)} />
        {speaker.macAddress ? (
          <ValueRow label="MAC address" value={speaker.macAddress} />
        ) : null}
        <ValueRow label="Type" value={speaker.type} />

        {speaker.components && speaker.components.length > 0 ? (
          <>
            <SectionHeader title="Software" />
            {speaker.components.map((comp, index) => (
              <View key={comp.serialNumber || index} style={$stackedRow}>
                <Text variant="subhead" color="textSecondary">
                  {comp.componentCategory || "Component"}
                </Text>
                <Text variant="body" selectable>
                  {comp.softwareVersion}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Chevron() {
  return <Icon name={icons.chevronRight} size={16} color="textTertiary" />;
}

function StatusText({
  color: colorName,
  children,
}: {
  color: ColorName;
  children: string;
}) {
  return (
    <Text variant="body" color={colorName}>
      {children}
    </Text>
  );
}

/** Label on the left, value (text or node) on the right; tappable when `onPress` is set. */
function ValueRow({
  label,
  value,
  trailing,
  onPress,
}: {
  label: string;
  value: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [$valueRow, pressed && $rowPressed]}
    >
      <Text variant="body">{label}</Text>
      <View style={$valueSide}>
        {typeof value === "string" ? (
          <Text
            variant="body"
            color="textSecondary"
            numberOfLines={1}
            style={$valueText}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {trailing}
      </View>
    </Pressable>
  );
}

function NativeSliderSetting({
  label,
  value,
  min,
  max,
  step,
  isSaving,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isSaving?: boolean;
  onValueChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { width } = useWindowDimensions();

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [isOpen]);

  // Local state to keep slider movement fluid
  const [localValue, setLocalValue] = useState(value);

  // Sync with value prop when value updates
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setLocalValue(value);
  }

  // Sync with value prop when sheet opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
    }
  }, [isOpen, value]);

  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  });

  // Last value fired, keyed by the prop value it was fired against
  const lastFiredRef = useRef<{ localValue: number; value: number } | null>(
    null,
  );

  // Debounced callback with immediate flush on close
  useEffect(() => {
    if (
      localValue === value ||
      (lastFiredRef.current?.localValue === localValue &&
        lastFiredRef.current.value === value)
    ) {
      return;
    }
    if (!isOpen) {
      onValueChangeRef.current(localValue);
      lastFiredRef.current = { localValue, value };
      return;
    }
    const timer = setTimeout(() => {
      onValueChangeRef.current(localValue);
      lastFiredRef.current = { localValue, value };
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [localValue, value, isOpen]);

  return (
    <>
      <ValueRow
        label={label}
        value={String(value)}
        onPress={() => {
          setIsOpen(true);
        }}
        trailing={
          <>
            {isSaving && (
              <ActivityIndicator size="small" color={color.textSecondary} />
            )}
            <Chevron />
          </>
        }
      />
      <BottomSheetModal
        ref={bottomSheetRef}
        onDismiss={() => {
          setIsOpen(false);
        }}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: color.surface1 }}
        handleIndicatorStyle={{ backgroundColor: color.textTertiary }}
      >
        <BottomSheetView style={[$bottomSheetContent, { width }]}>
          <View style={$sliderHeader}>
            <Text variant="headline">{label}</Text>
            <View style={$valueSide}>
              {isSaving && (
                <>
                  <ActivityIndicator size="small" color={color.textSecondary} />
                  <Text variant="caption" color="textSecondary">
                    Saving…
                  </Text>
                </>
              )}
              <Text variant="headline" color="textSecondary">
                {localValue}
              </Text>
            </View>
          </View>
          {/* @expo/ui 58 top-aligns Host content on iOS; size Host to the
              slider and center it in the 40pt track to keep the old layout */}
          <View style={$sliderTrack}>
            <Host matchContents={{ vertical: true }}>
              <Slider
                value={localValue}
                onValueChange={setLocalValue}
                min={min}
                max={max}
                step={step}
                disabled={isSaving}
              />
            </Host>
          </View>
          <View style={$sliderLabels}>
            <Text variant="caption" color="textTertiary">
              {min}
            </Text>
            <Text variant="caption" color="textTertiary">
              {max}
            </Text>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const $content: ViewStyle = {
  paddingBottom: space.xxxl,
};

const $subtitle: TextStyle = {
  paddingHorizontal: space.screen,
};

const $paragraph: TextStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.xs,
};

const $block: ViewStyle = {
  gap: space.sm,
  paddingHorizontal: space.screen,
  paddingVertical: space.sm,
};

const $iconWell: ViewStyle = {
  width: 40,
  height: 40,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  backgroundColor: color.surface1,
};

const $presetBadge: ViewStyle = {
  borderRadius: radius.pill,
};

const $fieldAction: ViewStyle = {
  minWidth: 40,
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: space.sm,
};

const $pressed: ViewStyle = {
  opacity: 0.6,
};

const $valueRow: ViewStyle = {
  minHeight: 52,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space.md,
  paddingHorizontal: space.screen,
  paddingVertical: space.xs,
};

const $rowPressed: ViewStyle = {
  backgroundColor: color.surface2,
};

const $valueSide: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  flexShrink: 1,
};

const $valueText: TextStyle = {
  flexShrink: 1,
  textAlign: "right",
};

const $stackedRow: ViewStyle = {
  gap: 2,
  paddingHorizontal: space.screen,
  paddingVertical: space.xs,
};

const $sliderHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: space.xs,
};

const $sliderTrack: ViewStyle = {
  height: 40,
  justifyContent: "center",
};

const $sliderLabels: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: space.xxs,
};

const $bottomSheetContent: ViewStyle = {
  flex: 1,
  width: "100%",
  padding: space.xl,
  paddingBottom: 48,
};
