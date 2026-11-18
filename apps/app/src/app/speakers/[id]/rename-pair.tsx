import { FieldGroup, TextInput } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import {
  pairLedBy,
  type SpeakerPair,
  validatePairName,
} from "@/features/speakers/lib/stereo-pair";
import { useSpeaker } from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
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
  const master = useSpeaker(id);
  const pair = master && pairLedBy(master);

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

  // Mounted once the pair is known, so the draft starts from its name.
  return <RenamePairForm master={master} pair={pair} />;
}

function RenamePairForm({
  master,
  pair,
}: {
  master: BoseSpeaker;
  pair: SpeakerPair;
}) {
  const router = useRouter();
  const { renamePairMutation } = useSpeakerCommands();
  const [draft, setDraft] = useState(pair.name);
  const [error, setError] = useState<string | null>(null);
  // Until the master says which pair it's in, there's no pair to rename.
  const pairRead = master.pairRead === true;

  const save = (name: string) => {
    if (!pairRead) {
      return;
    }
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
      { deviceID: master.deviceID, pairID: pair.id, name: trimmed },
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
            disabled={saving || !pairRead}
            onPress={() => {
              save(draft);
            }}
          />
        </FormSection>
      </Form>
    </Screen>
  );
}
