import { FieldGroup, TextInput } from "@expo/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  checkServer,
  saveServerUrl,
  useServerUrl,
} from "@/features/server/server";
import {
  DEFAULT_SERVER_URL,
  parseServerUrl,
} from "@/features/server/server-url";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { FormButtonRow, FormFooterText } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

export default function ServerSettings() {
  const router = useRouter();
  const serverUrl = useServerUrl();
  const [draft, setDraft] = useState(serverUrl);
  const [error, setError] = useState<string | null>(null);

  const switchServer = useMutation({
    // Throws the problem to show: a malformed address or a server that
    // doesn't answer like ours.
    mutationFn: async (input: string) => {
      const parsed = parseServerUrl(input.trim());
      if (!parsed.isOk()) {
        throw new Error(parsed.error);
      }
      const problem = await checkServer(parsed.value);
      if (problem !== undefined) {
        throw new Error(problem);
      }
      await saveServerUrl(parsed.value);
    },
    onSuccess: () => {
      router.back();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const resetServer = useMutation({
    mutationFn: async () => saveServerUrl(DEFAULT_SERVER_URL),
    onSuccess: () => {
      router.back();
    },
    onError: () => {
      setError("Couldn't save the server. Try again.");
    },
  });

  const pending = switchServer.isPending || resetServer.isPending;
  const save = (input: string) => {
    setError(null);
    switchServer.mutate(input);
  };

  return (
    <Screen>
      <Form>
        <FormSection title="Server address">
          <TextInput
            defaultValue={serverUrl}
            placeholder="https://revive.example.com"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!pending}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            onSubmitEditing={save}
          />
          <FormButtonRow
            label={switchServer.isPending ? "Checking the server…" : "Save"}
            disabled={pending}
            onPress={() => {
              save(draft);
            }}
          />
          <FieldGroup.SectionFooter>
            <FormFooterText color={error === null ? undefined : color.danger}>
              {error ??
                "The Revive ST server the app and the speakers you configure use, like http://192.168.1.10:3000 for one on your network. Speakers configured for another server show as not configured until you configure them again."}
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>

        {serverUrl === DEFAULT_SERVER_URL ? null : (
          <FormSection>
            <FormButtonRow
              label="Use the Revive ST server"
              disabled={pending}
              onPress={() => {
                setError(null);
                resetServer.mutate();
              }}
            />
          </FormSection>
        )}
      </Form>
    </Screen>
  );
}
