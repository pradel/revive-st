import { SymbolView } from "expo-symbols";
import {
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { COLORS } from "@/ui/theme";

import type { ScanResult } from "../session/ports";
import {
  $setupBody,
  $setupButtons,
  $setupCard,
  $setupCardTitle,
  $setupEmphasis,
  $setupNote,
  SetupButton,
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
        <Text style={$setupCardTitle}>Put the speaker in setup mode</Text>
        <SetupInstruction index={1}>
          Plug in the speaker and turn it on.
        </SetupInstruction>
        <SetupInstruction index={2}>
          Hold <Text style={$setupEmphasis}>2</Text> and{" "}
          <Text style={$setupEmphasis}>Volume −</Text> together until the Wi-Fi
          light is <Text style={$setupEmphasis}>solid amber</Text> (about 5
          seconds).
        </SetupInstruction>
      </Card>

      <Card style={$setupCard}>
        <View style={$row}>
          <SymbolView
            name={{
              ios: "location",
              android: "location_on",
              web: "location_on",
            }}
            tintColor={COLORS.primary}
            size={20}
          />
          <Text style={[$setupBody, $flexText]}>
            Seeing nearby Wi-Fi networks requires{" "}
            <Text style={$setupEmphasis}>precise location</Text> access. Allow
            it on the next screen so the app can find your speaker. Your
            location is not stored or shared.
          </Text>
        </View>
      </Card>

      <View style={$setupButtons}>
        <SetupButton
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
        {sorted.map((speaker, index) => {
          const signal = signalStrength(speaker.level);
          return (
            <View key={speaker.bssid}>
              {index > 0 && <View style={$divider} />}
              <TouchableOpacity
                style={$listRow}
                onPress={() => {
                  onChoose(speaker.bssid);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <SymbolView
                  name={{
                    ios: "hifispeaker",
                    android: "speaker",
                    web: "speaker",
                  }}
                  tintColor={COLORS.primary}
                  size={22}
                />
                <View style={$flex}>
                  <Text style={$listTitle} numberOfLines={1}>
                    {speaker.ssid}
                  </Text>
                  <Text style={$listSubtitle}>{signal.label}</Text>
                </View>
                <SymbolView
                  name={signal.symbol}
                  tintColor={COLORS.textSecondary}
                  size={18}
                />
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  tintColor={COLORS.textMuted}
                  size={16}
                />
              </TouchableOpacity>
            </View>
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
          <Text style={$setupEmphasis}>Bose …</Text>).
        </SetupInstruction>
        <SetupInstruction index={2}>
          Before connecting, open the network's advanced options and set{" "}
          <Text style={$setupEmphasis}>IP settings</Text> to{" "}
          <Text style={$setupEmphasis}>Static</Text>.
        </SetupInstruction>
        <View style={$staticTable}>
          {STATIC_IP.map(([label, value]) => (
            <View key={label} style={$staticRow}>
              <Text style={$staticLabel}>{label}</Text>
              <Text style={$staticValue} selectable>
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
          Come back to this screen and tap{" "}
          <Text style={$setupEmphasis}>I'm connected</Text>.
        </SetupInstruction>
      </Card>

      <View style={$setupButtons}>
        <SetupButton
          label="Open Wi-Fi settings"
          variant="secondary"
          icon={{ ios: "gearshape", android: "settings", web: "settings" }}
          onPress={onOpenSettings}
        />
        <SetupButton
          label="I'm connected"
          icon={{ ios: "checkmark", android: "check", web: "check" }}
          onPress={onConnected}
        />
        <Text style={$setupNote}>
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

const $flex: ViewStyle = {
  flex: 1,
};

const $flexText: TextStyle = {
  flex: 1,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
};

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: 4,
};

const $listRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
};

const $listTitle: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $listSubtitle: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  marginTop: 2,
};

const $divider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  marginLeft: 50,
};

const $staticTable: ViewStyle = {
  backgroundColor: COLORS.background,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 8,
  marginLeft: 36,
  marginBottom: 12,
};

const $staticRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  paddingVertical: 4,
};

const $staticLabel: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
};

const $staticValue: TextStyle = {
  fontSize: 13,
  color: COLORS.text,
  fontWeight: "600",
  fontVariant: ["tabular-nums"],
};
