import { View, type TextStyle, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { Button } from "@/ui/ds/Button";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

import type { ScanResult } from "../session/ports";
import {
  $setupButtons,
  $setupCard,
  $setupCardTitle,
  $setupNote,
  Emphasis,
  SetupHeader,
  SetupInstruction,
  signalStrength,
} from "./SetupLayout";

/** Why location is needed, and how to put the speaker in setup mode. */
export function RationaleView({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <SetupHeader
        icon={{ ios: "speaker.wave.2", android: "speaker", web: "speaker" }}
        title="Set up a speaker"
        description="The app connects to your speaker over its own Wi-Fi network, then hands it the details of your home Wi-Fi."
      />

      <Card style={$setupCard}>
        <Text variant="headline" style={$setupCardTitle}>
          Put the speaker in setup mode
        </Text>
        <SetupInstruction index={1}>
          Plug in the speaker and turn it on.
        </SetupInstruction>
        <SetupInstruction index={2}>
          Hold <Emphasis>2</Emphasis> and <Emphasis>Volume −</Emphasis> together
          until the Wi-Fi light is <Emphasis>solid amber</Emphasis> (about 5
          seconds).
        </SetupInstruction>
      </Card>

      <Card style={$setupCard}>
        <View style={$row}>
          <Icon
            name={{
              ios: "location",
              android: "location_on",
              web: "location_on",
            }}
          />
          <Text variant="body" color="textSecondary" style={$flexText}>
            Seeing nearby Wi-Fi networks requires{" "}
            <Emphasis>precise location</Emphasis> access. Allow it on the next
            screen so the app can find your speaker. Your location is not stored
            or shared.
          </Text>
        </View>
      </Card>

      <View style={$setupButtons}>
        <Button
          label="Continue"
          icon={{
            ios: "arrow.right",
            android: "arrow_forward",
            web: "arrow_forward",
          }}
          onPress={onContinue}
        />
      </View>
    </>
  );
}

/** Several speakers are in setup mode: pick one, strongest signal first. */
export function ChooseSpeakerView({
  speakers,
  onChoose,
}: {
  speakers: ScanResult[];
  onChoose: (bssid: string) => void;
}) {
  const sorted = [...speakers].sort((a, b) => b.level - a.level);
  return (
    <>
      <SetupHeader
        icon={{
          ios: "hifispeaker.2",
          android: "speaker_group",
          web: "speaker_group",
        }}
        title="Choose your speaker"
        description="Several speakers are in setup mode. The closest one usually has the strongest signal."
      />

      <Card style={[$setupCard, $listCard]}>
        {sorted.map((speaker) => {
          const signal = signalStrength(speaker.level);
          return (
            <ListRow
              key={speaker.bssid}
              title={speaker.ssid}
              subtitle={signal.label}
              leading={<Icon name={icons.speaker} size={22} />}
              trailing={
                <View style={$trailing}>
                  <Icon name={signal.symbol} size={18} />
                  <Icon
                    name={icons.chevronRight}
                    size={16}
                    color="textTertiary"
                  />
                </View>
              }
              onPress={() => {
                onChoose(speaker.bssid);
              }}
            />
          );
        })}
      </Card>
    </>
  );
}

/** Joining the setup network by hand, with a static address. */
export function ManualJoinView({
  onOpenSettings,
  onConnected,
}: {
  onOpenSettings: () => void;
  onConnected: () => void;
}) {
  return (
    <>
      <SetupHeader
        icon={{ ios: "hand.tap", android: "touch_app", web: "touch_app" }}
        title="Connect manually"
        description="Connect the phone to the speaker's Wi-Fi network yourself, then come back here."
      />

      <Card style={$setupCard}>
        <SetupInstruction index={1}>
          Open the Wi-Fi settings and select the speaker's network (
          <Emphasis>Bose …</Emphasis>).
        </SetupInstruction>
        <SetupInstruction index={2}>
          Before connecting, open the network's advanced options and set{" "}
          <Emphasis>IP settings</Emphasis> to <Emphasis>Static</Emphasis>.
        </SetupInstruction>
        <View style={$staticTable}>
          {STATIC_IP.map(([label, value]) => (
            <View key={label} style={$staticRow}>
              <Text variant="subhead" color="textSecondary">
                {label}
              </Text>
              <Text variant="subhead" style={$staticValue} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <SetupInstruction index={3}>
          Connect. If Android warns that the network has no internet, choose to
          stay connected.
        </SetupInstruction>
        <SetupInstruction index={4}>
          Come back to this screen and tap <Emphasis>I'm connected</Emphasis>.
        </SetupInstruction>
      </Card>

      <View style={$setupButtons}>
        <Button
          label="Open Wi-Fi settings"
          variant="secondary"
          icon={{ ios: "gearshape", android: "settings", web: "settings" }}
          onPress={onOpenSettings}
        />
        <Button
          label="I'm connected"
          icon={{ ios: "checkmark", android: "check", web: "check" }}
          onPress={onConnected}
        />
        <Text variant="caption" color="textTertiary" style={$setupNote}>
          The speaker's address on its own network is always 192.0.2.1.
        </Text>
      </View>
    </>
  );
}

const STATIC_IP: [label: string, value: string][] = [
  ["IP address", "192.0.2.50"],
  ["Gateway", "192.0.2.1"],
  ["Network prefix length", "24"],
  ["DNS", "192.0.2.1"],
];

const $flexText: TextStyle = {
  flex: 1,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
};

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: space.xxs,
  overflow: "hidden",
};

const $trailing: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
};

const $staticTable: ViewStyle = {
  backgroundColor: color.surface2,
  borderRadius: radius.sm,
  paddingHorizontal: space.sm,
  paddingVertical: space.xs,
  marginLeft: 36,
  marginBottom: space.sm,
};

const $staticRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  paddingVertical: space.xxs,
};

const $staticValue: TextStyle = {
  fontVariant: ["tabular-nums"],
};
