import { BottomSheet, Host, Slider } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useMargeAPIStatusQuery } from "@/features/speakers/hooks/useSpeakerMutations";
import { COLORS } from "@/ui/theme";

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
      <View style={$container}>
        <Stack.Screen
          options={{
            title: "Settings",
            headerShown: true,
            headerStyle: { backgroundColor: COLORS.background },
            headerTintColor: COLORS.text,
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
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "600" },
        }}
      />

      {/* Hero */}
      <Card style={$heroCard}>
        <View style={$heroIconContainer}>
          <SymbolView
            name={{ ios: "speaker.wave.2", android: "speaker", web: "speaker" }}
            tintColor={COLORS.primary}
            size={32}
          />
        </View>
        <Text style={$heroTitle}>{speaker.name}</Text>
        <Text style={$heroSubtitle}>
          {speaker.type} · {speaker.host}
        </Text>
      </Card>

      {/* Name */}
      <Text style={$sectionLabel}>Name</Text>
      {nameValue !== "" ? (
        <Card>
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
        </Card>
      ) : (
        <Card
          style={$linkCard}
          render={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setNameValue(speaker.name);
              }}
            />
          }
        >
          <View style={$linkIconContainer}>
            <SymbolView
              name={{ ios: "pencil", android: "edit", web: "edit" }}
              tintColor={COLORS.textSecondary}
              size={20}
            />
          </View>
          <Text style={[$linkText, { flex: 1 }]}>Rename Speaker</Text>
          {setNameMutation.isPending ? (
            <ActivityIndicator size="small" color="#a1a1aa" />
          ) : (
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
              tintColor={COLORS.textMuted}
              size={20}
            />
          )}
        </Card>
      )}

      {/* Audio */}
      <Text style={$sectionLabel}>Audio</Text>
      <Card>
        {/* Bass */}
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
              isSaving={setAudioProductToneControlsMutation.isPending}
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
              isSaving={setAudioProductToneControlsMutation.isPending}
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
              isSaving={setAudioProductLevelControlsMutation.isPending}
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
              isSaving={setAudioProductLevelControlsMutation.isPending}
              onValueChange={(newValue) => {
                setAudioProductLevelControlsMutation.mutate({
                  host: speaker.host,
                  rearSurroundSpeakersLevel: { value: newValue },
                });
              }}
            />
          </>
        ) : null}
      </Card>

      {/* Radio Configuration */}
      <Text style={$sectionLabel}>Radio Configuration</Text>
      <Card>
        <View style={$infoRow}>
          <Text style={$infoLabel}>Marge API Radio</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {(() => {
              if (margeAPIStatus.isLoading) {
                return (
                  <ActivityIndicator size="small" color={COLORS.textMuted} />
                );
              }
              if (margeAPIStatus.isError) {
                return (
                  <Text style={[$infoValue, { color: COLORS.error }]}>
                    Connection Failed
                  </Text>
                );
              }
              if (margeAPIStatus.data) {
                return (
                  <Text style={[$infoValue, { color: COLORS.primary }]}>
                    Configured
                  </Text>
                );
              }
              return <Text style={$infoValue}>Not Configured</Text>;
            })()}
          </View>
        </View>

        {margeAPIStatus.isError && (
          <>
            <View style={$infoDivider} />
            <Text
              style={[$pickerDescription, { marginTop: 0, marginBottom: 12 }]}
            >
              Failed to connect to the speaker via Telnet. Ensure your device is
              on the same network.
            </Text>
            <TouchableOpacity
              style={$secondaryButton}
              onPress={() => {
                void margeAPIStatus.refetch();
              }}
            >
              <Text style={$secondaryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </>
        )}

        {!margeAPIStatus.isLoading && !margeAPIStatus.isError && (
          <>
            <View style={$infoDivider} />
            <Text
              style={[$pickerDescription, { marginTop: 0, marginBottom: 12 }]}
            >
              Enable custom internet radio streams on this speaker. This will
              reboot the device.
            </Text>
            <TouchableOpacity
              style={$primaryButton}
              onPress={() => {
                router.push("./configure");
              }}
            >
              <Text style={$primaryButtonText}>
                {margeAPIStatus.data
                  ? "Re-configure for Marge API"
                  : "Configure for Marge API"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </Card>

      {/* Presets */}
      <Text style={$sectionLabel}>Presets</Text>
      <Text
        style={[
          $pickerDescription,
          { marginLeft: 4, marginTop: 0, marginBottom: 8 },
        ]}
      >
        Press and hold the desired preset button on your device or remote until
        you hear a beep. From now on you can start the stream by pressing the
        preset button.
      </Text>
      <Card>
        {speaker.presets && speaker.presets.length > 0 ? (
          speaker.presets.map((preset, index) => (
            <View key={preset.id}>
              {index > 0 && <View style={$infoDivider} />}
              <View style={$infoRow}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flexShrink: 1,
                  }}
                >
                  <View style={$presetNumberBadge}>
                    <Text style={$presetNumberText}>{preset.id}</Text>
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={$infoLabel}>{preset.contentItem.source}</Text>
                    {preset.contentItem.location ? (
                      <Text
                        style={[$pickerDescription, { marginTop: 2 }]}
                        numberOfLines={1}
                      >
                        {preset.contentItem.location}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={$infoValue}>No presets configured.</Text>
        )}
      </Card>

      {/* Device Info */}
      <Text style={$sectionLabel}>Device Info</Text>
      <Card>
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
      </Card>

      {/* Software Versions */}
      {speaker.components && speaker.components.length > 0 ? (
        <>
          <Text style={$sectionLabel}>Software</Text>
          <Card>
            {speaker.components.map((comp, index) => (
              <View key={comp.serialNumber || index}>
                {index > 0 && <View style={$infoDivider} />}
                <Text style={$versionLabel}>
                  {comp.componentCategory || "Component"}
                </Text>
                <Text style={$versionValue}>{comp.softwareVersion}</Text>
              </View>
            ))}
          </Card>
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

  // Local state to keep slider movement fluid
  const [localValue, setLocalValue] = useState(value);

  // Sync with value prop when value updates
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Sync with value prop when sheet opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
    }
  }, [isOpen, value]);

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const lastFiredValueRef = useRef<number | null>(null);
  useEffect(() => {
    lastFiredValueRef.current = null;
  }, [value]);

  // Debounced callback with immediate flush on close
  useEffect(() => {
    if (localValue === value || localValue === lastFiredValueRef.current) {
      return;
    }
    if (!isOpen) {
      onValueChangeRef.current(localValue);
      lastFiredValueRef.current = localValue;
      return;
    }
    const timer = setTimeout(() => {
      onValueChangeRef.current(localValue);
      lastFiredValueRef.current = localValue;
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [localValue, value, isOpen]);

  return (
    <>
      <TouchableOpacity
        style={$infoRow}
        activeOpacity={0.7}
        onPress={() => {
          setIsOpen(true);
        }}
      >
        <Text style={$infoLabel}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isSaving && (
            <ActivityIndicator size="small" color={COLORS.textMuted} />
          )}
          <Text style={$infoValue}>{value}</Text>
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            tintColor={COLORS.textMuted}
            size={14}
          />
        </View>
      </TouchableOpacity>
      <BottomSheet
        isPresented={isOpen}
        onDismiss={() => {
          setIsOpen(false);
        }}
        snapPoints={["half"]}
      >
        <View style={[$bottomSheetContent, { width }]}>
          <View style={$sliderHeader}>
            <Text style={$infoLabel}>{label}</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {isSaving && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <ActivityIndicator size="small" color={COLORS.textMuted} />
                  <Text style={$savingText}>Saving...</Text>
                </View>
              )}
              <Text style={$infoValue}>{localValue}</Text>
            </View>
          </View>
          <Host style={{ height: 40 }}>
            <Slider
              value={localValue}
              onValueChange={setLocalValue}
              min={min}
              max={max}
              step={step}
              disabled={isSaving}
            />
          </Host>
          <View style={$sliderLabels}>
            <Text style={$sliderLabelText}>{min}</Text>
            <Text style={$sliderLabelText}>{max}</Text>
          </View>
        </View>
      </BottomSheet>
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
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 40,
  gap: 8,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 80,
};

const $notFoundText: TextStyle = {
  fontSize: 16,
  color: COLORS.textMuted,
  marginTop: 16,
};

const $backButton: ViewStyle = {
  marginTop: 20,
  paddingHorizontal: 24,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: COLORS.border,
};

const $backButtonText: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "600",
};

const $heroCard: ViewStyle = {
  alignItems: "center",
  paddingVertical: 24,
  marginBottom: 8,
};

const $heroIconContainer: ViewStyle = {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: "rgba(29, 185, 84, 0.1)",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 16,
};

const $heroTitle: TextStyle = {
  fontSize: 22,
  fontWeight: "bold",
  color: COLORS.text,
  marginBottom: 4,
  textAlign: "center",
};

const $heroSubtitle: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
};

const $sectionLabel: TextStyle = {
  fontSize: 16,
  fontWeight: "700",
  color: COLORS.primary,
  marginTop: 16,
  marginBottom: 4,
  marginLeft: 4,
};

const $linkCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 12,
};

const $linkIconContainer: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 16,
};

const $linkText: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $renameRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
};

const $textInput: TextStyle = {
  flex: 1,
  backgroundColor: COLORS.border,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: COLORS.text,
};

const $textInputError: TextStyle = {};

const $nameErrorText: TextStyle = {
  fontSize: 12,
  color: COLORS.error,
  marginTop: 4,
};

const $saveButton: ViewStyle = {
  backgroundColor: COLORS.text,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10,
};

const $saveButtonText: TextStyle = {
  fontSize: 14,
  color: COLORS.background,
  fontWeight: "700",
};

const $infoDivider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  marginVertical: 10,
};

