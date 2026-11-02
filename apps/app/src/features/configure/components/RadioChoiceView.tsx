import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import {
  $setupButtons,
  $setupCard,
  $setupNote,
  SetupHeader,
} from "@/features/onboarding/components/SetupLayout";
import { switchServer } from "@/features/server/server";
import { DEFAULT_SERVER_URL } from "@/features/server/server-url";
import type { RadioStatus } from "@/features/speakers/lib/speaker-radio";
import { Button } from "@/ui/ds/Button";
import { Icon, type IconName, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { color, radius, space } from "@/ui/tokens";

import {
  defaultRadioChoice,
  keepOption,
  type RadioChoice,
} from "../radio-choice";

const HOSTED_ICON: IconName = { ios: "cloud", android: "cloud", web: "cloud" };
const OWN_ICON: IconName = { ios: "server.rack", android: "dns", web: "dns" };

/**
 * After Wi-Fi setup: which server the speaker gets internet radio from. The
 * hosted server and the user's own become the app's server (as in Settings),
 * which the setup that follows points the speaker at; keeping its server
 * leaves the speaker as it is.
 */
export function RadioChoiceView({
  speakerName,
  radio,
  ourServer,
  onChosen,
  onKeep,
}: {
  speakerName: string;
  radio: RadioStatus | undefined;
  /** The server the app is set to now. */
  ourServer: string;
  /** The app is set to the chosen server: set the speaker up for it. */
  onChosen: () => void;
  onKeep: () => void;
}) {
  const [choice, setChoice] = useState<RadioChoice>(() =>
    defaultRadioChoice(radio, ourServer),
  );
  const [address, setAddress] = useState(
    ourServer === DEFAULT_SERVER_URL ? "" : ourServer,
  );
  const keep = keepOption(radio, ourServer);

  const pick = useMutation({
    // Throws the problem to show: a malformed address or a server that
    // doesn't answer like a Revive ST server this app works with.
    mutationFn: async (picked: Exclude<RadioChoice, "keep">) => {
      const target = picked === "hosted" ? DEFAULT_SERVER_URL : address;
      if (target !== ourServer) {
        await switchServer(target);
      }
    },
    onSuccess: onChosen,
  });

  const submit = () => {
    if (choice === "keep") {
      onKeep();
    } else {
      pick.mutate(choice);
    }
  };

  const option = (
    value: RadioChoice,
    title: string,
    subtitle: string,
    icon: IconName,
  ) => (
    <ListRow
      title={title}
      subtitle={subtitle}
      leading={
        <Icon
          name={icon}
          color={choice === value ? "accent" : "textSecondary"}
        />
      }
      selected={choice === value}
      disabled={pick.isPending}
      onPress={() => {
        setChoice(value);
        pick.reset();
      }}
    />
  );

  return (
    <>
      <SetupHeader
        overline={speakerName}
        icon={icons.radio}
        title="How should this speaker get radio?"
        description={`Internet radio and presets on SoundTouch speakers come from an online server. Pick the one ${speakerName} uses.`}
      />
      <Card style={[$setupCard, $listCard]}>
        {option("hosted", "Revive ST", "Hosted for you, free", HOSTED_ICON)}
        {option("own", "My own server", "A Revive ST server you run", OWN_ICON)}
        {option("keep", keep.title, keep.subtitle, icons.speaker)}
      </Card>

      {choice === "own" && (
        <View style={$setupCard}>
          <TextField
            icon={OWN_ICON}
            placeholder="http://192.168.1.10:3000"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              pick.reset();
            }}
            onSubmitEditing={submit}
            editable={!pick.isPending}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
      )}

      {pick.error !== null && (
        <View style={[$setupCard, $problem]}>
          <Icon name={icons.warning} color="danger" />
          <Text variant="body" style={$flex}>
            {pick.error.message}
          </Text>
        </View>
      )}

      <View style={$setupButtons}>
        <Button
          label={choice === "keep" ? keep.button : "Continue"}
          loading={pick.isPending}
          onPress={submit}
        />
        <Text variant="caption" color="textTertiary" style={$setupNote}>
          {choice === "hosted"
            ? "The hosted server keeps your presets, your speakers' device ids and when each last contacted it. The app sets up speakers for the server you pick; speakers already set up keep theirs until you set them up again."
            : choice === "own"
              ? "The app sets up speakers for the server you pick; speakers already set up keep theirs until you set them up again."
              : "You can set it up later from its settings."}
        </Text>
      </View>
    </>
  );
}

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: space.xxs,
  overflow: "hidden",
};

const $problem: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  padding: space.md,
  borderRadius: radius.md,
  backgroundColor: color.dangerMuted,
};

const $flex: TextStyle = {
  flex: 1,
};
