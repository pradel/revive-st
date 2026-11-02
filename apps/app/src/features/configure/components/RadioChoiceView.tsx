import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, View, type TextStyle, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { APP_CONFIG } from "@/config";
import {
  $setupButtons,
  $setupCard,
  $setupNote,
  SetupHeader,
} from "@/features/onboarding/components/SetupLayout";
import { switchServer } from "@/features/server/server";
import {
  DEFAULT_SERVER_URL,
  parseServerUrl,
  serverHost,
} from "@/features/server/server-url";
import type { RadioStatus } from "@/features/speakers/lib/speaker-radio";
import { Button } from "@/ui/ds/Button";
import { Icon, type IconName, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { color, space } from "@/ui/tokens";

import {
  currentChoice,
  defaultRadioChoice,
  keepOption,
  type RadioChoice,
} from "../radio-choice";

const HOSTED_ICON: IconName = {
  ios: "cloud.fill",
  android: "cloud",
  web: "cloud",
};
const OWN_ICON: IconName = { ios: "server.rack", android: "dns", web: "dns" };

/**
 * After Wi-Fi setup: which server the speaker gets internet radio from. The
 * hosted server and the user's own become the app's server (as in Settings),
 * which the setup that follows points the speaker at; the one it already
 * plays radio through, or keeping its server, leaves the speaker as it is.
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
  // Until the user picks, the default follows the speaker's radio, which may
  // still be checked when the screen opens.
  const [picked, setPicked] = useState<RadioChoice>();
  const [address, setAddress] = useState(
    ourServer === DEFAULT_SERVER_URL ? "" : ourServer,
  );
  const current = currentChoice(radio, ourServer);
  const keep = keepOption(radio, ourServer);
  const choice =
    picked === undefined || (picked === "keep" && keep === undefined)
      ? defaultRadioChoice(radio, ourServer)
      : picked;

  const parsed = parseServerUrl(address.trim());
  const target =
    choice === "hosted"
      ? DEFAULT_SERVER_URL
      : parsed.isOk()
        ? parsed.value
        : undefined;
  // Picking the server the speaker already plays radio through leaves it as
  // it is; for its own server, only while the address still names it.
  const keepsAsIs =
    choice === "keep" ||
    (choice === current && (choice === "hosted" || target === ourServer));
  const switching = !keepsAsIs && target !== ourServer;

  const pick = useMutation({
    // Throws the problem to show: a malformed address or a server that
    // doesn't answer like a Revive ST server this app works with.
    mutationFn: async (chosen: Exclude<RadioChoice, "keep">) => {
      if (target !== ourServer) {
        await switchServer(chosen === "hosted" ? DEFAULT_SERVER_URL : address);
      }
    },
    onSuccess: onChosen,
  });

  const submit = () => {
    if (choice === "keep" || keepsAsIs) {
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
        <View style={$iconWell}>
          <Icon
            name={icon}
            color={choice === value ? "accent" : "textPrimary"}
          />
        </View>
      }
      selected={choice === value}
      disabled={pick.isPending}
      onPress={() => {
        setPicked(value);
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
        description="Internet radio and presets come from an online server."
      />
      <Card style={[$setupCard, $listCard]}>
        {option(
          "hosted",
          "Revive ST",
          current === "hosted"
            ? "Current · it plays radio through it"
            : "Hosted for you, free",
          HOSTED_ICON,
        )}
        {option(
          "own",
          "My own server",
          current === "own"
            ? `Current · ${serverHost(ourServer)}`
            : "A Revive ST server you run",
          OWN_ICON,
        )}
        {keep !== undefined &&
          option("keep", keep.title, keep.subtitle, icons.speaker)}
      </Card>

      {choice === "own" && (
        <View style={$field}>
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
        <View style={$problem}>
          <Icon name={icons.warning} color="danger" size={16} />
          <Text variant="subhead" color="danger" style={$flex}>
            {pick.error.message}
          </Text>
        </View>
      )}

      <View style={$setupButtons}>
        <Button
          label={
            choice === "keep" && keep !== undefined
              ? keep.button
              : keepsAsIs
                ? "Keep it as it is"
                : "Continue"
          }
          loading={pick.isPending}
          onPress={submit}
        />
        {keepsAsIs ? (
          <Text variant="caption" color="textTertiary" style={$setupNote}>
            You can set it up later from its settings.
          </Text>
        ) : (
          <>
            {choice === "hosted" && (
              <Text
                variant="caption"
                color="accent"
                style={$setupNote}
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL(APP_CONFIG.PRIVACY_URL);
                }}
              >
                What the hosted server keeps
              </Text>
            )}
            {switching && (
              <Text variant="caption" color="textTertiary" style={$setupNote}>
                Speakers already set up keep their server until you set them up
                again.
              </Text>
            )}
          </>
        )}
      </View>
    </>
  );
}

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: space.xxs,
  overflow: "hidden",
};

const $iconWell: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: color.surface2,
};

const $field: ViewStyle = {
  width: "100%",
  marginBottom: space.sm,
};

const $problem: ViewStyle = {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  paddingHorizontal: space.xs,
  marginBottom: space.sm,
};

const $flex: TextStyle = {
  flex: 1,
};
