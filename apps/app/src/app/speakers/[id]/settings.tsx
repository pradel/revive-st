import { Host, Slider } from "@expo/ui";
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
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";

interface AudioModeDisplay {
  value: string;
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
  } = useBose();

  const speaker = speakers.find((item) => item.deviceID === id);

  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [bassSliderValue, setBassSliderValue] = useState<number | null>(null);

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
      { host: speaker.host, name: trimmed },
      {
        onError: () => {
          setNameValue(speaker.name);
        },
      },
    );
    setNameValue("");
    setNameError(null);
    Keyboard.dismiss();
  };

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
          <TouchableOpacity
            onPress={() => {
              router.back();
            }}
            style={$backButton}
          >
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

  const showBass = bassCaps?.bassAvailable;
  const showDsp = dspControls !== null && dspControls !== undefined;
  const showTone = toneControls !== null && toneControls !== undefined;
  const showLevels = levelControls !== null && levelControls !== undefined;

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

      {/* Name */}
      <Text style={$sectionLabel}>Name</Text>
      {nameValue !== "" ? (
        <View style={$card}>
          <View style={$renameRow}>
            <TextInput
              style={[$textInput, nameError ? $textInputError : undefined]}
              value={nameValue}
              onChangeText={(text) => {
                setNameValue(text);
                setNameError(null);
              }}
              placeholder={speaker.name}
              placeholderTextColor="#52525b"
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
            />
            {setNameMutation.isPending ? (
              <ActivityIndicator size="small" color="#fafafa" />
            ) : (
              <TouchableOpacity
                style={$saveButton}
                onPress={handleSaveName}
                activeOpacity={0.8}
              >
                <Text style={$saveButtonText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
          {nameError ? <Text style={$nameErrorText}>{nameError}</Text> : null}
        </View>
      ) : (
        <TouchableOpacity
          style={$card}
          activeOpacity={0.7}
          onPress={() => {
            setNameValue(speaker.name);
          }}
        >
          <View style={$infoRow}>
            <Text style={$infoLabel}>Name</Text>
            <View style={$infoRowRight}>
              <Text style={$infoValue} numberOfLines={1}>
                {speaker.name}
              </Text>
              {setNameMutation.isPending ? (
                <ActivityIndicator size="small" color="#a1a1aa" />
              ) : (
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  tintColor="#52525b"
                  size={14}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Audio */}
      <Text style={$sectionLabel}>Audio</Text>
      <View style={$card}>
        {/* Bass */}
        {showBass && bassCaps ? (
          <NativeSliderSetting
            label="Bass"
            value={bassValue}
            min={bassCaps.bassMin}
            max={bassCaps.bassMax}
            step={1}
            disabled={isSaving}
            onValueChange={(value) => {
              const rounded = Math.round(value);
              setBassSliderValue(rounded);
              setBassMutation.mutate({
                host: speaker.host,
                value: rounded,
              });
            }}
          />
        ) : null}

        {/* Audio DSP Mode */}
        {showDsp && dspControls ? (
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
        {showTone && toneControls ? (
          <>
            <View style={$infoDivider} />
            <NativeSliderSetting
              label="Bass EQ"
              value={toneControls.bass.value}
              min={toneControls.bass.minValue}
              max={toneControls.bass.maxValue}
              step={toneControls.bass.step}
              disabled={isSaving}
              onValueChange={(newValue) => {
                setAudioProductToneControlsMutation.mutate({
                  host: speaker.host,
                  bass: { value: newValue },
                });
              }}
            />
            <View style={$infoDivider} />
            <NativeSliderSetting
              label="Treble EQ"
              value={toneControls.treble.value}
              min={toneControls.treble.minValue}
              max={toneControls.treble.maxValue}
              step={toneControls.treble.step}
              disabled={isSaving}
              onValueChange={(newValue) => {
                setAudioProductToneControlsMutation.mutate({
                  host: speaker.host,
                  treble: { value: newValue },
                });
              }}
            />
          </>
        ) : null}

        {/* Speaker Levels */}
        {showLevels && levelControls ? (
          <>
            <View style={$infoDivider} />
            <NativeSliderSetting
              label="Front Center"
              value={levelControls.frontCenterSpeakerLevel.value}
              min={levelControls.frontCenterSpeakerLevel.minValue}
              max={levelControls.frontCenterSpeakerLevel.maxValue}
              step={levelControls.frontCenterSpeakerLevel.step}
              disabled={isSaving}
              onValueChange={(newValue) => {
                setAudioProductLevelControlsMutation.mutate({
                  host: speaker.host,
                  frontCenterSpeakerLevel: { value: newValue },
                });
              }}
            />
            <View style={$infoDivider} />
            <NativeSliderSetting
              label="Rear Surround"
              value={levelControls.rearSurroundSpeakersLevel.value}
              min={levelControls.rearSurroundSpeakersLevel.minValue}
              max={levelControls.rearSurroundSpeakersLevel.maxValue}
              step={levelControls.rearSurroundSpeakersLevel.step}
              disabled={isSaving}
              onValueChange={(newValue) => {
                setAudioProductLevelControlsMutation.mutate({
                  host: speaker.host,
                  rearSurroundSpeakersLevel: { value: newValue },
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
        {speaker.macAddress ? (
          <>
            <View style={$infoDivider} />
            <View style={$infoRow}>
              <Text style={$infoLabel}>MAC Address</Text>
              <Text style={$infoValue}>{speaker.macAddress}</Text>
            </View>
          </>
        ) : null}
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Type</Text>
          <Text style={$infoValue}>{speaker.type}</Text>
        </View>
      </View>

      {/* Software Versions */}
      {speaker.components && speaker.components.length > 0 ? (
        <>
          <Text style={$sectionLabel}>Software</Text>
          <View style={$card}>
            {speaker.components.map((comp, index) => (
              <View key={comp.serialNumber || index}>
                {index > 0 && <View style={$infoDivider} />}
                <Text style={$versionLabel}>
                  {comp.componentCategory || "Component"}
                </Text>
                <Text style={$versionValue}>{comp.softwareVersion}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function NativeSliderSetting({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}) {
  return (
    <View>
      <View style={$sliderHeader}>
        <Text style={$infoLabel}>{label}</Text>
        <Text style={$infoValue}>{value}</Text>
      </View>
      <Host style={{ height: 40 }}>
        <Slider
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </Host>
      <View style={$sliderLabels}>
        <Text style={$sliderLabelText}>{min}</Text>
        <Text style={$sliderLabelText}>{max}</Text>
      </View>
    </View>
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
                onPress={() => {
                  onChange(opt.value);
                }}
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
          {options.find((option) => option.value === value)?.description}
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

const $textInputError: TextStyle = {
  borderWidth: 1,
  borderColor: "#ef4444",
};

const $nameErrorText: TextStyle = {
  fontSize: 12,
  color: "#ef4444",
  marginTop: 4,
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

const $sliderHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
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

const $versionLabel: TextStyle = {
  fontSize: 13,
  color: "#71717a",
  fontWeight: "600",
  marginBottom: 4,
};

const $versionValue: TextStyle = {
  fontSize: 14,
  color: "#a1a1aa",
  fontWeight: "400",
  lineHeight: 20,
};
