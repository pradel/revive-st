import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import WifiManager from "react-native-wifi-reborn";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { isSpeakerHotspot } from "@/features/onboarding/utils/networkHelpers";
import { COLORS } from "@/ui/theme";

export default function NetworkPickerScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [networks, setNetworks] = useState<
    { ssid: string; bssid: string; level: number }[]
  >([]);
  const [selectedSSID, setSelectedSSID] = useState("");
  const [password, setPassword] = useState("");
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [loading, setLoading] = useState(true);
  const [manualEntry, setManualEntry] = useState(false);
  const [inputFocused, setInputFocused] = useState<"ssid" | "password" | null>(
    null,
  );

  const s = state as {
    ssid?: string;
    speakerIP?: string;
    homeSSID?: string;
    step: string;
  };

  useEffect(() => {
    if (state.step === "SENDING_CREDENTIALS") {
      router.replace("/onboarding/progress" as any);
    }
  }, [state.step, router]);

  useEffect(() => {
    void (async () => {
      try {
        let list: unknown;
        try {
          list = await WifiManager.reScanAndLoadWifiList();
        } catch {
          // ignore active scan error, try cached
        }

        if (!Array.isArray(list)) {
          try {
            list = await WifiManager.loadWifiList();
          } catch {
            // ignore load cached error
          }
        }

        if (Array.isArray(list)) {
          const typedList = list as {
            SSID: string;
            BSSID: string;
            level: number;
            frequency?: number;
          }[];
          const filtered = typedList
            .filter((n): n is typeof n => {
              const is24GHz =
                n.frequency === undefined ||
                (n.frequency >= 2400 && n.frequency < 2500);
              return Boolean(n.SSID) && !isSpeakerHotspot(n.SSID) && is24GHz;
            })
            .map((n) => ({ ssid: n.SSID, bssid: n.BSSID, level: n.level }))
            .sort((a, b) => a.ssid.localeCompare(b.ssid) || b.level - a.level);
          setNetworks(filtered);
        }
      } catch {
        // show empty list, manual entry still possible
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (s.homeSSID) {
      setSelectedSSID(s.homeSSID);
    }
  }, [s.homeSSID]);

  const handleSubmit = useCallback(() => {
    if (!selectedSSID || !password) {
      return;
    }

    dispatch({
      type: "NETWORK_SELECTED",
      homeSSID: selectedSSID,
      homePassword: password,
    });
  }, [selectedSSID, password, dispatch]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={$container}
    >
      <ScrollView
        contentContainerStyle={$scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={$content}>
          {/* Visual Header/Icon */}
          <View style={$iconContainer}>
            <SymbolView
              name={{
                ios: "lock.shield",
                android: "security",
                web: "security",
              }}
              tintColor={COLORS.primary}
              size={48}
            />
          </View>

          {/* Card */}
          <View style={$card}>
            <View style={$badge}>
              <Text style={$badgeText}>SETUP WIZARD</Text>
            </View>
            <Text style={$cardTitle}>Connect to Wi-Fi</Text>
            <Text style={$cardDescription}>
              Select your 2.4 GHz home Wi-Fi network and enter the password.
              SoundTouch speakers do not support 5 GHz network setup profiles.
            </Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={$spinner}
              />
            ) : !manualEntry && networks.length > 0 ? (
              <ScrollView
                style={$list}
                contentContainerStyle={{ gap: 6 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {networks.map((item) => {
                  const isSelected = selectedSSID === item.ssid;
                  const dbm = item.level;
                  const bars =
                    dbm >= -50
                      ? 4
                      : dbm >= -60
                        ? 3
                        : dbm >= -70
                          ? 2
                          : dbm >= -80
                            ? 1
                            : 0;
                  return (
                    <TouchableOpacity
                      key={`${item.ssid}_${item.bssid}`}
                      style={[$networkItem, isSelected && $networkItemSelected]}
                      onPress={() => {
                        setSelectedSSID(item.ssid);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={$networkRow}>
                        <Text
                          style={[
                            $networkText,
                            isSelected && $networkTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.ssid}
                        </Text>
                        <Text
                          style={[
                            $signalText,
                            isSelected && $networkTextSelected,
                          ]}
                        >
                          {"●".repeat(bars)}
                          {"○".repeat(Math.max(0, 4 - bars))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {(manualEntry || (!loading && networks.length === 0)) && (
              <TextInput
                style={[$input, inputFocused === "ssid" ? $inputFocused : null]}
                placeholder="Network name (SSID)"
                placeholderTextColor={COLORS.textMuted}
                value={selectedSSID}
                onChangeText={setSelectedSSID}
                onFocus={() => {
                  setInputFocused("ssid");
                }}
                onBlur={() => {
                  setInputFocused(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            {!loading && !manualEntry && networks.length > 0 && (
              <>
                <Text style={$filterNote}>
                  Only showing 2.4 GHz networks. If yours is missing, make sure
                  it is not a 5 GHz-only network.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setManualEntry(true);
                  }}
                  style={{ marginBottom: 12 }}
                  activeOpacity={0.7}
                >
                  <Text style={$manualLink}>Enter SSID manually</Text>
                </TouchableOpacity>
              </>
            )}

            <View
              style={[
                $passwordContainer,
                inputFocused === "password" ? $containerFocused : null,
              ]}
            >
              <TextInput
                style={$passwordInput}
                placeholder="Wi-Fi Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => {
                  setInputFocused("password");
                }}
                onBlur={() => {
                  setInputFocused(null);
                }}
                secureTextEntry={secureTextEntry}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => {
                  setSecureTextEntry((prev) => !prev);
                }}
                activeOpacity={0.7}
                style={$eyeButton}
              >
                <SymbolView
                  name={{
                    ios: secureTextEntry ? "eye" : "eye.slash",
                    android: secureTextEntry ? "visibility" : "visibility_off",
                    web: secureTextEntry ? "visibility" : "visibility_off",
                  }}
                  tintColor={COLORS.textMuted}
                  size={20}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={$buttonContainer}>
            <TouchableOpacity
              style={[
                $primaryButton,
                (!selectedSSID || !password) && $buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedSSID || !password}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "key.fill",
                  android: "vpn_key",
                  web: "vpn_key",
                }}
                tintColor={COLORS.background}
                size={18}
              />
              <Text style={$primaryButtonText}>Connect Speaker</Text>
            </TouchableOpacity>

            <Text style={$note}>
              Your credentials are only transmitted locally to the speaker and
              are never stored.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 24,
  paddingTop: 40,
};

const $iconContainer: ViewStyle = {
  width: 96,
  height: 96,
  borderRadius: 48,
  backgroundColor: COLORS.primaryTransparent,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 32,
  borderWidth: 1,
  borderColor: COLORS.primary,
};

const $card: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 20,
  padding: 24,
  borderWidth: 1,
  borderColor: COLORS.border,
  width: "100%",
  alignItems: "center",
  marginBottom: 32,
};

const $badge: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: COLORS.primary,
  marginBottom: 16,
};

const $badgeText: TextStyle = {
  fontSize: 10,
  fontWeight: "800",
  color: COLORS.primary,
  letterSpacing: 0.8,
};

const $cardTitle: TextStyle = {
  fontSize: 22,
  fontWeight: "700",
  color: COLORS.text,
  letterSpacing: -0.3,
  marginBottom: 10,
  textAlign: "center",
};

const $cardDescription: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 20,
};

const $spinner: ViewStyle = {
  marginTop: 16,
};

const $list: ViewStyle = {
  width: "100%",
  maxHeight: 180,
  marginBottom: 16,
};

const $networkItem: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: COLORS.background,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $networkItemSelected: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  borderColor: COLORS.primary,
};

const $networkRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
};

const $networkText: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
  flex: 1,
};

const $networkTextSelected: TextStyle = {
  color: COLORS.primary,
};

const $signalText: TextStyle = {
  fontSize: 11,
  color: COLORS.textMuted,
  letterSpacing: 1,
  marginLeft: 8,
};

const $input: TextStyle = {
  backgroundColor: COLORS.background,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: COLORS.text,
  width: "100%",
  marginBottom: 12,
};

const $inputFocused: TextStyle = {
  borderColor: COLORS.primary,
};

const $containerFocused: ViewStyle = {
  borderColor: COLORS.primary,
};

const $manualLink: TextStyle = {
  color: COLORS.primary,
  fontSize: 14,
  fontWeight: "600",
  textAlign: "center",
};

const $buttonContainer: ViewStyle = {
  width: "100%",
  gap: 12,
};

const $primaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.primary,
  height: 52,
  borderRadius: 16,
  width: "100%",
};

const $buttonDisabled: ViewStyle = {
  opacity: 0.5,
};

const $primaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.background,
  fontWeight: "600",
};

const $note: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 16,
};

const $scrollContent: ViewStyle = {
  flexGrow: 1,
};

const $passwordContainer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: COLORS.background,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  paddingRight: 14,
  width: "100%",
  marginBottom: 12,
};

const $passwordInput: TextStyle = {
  flex: 1,
  padding: 14,
  fontSize: 16,
  color: COLORS.text,
};

const $eyeButton: ViewStyle = {
  padding: 4,
};

const $filterNote: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 16,
  marginTop: 4,
  marginBottom: 12,
  paddingHorizontal: 8,
};
