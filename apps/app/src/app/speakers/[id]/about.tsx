import { FieldGroup } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { shortVersion } from "@/features/speakers/lib/firmware";
import { useSpeaker } from "@/features/speakers/registry/store";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { FormFooterText, FormValueRow } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";

/** A speaker's identifiers and software versions, for support and debugging. */
export default function AboutSpeaker() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const speaker = useSpeaker(id);

  if (!speaker) {
    return (
      <Screen>
        <Stack.Title>About</Stack.Title>
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

  return (
    <Screen>
      <Stack.Title>About</Stack.Title>
      <Form>
        <FormSection title="Device">
          <FormValueRow label="Model" value={speaker.type} copyable />
          <FormValueRow label="Device ID" value={speaker.deviceID} copyable />
          <FormValueRow label="IP address" value={speaker.host} copyable />
          <FormValueRow label="Port" value={String(speaker.port)} copyable />
          {speaker.macAddress ? (
            <FormValueRow
              label="MAC address"
              value={speaker.macAddress}
              copyable
            />
          ) : null}
        </FormSection>

        {speaker.components && speaker.components.length > 0 ? (
          <FormSection title="Software">
            {speaker.components.map((component, index) => (
              <FormValueRow
                key={component.serialNumber || index}
                label={component.componentCategory || "Component"}
                value={shortVersion(component.softwareVersion)}
                copyValue={component.softwareVersion}
              />
            ))}
            <FieldGroup.SectionFooter>
              <FormFooterText>
                Tap a version to copy its full build.
              </FormFooterText>
            </FieldGroup.SectionFooter>
          </FormSection>
        ) : null}
      </Form>
    </Screen>
  );
}