const $infoRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: 4,
};

const $infoLabel: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $infoValue: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "right",
  flexShrink: 1,
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

const $bottomSheetContent: ViewStyle = {
  flex: 1,
  width: "100%",
  padding: 24,
  paddingBottom: 48,
};

const $sliderLabelText: TextStyle = {
  fontSize: 11,
  color: COLORS.textDisabled,
};

const $savingText: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
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
  backgroundColor: COLORS.border,
};

const $pickerChipActive: ViewStyle = {
  backgroundColor: COLORS.text,
};

const $pickerChipText: TextStyle = {
  fontSize: 13,
  color: COLORS.textSecondary,
  fontWeight: "600",
};

const $pickerChipTextActive: TextStyle = {
  color: COLORS.background,
};

const $pickerDescription: TextStyle = {
  fontSize: 12,
  color: COLORS.textDisabled,
  marginTop: 8,
};

const $versionLabel: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
  fontWeight: "600",
  marginBottom: 4,
};

const $versionValue: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "400",
  lineHeight: 20,
};

const $presetNumberBadge: ViewStyle = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
};

const $presetNumberText: TextStyle = {
  color: COLORS.text,
  fontSize: 13,
  fontWeight: "bold",
};

const $primaryButton: ViewStyle = {
  backgroundColor: COLORS.text,
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: "center",
};

const $primaryButtonText: TextStyle = {
  color: COLORS.background,
  fontSize: 15,
  fontWeight: "600",
};

const $secondaryButton: ViewStyle = {
  backgroundColor: COLORS.border,
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: "center",
};

const $secondaryButtonText: TextStyle = {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "600",
};
