import {
  type ComponentRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  View,
  type TextInput,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { Button } from "@/ui/ds/Button";
import { Icon, icons, type IconName } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { color, radius, space } from "@/ui/tokens";

import { validateCredentials } from "../session/credentials";
import type { HomeNetwork, Security } from "../session/types";
import {
  $setupButtons,
  $setupCard,
  $setupNote,
  Emphasis,
  SetupHeader,
  SetupScrollContext,
  signalStrength,
} from "./SetupLayout";

const WIFI_ICON: IconName = { ios: "wifi", android: "wifi", web: "wifi" };

const SECURITY_LABEL: Record<Security, string> = {
  open: "Open",
  wpa: "Secured",
  wpa3: "WPA3",
  unsupported: "Not supported",
};

/**
 * Focusing on mount opens the keyboard before the keyboard-aware scroll view has
 * measured the field, which leaves the field hidden behind the keyboard.
 */
const REJECTED_FOCUS_DELAY_MS = 400;

interface CredentialsFormProps {
  networks: HomeNetwork[];
  suggested?: string;
  reason?: "rejected";
  /** A rescan is running; the list shows the previous results meanwhile. */
  refreshing: boolean;
  onRefresh: () => void;
  onSubmit: (ssid: string, password: string) => void;
}

export function CredentialsForm({
  networks,
  suggested,
  reason,
  refreshing,
  onRefresh,
  onSubmit,
}: CredentialsFormProps) {
  const suggestedListed =
    suggested !== undefined &&
    networks.some((network) => network.ssid === suggested);
  const [manual, setManual] = useState(
    suggested !== undefined && !suggestedListed,
  );
  const [selected, setSelected] = useState(
    suggestedListed ? suggested : undefined,
  );
  const [manualSsid, setManualSsid] = useState(
    suggestedListed ? "" : (suggested ?? ""),
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { scrollToEnd } = useContext(SetupScrollContext);
  const keyboardShown = useRef<ReturnType<typeof Keyboard.addListener> | null>(
    null,
  );

  /** The inputs sit at the end of the form: scroll there once the keyboard is up. */
  const revealInputs = () => {
    keyboardShown.current?.remove();
    keyboardShown.current = null;
    if (Keyboard.isVisible()) {
      scrollToEnd();
      return;
    }
    keyboardShown.current = Keyboard.addListener("keyboardDidShow", () => {
      keyboardShown.current?.remove();
      keyboardShown.current = null;
      scrollToEnd();
    });
  };

  useEffect(
    () => () => {
      keyboardShown.current?.remove();
    },
    [],
  );

  useEffect(() => {
    if (reason !== "rejected") {
      return;
    }
    const timer = setTimeout(() => {
      passwordRef.current?.focus();
    }, REJECTED_FOCUS_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reason]);

  const ssid = manual ? manualSsid : (selected ?? "");
  const security = networks.find((network) => network.ssid === ssid)?.security;
  const validation = validateCredentials({ ssid, password }, security);
  const problem = validation.isErr() ? validation.error : undefined;
  const shownProblem =
    problem !== undefined &&
    (attempted || problem.problem === "unsupportedSecurity")
      ? problem
      : undefined;
  const needsPassword = security !== "open";

  const submit = () => {
    setAttempted(true);
    if (validation.isOk() && !refreshing) {
      const { credentials } = validation.value;
      onSubmit(credentials.ssid, credentials.password);
    }
  };

  return (
    <>
      <SetupHeader
        icon={{ ios: "wifi", android: "wifi", web: "wifi" }}
        title="Connect to Wi-Fi"
        description="Choose the Wi-Fi network the speaker should join and enter its password. 2.4 GHz and 5 GHz networks both work."
      />

      <Card style={[$setupCard, $listCard]}>
        <View style={$listHeader}>
          <Text variant="overline" color="textSecondary">
            Networks nearby
          </Text>
          {refreshing ? (
            <View style={$refreshing}>
              <ActivityIndicator size="small" color={color.textSecondary} />
            </View>
          ) : (
            <IconButton
              icon={icons.refresh}
              accessibilityLabel="Refresh networks"
              onPress={onRefresh}
              iconSize={18}
            />
          )}
        </View>
        {networks.length === 0 ? (
          <Text variant="subhead" color="textSecondary" style={$emptyText}>
            No Wi-Fi networks found. Refresh, or enter the network name below.
          </Text>
        ) : (
          <ScrollView style={$list} nestedScrollEnabled>
            {networks.map((network) => {
              const isSelected = !manual && selected === network.ssid;
              const signal = signalStrength(network.level);
              return (
                <ListRow
                  key={network.ssid}
                  title={network.ssid}
                  subtitle={`${network.bands
                    .map((band) => band.replace("GHz", " GHz"))
                    .join(" · ")} · ${SECURITY_LABEL[network.security]}`}
                  leading={
                    <Icon
                      name={signal.symbol}
                      color={isSelected ? "accent" : "textSecondary"}
                    />
                  }
                  trailing={
                    <Icon
                      name={
                        network.security === "open"
                          ? {
                              ios: "lock.open",
                              android: "lock_open",
                              web: "lock_open",
                            }
                          : { ios: "lock.fill", android: "lock", web: "lock" }
                      }
                      size={14}
                      color="textTertiary"
                    />
                  }
                  selected={isSelected}
                  onPress={() => {
                    setManual(false);
                    setSelected(network.ssid);
                  }}
                />
              );
            })}
          </ScrollView>
        )}
        <ListRow
          title="Other network…"
          leading={
            <Icon
              name={{ ios: "keyboard", android: "keyboard", web: "keyboard" }}
              color={manual ? "accent" : "textSecondary"}
            />
          }
          selected={manual}
          onPress={() => {
            setManual(true);
          }}
        />
      </Card>

      {manual && (
        <View style={$setupCard}>
          <TextField
            icon={WIFI_ICON}
            placeholder="Network name (SSID)"
            value={manualSsid}
            onChangeText={setManualSsid}
            onFocus={revealInputs}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {reason === "rejected" && (
        <View style={[$setupCard, $rejected]}>
          <Icon name={icons.warning} color="danger" />
          <Text variant="body" style={$flex}>
            The speaker couldn't join{" "}
            <Emphasis>{suggested ?? "the network"}</Emphasis>. The password is
            probably wrong: check it and try again.
          </Text>
        </View>
      )}
      {needsPassword ? (
        <View style={$setupCard}>
          <TextField
            ref={passwordRef}
            icon={icons.lock}
            placeholder={
              security === undefined
                ? "Wi-Fi password (empty if open)"
                : "Wi-Fi password"
            }
            value={password}
            onChangeText={setPassword}
            onFocus={revealInputs}
            onSubmitEditing={submit}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="done"
            trailing={
              <IconButton
                icon={{
                  ios: showPassword ? "eye.slash" : "eye",
                  android: showPassword ? "visibility_off" : "visibility",
                  web: showPassword ? "visibility_off" : "visibility",
                }}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                onPress={() => {
                  setShowPassword((shown) => !shown);
                }}
                iconSize={20}
              />
            }
          />
        </View>
      ) : (
        <Text
          variant="caption"
          color="textTertiary"
          style={[$setupNote, $openNote]}
        >
          {ssid} is an open network: no password needed.
        </Text>
      )}

      {shownProblem !== undefined && (
        <Text variant="subhead" color="danger" style={$message}>
          {shownProblem.message}
        </Text>
      )}
      {security === "wpa3" && shownProblem === undefined && (
        <Text variant="subhead" color="warning" style={$message}>
          This network only offers WPA3. The speaker may not be able to join it.
        </Text>
      )}

      <View style={$setupButtons}>
        <Button
          label="Connect speaker"
          icon={{ ios: "key", android: "vpn_key", web: "vpn_key" }}
          onPress={submit}
          disabled={ssid.trim() === "" || refreshing}
        />
        <View style={$disclaimer}>
          <Icon name={icons.lock} size={12} color="textTertiary" />
          <Text
            variant="caption"
            color="textTertiary"
            style={[$setupNote, $flex]}
          >
            The password is only sent to the speaker over its own network and is
            never stored.
          </Text>
        </View>
      </View>
    </>
  );
}

const $flex: TextStyle = {
  flex: 1,
};

const $rejected: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  padding: space.md,
  borderRadius: radius.md,
  backgroundColor: color.dangerMuted,
};

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: space.xxs,
  overflow: "hidden",
};

const $listHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingLeft: space.screen,
  paddingRight: space.xs,
};

const $refreshing: ViewStyle = {
  width: 40,
  height: 40,
  alignItems: "center",
  justifyContent: "center",
};

const $emptyText: TextStyle = {
  paddingHorizontal: space.screen,
  paddingVertical: space.sm,
};

const $list: ViewStyle = {
  maxHeight: 240,
};

const $openNote: TextStyle = {
  marginBottom: space.lg,
};

const $message: TextStyle = {
  textAlign: "center",
  marginBottom: space.sm,
};

const $disclaimer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: space.xxs,
  paddingHorizontal: space.xl,
};
