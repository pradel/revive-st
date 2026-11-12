import { FieldGroup, TextInput } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import {
  pairLedBy,
  validatePairName,
} from "@/features/speakers/lib/stereo-pair";
import { useSpeaker } from "@/features/speakers/registry/store";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { FormButtonRow, FormFooterText } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

/**
 * Renames a stereo pair through its master (`id`), which passes the name on
 * to its partner; goes back once the master has it.
 */
export default function RenamePair() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { renamePairMutation } = useSpeakerCommands();
  const master = useSpeaker(id);
  const pair = master && pairLedBy(master);

  const [draft, setDraft] = useState(pair?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!master || !pair) {
    return (
      <Screen>
        <Stack.Title>Name</Stack.Title>
        <EmptyState
          icon={icons.speaker}
          title="Stereo pair not found"
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
    const problem = validatePairName(name);
    if (problem !== undefined) {
      setError(problem);
      return;
    }
    const trimmed = name.trim();
    if (trimmed === pair.name) {
      router.back();
      return;
    }
    renamePairMutation.mutate(
      { deviceID: master.deviceID, name: trimmed },
      {
        onSuccess: () => {
          router.back();
        },
        onError: () => {
          setError("Couldn't rename the pair. Try again.");
        },
      },
    );
  };

  const saving = renamePairMutation.isPending;

  return (
    <Screen>
      <Stack.Title>Name</Stack.Title>
      <Form>
        <FormSection>
          <TextInput
            defaultValue={pair.name}
            placeholder="Pair name"
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
