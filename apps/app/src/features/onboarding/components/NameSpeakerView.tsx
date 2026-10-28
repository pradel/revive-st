import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { COLORS } from "@/ui/theme";

import { validateSpeakerName } from "../session/naming";
import {
  $setupButtons,
  $setupCard,
  SetupButton,
  SetupHeader,
} from "./SetupLayout";

interface NameSpeakerViewProps {
  currentName: string;
  suggestions: string[];
  /** `null` keeps the current name. */
  onSubmit: (name: string | null) => void;
}

/** Last step: give the speaker a name, or keep the one it has. */
export function NameSpeakerView({
  currentName,
  suggestions,
  onSubmit,
}: NameSpeakerViewProps) {
  const [name, setName] = useState(currentName);
  const [attempted, setAttempted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const problem = validateSpeakerName(name);
  const shownProblem = attempted ? problem : undefined;

  const save = () => {
    setAttempted(true);
    if (problem === undefined && !submitted) {
      setSubmitted(true);
      const trimmed = name.trim();
      onSubmit(trimmed === currentName ? null : trimmed);
    }
  };

  return (
    <>
      <SetupHeader
        icon={{ ios: "character.cursor.ibeam", android: "edit", web: "edit" }}
        title="Name your speaker"
        description="Pick a name you'll recognise in the speaker list, like the room it's in."
      />

      <Card style={[$setupCard, $inputCard]}>
        <View style={[$inputRow, focused && $inputFocused]}>
          <SymbolView
            name={{ ios: "hifispeaker", android: "speaker", web: "speaker" }}
            tintColor={COLORS.primary}
            size={20}
          />
          <TextInput
            style={$input}
            placeholder={currentName}
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            onFocus={() => {
              setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
            }}
            onSubmitEditing={save}
            maxLength={50}
            autoCorrect={false}
            returnKeyType="done"
            editable={!submitted}
            accessibilityLabel="Speaker name"
          />
        </View>
      </Card>

      {shownProblem !== undefined && (
        <Text style={$problem}>{shownProblem}</Text>
      )}

      <View style={$chips}>
        {suggestions.map((suggestion) => {
          const selected = name.trim() === suggestion;
          return (
            <TouchableOpacity
              key={suggestion}
              style={[$chip, selected && $chipSelected]}
              onPress={() => {
                setName(suggestion);
              }}
              disabled={submitted}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[$chipText, selected && $chipTextSelected]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={$setupButtons}>
        <SetupButton
          label="Save name"
          icon={{ ios: "checkmark", android: "check", web: "check" }}
          onPress={save}
          busy={submitted}
          disabled={attempted && problem !== undefined}
        />
        <SetupButton
          label="Keep current name"
          variant="secondary"
          disabled={submitted}
          onPress={() => {
            setSubmitted(true);
            onSubmit(null);
          }}
        />
      </View>
    </>
  );
}

const $inputCard: ViewStyle = {
  padding: 0,
  marginBottom: 12,
};

const $inputRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  height: 56,
  gap: 12,
};

const $inputFocused: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  borderRadius: 16,
};

const $input: TextStyle = {
  flex: 1,
  fontSize: 16,
  color: COLORS.text,
  height: "100%",
};

const $problem: TextStyle = {
  color: COLORS.errorLight,
  fontSize: 13,
  textAlign: "center",
  marginBottom: 12,
};

const $chips: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
  marginBottom: 20,
};

const $chip: ViewStyle = {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.card,
};

const $chipSelected: ViewStyle = {
  borderColor: COLORS.primary,
  backgroundColor: COLORS.primaryTransparent,
};

const $chipText: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "500",
};

const $chipTextSelected: TextStyle = {
  color: COLORS.primary,
};
