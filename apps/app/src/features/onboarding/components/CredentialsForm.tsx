import { SymbolView } from "expo-symbols";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { COLORS } from "@/ui/theme";

import { validateCredentials } from "../session/credentials";
import type { HomeNetwork, Security } from "../session/types";
import {
  $setupButtons,
  $setupCard,
  $setupEmphasis,
  $setupNote,
  SetupButton,
  SetupHeader,
  SetupScrollContext,
  signalStrength,
} from "./SetupLayout";

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
  const [focused, setFocused] = useState<"ssid" | "password" | null>(null);
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
          <Text style={$listHeaderText}>Networks nearby</Text>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={$refreshButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Refresh networks"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <SymbolView
                name={{
                  ios: "arrow.clockwise",
                  android: "refresh",
                  web: "refresh",
                }}
                tintColor={COLORS.primary}
                size={18}
              />
            )}
          </TouchableOpacity>
        </View>
        {networks.length === 0 ? (
          <Text style={$emptyText}>
            No Wi-Fi networks found. Refresh, or enter the network name below.
          </Text>
        ) : (
          <ScrollView style={$list} nestedScrollEnabled>
            {networks.map((network, index) => {
              const isSelected = !manual && selected === network.ssid;
              const signal = signalStrength(network.level);
              return (
                <View key={network.ssid}>
                  {index > 0 && <View style={$divider} />}
                  <TouchableOpacity
                    style={[$networkRow, isSelected && $networkRowSelected]}
                    onPress={() => {
                      setManual(false);
                      setSelected(network.ssid);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <SymbolView
                      name={signal.symbol}
                      tintColor={isSelected ? COLORS.primary : COLORS.text}
                      size={20}
                    />
                    <View style={$networkText}>
                      <Text
                        style={[
                          $networkName,
                          isSelected && $networkNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {network.ssid}
                      </Text>
                      <Text style={$networkMeta}>
                        {network.bands
                          .map((band) => band.replace("GHz", " GHz"))
                          .join(" · ")}
                        {" · "}
                        {SECURITY_LABEL[network.security]}
                      </Text>
                    </View>
                    <SymbolView
                      name={
                        network.security === "open"
                          ? {
                              ios: "lock.open",
                              android: "lock_open",
                              web: "lock_open",
                            }
                          : { ios: "lock.fill", android: "lock", web: "lock" }
                      }
                      tintColor={COLORS.textMuted}
                      size={14}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
        <View style={$divider} />
        <TouchableOpacity
          style={[$networkRow, manual && $networkRowSelected]}
          onPress={() => {
            setManual(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="radio"
          accessibilityState={{ selected: manual }}
        >
          <SymbolView
            name={{ ios: "keyboard", android: "keyboard", web: "keyboard" }}
            tintColor={manual ? COLORS.primary : COLORS.text}
            size={20}
          />
          <Text style={[$networkName, manual && $networkNameSelected]}>
            Other network…
          </Text>
        </TouchableOpacity>
      </Card>

      {manual && (
        <Card style={[$setupCard, $inputCard]}>
          <View style={[$inputRow, focused === "ssid" && $inputFocused]}>
            <SymbolView
              name={{ ios: "wifi", android: "wifi", web: "wifi" }}
              tintColor={COLORS.primary}
              size={20}
            />
            <TextInput
              style={$input}
              placeholder="Network name (SSID)"
              placeholderTextColor={COLORS.textMuted}
              value={manualSsid}
              onChangeText={setManualSsid}
              onFocus={() => {
                setFocused("ssid");
                revealInputs();
              }}
              onBlur={() => {
                setFocused(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </Card>
      )}

      {reason === "rejected" && (
        <Card style={[$setupCard, $rejectedCard]}>
          <SymbolView
            name={{
              ios: "exclamationmark.triangle",
              android: "warning",
              web: "warning",
            }}
            tintColor={COLORS.error}
            size={20}
          />
          <Text style={$rejectedText}>
            The speaker couldn't join{" "}
            <Text style={$setupEmphasis}>{suggested ?? "the network"}</Text>.
            The password is probably wrong: check it and try again.
          </Text>
        </Card>
      )}
      {needsPassword ? (
        <Card style={[$setupCard, $inputCard]}>
          <View style={[$inputRow, focused === "password" && $inputFocused]}>
            <SymbolView
              name={{ ios: "lock", android: "lock", web: "lock" }}
              tintColor={COLORS.primary}
              size={20}
            />
            <TextInput
              ref={passwordRef}
              style={$input}
              placeholder={
                security === undefined
                  ? "Wi-Fi password (empty if open)"
                  : "Wi-Fi password"
              }
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              onFocus={() => {
                setFocused("password");
                revealInputs();
              }}
              onBlur={() => {
                setFocused(null);
              }}
              onSubmitEditing={submit}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => {
                setShowPassword((shown) => !shown);
              }}
              style={$eyeButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
            >
              <SymbolView
                name={{
                  ios: showPassword ? "eye.slash" : "eye",
                  android: showPassword ? "visibility_off" : "visibility",
                  web: showPassword ? "visibility_off" : "visibility",
                }}
                tintColor={COLORS.textMuted}
                size={20}
              />
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        <Text style={[$setupNote, $openNote]}>
          {ssid} is an open network: no password needed.
        </Text>
      )}

      {shownProblem !== undefined && (
        <Text style={$problem}>{shownProblem.message}</Text>
      )}
      {security === "wpa3" && shownProblem === undefined && (
        <Text style={$warning}>
          This network only offers WPA3. The speaker may not be able to join it.
        </Text>
      )}

      <View style={$setupButtons}>
        <SetupButton
          label="Connect speaker"
          icon={{ ios: "key", android: "vpn_key", web: "vpn_key" }}
          onPress={submit}
          disabled={ssid.trim() === "" || refreshing}
        />
        <View style={$disclaimer}>
          <SymbolView
            name={{ ios: "lock", android: "lock", web: "lock" }}
            tintColor={COLORS.textMuted}
            size={12}
          />
          <Text style={[$setupNote, $flex]}>
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

const $rejectedCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
  borderWidth: 1,
  borderColor: COLORS.errorDark,
  backgroundColor: COLORS.errorDarker,
};

const $rejectedText: TextStyle = {
  flex: 1,
  color: COLORS.errorLight,
  fontSize: 14,
  lineHeight: 20,
};

const $listCard: ViewStyle = {
  padding: 0,
  paddingVertical: 4,
};

const $listHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 4,
};

const $listHeaderText: TextStyle = {
  fontSize: 12,
  fontWeight: "700",
  color: COLORS.textMuted,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const $refreshButton: ViewStyle = {
  padding: 6,
};

const $emptyText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 13,
  lineHeight: 18,
  paddingHorizontal: 16,
  paddingVertical: 12,
};

const $list: ViewStyle = {
  maxHeight: 240,
};

const $networkRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
};

const $networkRowSelected: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
};

const $networkText: ViewStyle = {
  flex: 1,
};

const $networkName: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $networkNameSelected: TextStyle = {
  color: COLORS.primary,
};

const $networkMeta: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  marginTop: 2,
};

const $divider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  marginLeft: 48,
};

const $inputCard: ViewStyle = {
  padding: 0,
};

const $inputRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  height: 56,
  gap: 12,
};

const $inputFocused: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  borderRadius: 16,
};

const $input: TextStyle = {
  flex: 1,
  fontSize: 16,
  color: COLORS.text,
  height: "100%",
};

const $eyeButton: ViewStyle = {
  padding: 4,
};

const $openNote: TextStyle = {
  marginBottom: 20,
};

const $problem: TextStyle = {
  color: COLORS.errorLight,
  fontSize: 13,
  textAlign: "center",
  marginBottom: 12,
};

const $warning: TextStyle = {
  color: COLORS.warning,
  fontSize: 13,
  textAlign: "center",
  marginBottom: 12,
};

const $disclaimer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  paddingHorizontal: 24,
};
