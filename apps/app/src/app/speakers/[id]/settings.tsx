import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";

type AudioModeDisplay = {
  value: string;
  label: string;
  description: string;
};

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
  } = useBose();

  const speaker = speakers.find((s) => s.deviceID === id);

  const [nameValue, setNameValue] = useState("");
  const [bassSliderValue, setBassSliderValue] = useState<number | null>(null);

  if (!speaker) {
    return (
      <View style={$container}>
        <Stack.Screen
          options={{
            title: "Settings",
            headerShown: true,
            headerStyle: { backgroundColor: "#09090b" },
            headerTintColor: "#fafafa",
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
        <View style={$centerState}>
          <ActivityIndicator size="small" color="#71717a" />
          <Text style={$notFoundText}>Speaker not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={$backButton}>
            <Text style={$backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const bassCaps = speaker.bassCapabilities;
  const dspControls = speaker.audioDspControls;
  const toneControls = speaker.audioProductToneControls;
  const levelControls = speaker.audioProductLevelControls;

  const hasBassCaps = bassCaps !== undefined;
  const bassFetchFailed = hasBassCaps && bassCaps === null;
  const hasBassCapability = bassCaps !== null && bassCaps?.bassAvailable;

  const hasDspCaps = dspControls !== undefined;
  const dspFetchFailed = hasDspCaps && dspControls === null;
  const hasDspCapability = dspControls !== null;

  const hasToneCaps = toneControls !== undefined;
  const toneFetchFailed = hasToneCaps && toneControls === null;
  const hasToneCapability = toneControls !== null;

  const hasLevelCaps = levelControls !== undefined;
  const levelFetchFailed = hasLevelCaps && levelControls === null;
  const hasLevelCapability = levelControls !== null;

  const bassValue =
    bassSliderValue ?? bassCaps?.bassDefault ?? bassCaps?.bassMin ?? -9;

  const isSaving = setBassMutation.isPending;

  return (
    <ScrollView
      style={$container}
      contentContainerStyle={$content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: "Settings",
          headerShown: true,
          headerStyle: { backgroundColor: "#09090b" },
          headerTintColor: "#fafafa",
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "600" },
        }}
      />

      {/* Speaker Identity */}
      <View style={$card}>
        <View style={$cardHeader}>
          <View style={$speakerIcon}>
            <SymbolView
              name={{
                ios: "speaker.wave.2.fill",
                android: "speaker",
                web: "speaker",
              }}
              tintColor="#a1a1aa"
              size={24}
            />
          </View>
          <View style={$cardMeta}>
            <Text style={$speakerName}>{speaker.name}</Text>
            <Text style={$speakerType}>{speaker.type}</Text>
          </View>
        </View>
      </View>

      {/* Name */}
      <Text style={$sectionLabel}>Name</Text>
      {nameValue !== "" ? (
        <View style={$card}>
          <View style={$renameRow}>
            <TextInput
              style={$textInput}
              value={nameValue}
              onChangeText={setNameValue}
              placeholder={speaker.name}
              placeholderTextColor="#52525b"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const trimmed = nameValue.trim();
                if (trimmed && trimmed !== speaker.name) {
                  setNameMutation.mutate(
                    { host: speaker.host, name: trimmed },
                    { onError: () => setNameValue(speaker.name) },
                  );
                }
                setNameValue("");
                Keyboard.dismiss();
              }}
              onBlur={() => {
                const trimmed = nameValue.trim();
                if (trimmed && trimmed !== speaker.name) {
                  setNameMutation.mutate(
                    { host: speaker.host, name: trimmed },
                    { onError: () => setNameValue(speaker.name) },
                  );
                }
                setNameValue("");
              }}
            />
            <TouchableOpacity
              style={$saveButton}
              onPress={() => {
                const trimmed = nameValue.trim();
                if (trimmed) {
                  setNameMutation.mutate(
                    { host: speaker.host, name: trimmed },
                    { onError: () => setNameValue(speaker.name) },
                  );
                }
                setNameValue("");
                Keyboard.dismiss();
              }}
              activeOpacity={0.8}
            >
              <Text style={$saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={$card}
          activeOpacity={0.7}
          onPress={() => setNameValue(speaker.name)}
        >
          <View style={$infoRow}>
            <Text style={$infoLabel}>Name</Text>
            <View style={$infoRowRight}>
              <Text style={$infoValue} numberOfLines={1}>
                {speaker.name}
              </Text>
              <SymbolView
                name={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                tintColor="#52525b"
                size={14}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Audio */}
      <Text style={$sectionLabel}>Audio</Text>
      <View style={$card}>
        {/* Bass */}
        {bassFetchFailed ? (
          <CapabilityErrorRow label="Bass" />
        ) : hasBassCapability && bassCaps ? (
          <SliderSetting
            label="Bass"
            value={bassValue}
            min={bassCaps.bassMin}
            max={bassCaps.bassMax}
            step={1}
            disabled={isSaving}
            onValueChange={(v) => {
              setBassSliderValue(v);
              setBassMutation.mutate({ host: speaker.host, value: v });
            }}
          />
        ) : null}

        {/* Audio DSP Mode */}
        {dspFetchFailed ? (
          <CapabilityErrorRow label="Audio Mode" withDivider />
        ) : hasDspCapability && dspControls ? (
          <PickerSetting
            label="Audio Mode"
            withDivider
            value={dspControls.audiomode}
            options={AUDIO_MODES}
            onChange={(mode) => {
              setAudioDspControlsMutation.mutate({
                host: speaker.host,
                audiomode: mode,
              });
            }}
          />
        ) : null}

        {/* Tone Controls */}
        {toneFetchFailed ? (
          <CapabilityErrorRow label="Tone EQ" withDivider />
        ) : hasToneCapability && toneControls ? (
          <>
            <View style={$infoDivider} />
            <SliderSetting
              label="Bass EQ"
              value={toneControls.bass.value}
              min={toneControls.bass.minValue}
              max={toneControls.bass.maxValue}
              step={toneControls.bass.step}
              disabled={isSaving}
              onValueChange={(v) => {
                setAudioProductToneControlsMutation.mutate({
                  host: speaker.host,
                  bass: { value: v },
                });
              }}
            />
            <View style={$infoDivider} />
            <SliderSetting
              label="Treble EQ"
              value={toneControls.treble.value}
              min={toneControls.treble.minValue}
              max={toneControls.treble.maxValue}
              step={toneControls.treble.step}
              disabled={isSaving}
              onValueChange={(v) => {
                setAudioProductToneControlsMutation.mutate({
                  host: speaker.host,
                  treble: { value: v },
                });
              }}
            />
          </>
        ) : null}

        {/* Speaker Levels */}
        {levelFetchFailed ? (
          <CapabilityErrorRow label="Speaker Levels" withDivider />
        ) : hasLevelCapability && levelControls ? (
          <>
            <View style={$infoDivider} />
            <SliderSetting
              label="Front Center"
              value={levelControls.frontCenterSpeakerLevel.value}
              min={levelControls.frontCenterSpeakerLevel.minValue}
              max={levelControls.frontCenterSpeakerLevel.maxValue}
              step={levelControls.frontCenterSpeakerLevel.step}
              disabled={isSaving}
              onValueChange={(v) => {
                setAudioProductLevelControlsMutation.mutate({
                  host: speaker.host,
                  frontCenterSpeakerLevel: { value: v },
                });
              }}
            />
            <View style={$infoDivider} />
            <SliderSetting
              label="Rear Surround"
              value={levelControls.rearSurroundSpeakersLevel.value}
              min={levelControls.rearSurroundSpeakersLevel.minValue}
              max={levelControls.rearSurroundSpeakersLevel.maxValue}
              step={levelControls.rearSurroundSpeakersLevel.step}
              disabled={isSaving}
              onValueChange={(v) => {
                setAudioProductLevelControlsMutation.mutate({
                  host: speaker.host,
                  rearSurroundSpeakersLevel: { value: v },
                });
              }}
            />
          </>
        ) : null}
      </View>

      {/* Device Info */}
      <Text style={$sectionLabel}>Device Info</Text>
      <View style={$card}>
        <View style={$infoRow}>
          <Text style={$infoLabel}>Device ID</Text>
          <Text style={$infoValue} numberOfLines={1}>
            {speaker.deviceID}
          </Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>IP Address</Text>
          <Text style={$infoValue}>{speaker.host}</Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Port</Text>
          <Text style={$infoValue}>{speaker.port}</Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Type</Text>
          <Text style={$infoValue}>{speaker.type}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function CapabilityErrorRow({
  label,
  withDivider,
}: {
  label: string;
  withDivider?: boolean;
}) {
  return (
    <>
      {withDivider && <View style={$infoDivider} />}
      <View style={$capErrorRow}>
        <View style={{ flex: 1 }}>
          <Text style={$infoLabelDisabled}>{label}</Text>
          <Text style={$infoCapErrorText}>Could not load — tap to retry</Text>
        </View>
        <SymbolView
          name={{
            ios: "arrow.clockwise",
            android: "refresh",
            web: "refresh",
          }}
          tintColor="#52525b"
          size={14}
        />
      </View>
    </>
  );
}

function SliderSetting({
  label,
  value,
  min,
  max,
  step: _step,
  disabled,
  onValueChange,
  withDivider,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  withDivider?: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const pct = max !== min ? ((value - min) / (max - min)) * 100 : 0;

  const handleTap = (event: GestureResponderEvent) => {
    if (disabled || !trackWidth) return;
    const x = event.nativeEvent.locationX;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    const stepped = min + Math.round((ratio * (max - min)) / _step) * _step;
    onValueChange(stepped);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <>
      {withDivider && <View style={$infoDivider} />}
      <View>
        <View style={$sliderHeader}>
          <Text style={$infoLabel}>{label}</Text>
          <Text style={$infoValue}>{value}</Text>
        </View>
        <TouchableOpacity
          style={$nativeSliderTrack}
          activeOpacity={1}
          onPress={handleTap}
          onLayout={handleLayout}
          disabled={disabled}
        >
          <View style={[$nativeSliderFill, { width: `${pct}%` }]} />
          <View style={[$nativeSliderThumb, { left: `${pct}%` }]} />
        </TouchableOpacity>
        <View style={$sliderLabels}>
          <Text style={$sliderLabelText}>{min}</Text>
          <Text style={$sliderLabelText}>{max}</Text>
        </View>
      </View>
    </>
  );
}

function PickerSetting({
  label,
  value,
  options,
  onChange,
  withDivider,
}: {
  label: string;
  value: string;
  options: AudioModeDisplay[];
  onChange: (value: string) => void;
  withDivider?: boolean;
}) {
  return (
    <>
      {withDivider && <View style={$infoDivider} />}
      <View>
        <Text style={$infoLabel}>{label}</Text>
        <View style={$pickerOptions}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[$pickerChip, isActive ? $pickerChipActive : undefined]}
                onPress={() => onChange(opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    $pickerChipText,
                    isActive ? $pickerChipTextActive : undefined,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={$pickerDescription}>
          {options.find((o) => o.value === value)?.description}
        </Text>
      </View>
    </>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 40,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 80,
};

const $notFoundText: TextStyle = {
  fontSize: 16,
  color: "#71717a",
  marginTop: 16,
};

const $backButton: ViewStyle = {
  marginTop: 20,
  paddingHorizontal: 24,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: "#27272a",
};

const $backButtonText: TextStyle = {
  fontSize: 14,
  color: "#a1a1aa",
  fontWeight: "600",
};

const $card: ViewStyle = {
  backgroundColor: "#18181b",
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: "#27272a",
};

const $cardHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
};

const $speakerIcon: ViewStyle = {
  width: 48,
  height: 48,
  borderRadius: 14,
  backgroundColor: "#27272a",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 14,
};

const $cardMeta: ViewStyle = {
  flex: 1,
};

const $speakerName: TextStyle = {
  fontSize: 17,
  fontWeight: "700",
  color: "#fafafa",
};

const $speakerType: TextStyle = {
  fontSize: 13,
  color: "#52525b",
  marginTop: 2,
};

const $sectionLabel: TextStyle = {
  fontSize: 12,
  fontWeight: "700",
  color: "#52525b",
  letterSpacing: 1,
  textTransform: "uppercase",
  marginTop: 24,
  marginBottom: 8,
  marginLeft: 4,
};

const $renameRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
};

const $textInput: TextStyle = {
  flex: 1,
  backgroundColor: "#27272a",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: "#fafafa",
};

const $saveButton: ViewStyle = {
  backgroundColor: "#fafafa",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10,
};

const $saveButtonText: TextStyle = {
  fontSize: 14,
  color: "#09090b",
  fontWeight: "700",
};

const $infoDivider: ViewStyle = {
  height: 1,
  backgroundColor: "#27272a",
  marginVertical: 10,
};

const $infoRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: 4,
};

const $infoLabel: TextStyle = {
  fontSize: 14,
  color: "#71717a",
};

const $infoLabelDisabled: TextStyle = {
  fontSize: 14,
  color: "#3f3f46",
};

const $infoValue: TextStyle = {
  fontSize: 14,
  color: "#a1a1aa",
  fontWeight: "500",
  textAlign: "right",
  flexShrink: 1,
};

const $infoRowRight: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  flexShrink: 1,
  justifyContent: "flex-end",
};

const $capErrorRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
};

const $infoCapErrorText: TextStyle = {
  fontSize: 11,
  color: "#52525b",
  marginTop: 2,
};

const $sliderHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const $nativeSliderTrack: ViewStyle = {
  height: 6,
  backgroundColor: "#27272a",
  borderRadius: 3,
  position: "relative",
  overflow: "visible",
};

const $nativeSliderFill: ViewStyle = {
  height: "100%",
  backgroundColor: "#fafafa",
  borderRadius: 3,
};

const $nativeSliderThumb: ViewStyle = {
  position: "absolute",
  top: -7,
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: "#fafafa",
  marginLeft: -10,
};

const $sliderLabels: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 4,
};

const $sliderLabelText: TextStyle = {
  fontSize: 11,
  color: "#52525b",
};

const $pickerOptions: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 10,
};

const $pickerChip: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  backgroundColor: "#27272a",
  borderWidth: 1,
  borderColor: "transparent",
};

const $pickerChipActive: ViewStyle = {
  backgroundColor: "#fafafa",
};

const $pickerChipText: TextStyle = {
  fontSize: 13,
  color: "#a1a1aa",
  fontWeight: "600",
};

const $pickerChipTextActive: TextStyle = {
  color: "#09090b",
};

const $pickerDescription: TextStyle = {
  fontSize: 12,
  color: "#52525b",
  marginTop: 8,
};
