import { FieldGroup, TextInput } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { validateSpeakerName } from "@/features/onboarding/session/naming";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { FormButtonRow, FormFooterText } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

/** Renames a speaker; goes back once the speaker has its new name. */
export default function RenameSpeaker() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakers, setNameMutation } = useBose();
  const speaker = speakers.find((item) => item.deviceID === id);

  const [draft, setDraft] = useState(speaker?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!speaker) {
    return (
      <Screen>
        <Stack.Title>Name</Stack.Title>
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

  const save = (name: string) => {
    const problem = validateSpeakerName(name);
    if (problem !== undefined) {
      setError(problem);
      return;
    }
    const trimmed = name.trim();
    if (trimmed === speaker.name) {
      router.back();
      return;
    }
    setNameMutation.mutate(
      { deviceID: speaker.deviceID, name: trimmed },
      {
        onSuccess: () => {
          router.back();
        },
        onError: () => {
          setError("Couldn't rename the speaker. Try again.");
        },
      },
    );
  };

  const saving = setNameMutation.isPending;

  return (
    <Screen>
      <Stack.Title>Name</Stack.Title>
      <Form>
        <FormSection>
          <TextInput
            defaultValue={speaker.name}
            placeholder="Speaker name"
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            editable={!saving}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            onSubmitEditing={save}
          />
          {error !== null ? (
            <FieldGroup.SectionFooter>
              <FormFooterText color={color.danger}>{error}</FormFooterText>
            </FieldGroup.SectionFooter>
          ) : null}
        </FormSection>
        <FormSection>
          <FormButtonRow
            label={saving ? "Saving…" : "Save"}
            disabled={saving}
            onPress={() => {
              save(draft);
            }}
          />
        </FormSection>
      </Form>
    </Screen>
  );
}
