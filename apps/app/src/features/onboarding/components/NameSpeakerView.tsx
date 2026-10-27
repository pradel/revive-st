import { useState } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { Button } from "@/ui/ds/Button";
import { Chip } from "@/ui/ds/Chip";
import { icons } from "@/ui/ds/Icon";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { space } from "@/ui/tokens";

import { validateSpeakerName } from "../session/naming";
import { $setupButtons, SetupHeader } from "./SetupLayout";

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

      <View style={$field}>
        <TextField
          icon={icons.speaker}
          placeholder={currentName}
          value={name}
          onChangeText={setName}
          onSubmitEditing={save}
          maxLength={50}
          autoCorrect={false}
          returnKeyType="done"
          editable={!submitted}
          accessibilityLabel="Speaker name"
        />
      </View>

      {shownProblem !== undefined && (
        <Text variant="subhead" color="danger" style={$problem}>
          {shownProblem}
        </Text>
      )}

      <View style={$chips}>
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            selected={name.trim() === suggestion}
            onPress={
              submitted
                ? undefined
                : () => {
                    setName(suggestion);
                  }
            }
          />
        ))}
      </View>

      <View style={$setupButtons}>
        <Button
          label="Save name"
          icon={{ ios: "checkmark", android: "check", web: "check" }}
          onPress={save}
          loading={submitted}
          disabled={attempted && problem !== undefined}
        />
        <Button
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

const $field: ViewStyle = {
  width: "100%",
  marginBottom: space.sm,
};

const $problem: TextStyle = {
  textAlign: "center",
  marginBottom: space.sm,
};

const $chips: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: space.xs,
  marginBottom: space.lg,
};
