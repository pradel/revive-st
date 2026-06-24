import { Button, Host } from "@expo/ui";
import { openWifiSettings } from "expo-bose-wifi";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useCallback } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { PulseRing } from "@/ui/PulseRing";
import { COLORS } from "@/ui/theme";

export default function ScanningScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  const handleOpenWifiSettings = useCallback(() => {
    void openWifiSettings();
  }, []);

  useEffect(() => {
    if (state.step === "CONNECTING_TO_HOTSPOT") {
      router.replace("/onboarding/connecting" as any);
    } else if (state.step === "WIFI_DISABLED") {
      router.replace("/onboarding/wifi-enable" as any);
    }
  }, [state.step, router]);

  const isNotFound = state.step === "HOTSPOT_NOT_FOUND";
  const isScanning = state.step === "SCANNING_FOR_HOTSPOT";
  const isSelecting = state.step === "SELECTING_SPEAKER";
  const speakers = state.step === "SELECTING_SPEAKER" ? state.speakers : [];

  return (
    <View style={$container}>
      <Stack.Screen
        options={{
          title: "Setup Speaker",
          headerShown: false,
        }}
      />

      <View style={$content}>
        {/* Visual Header/Icon */}
        <View style={[$iconContainer, isNotFound && $iconContainerError]}>
          {isScanning && (
            <>
              <PulseRing delay={0} size={96} />
              <PulseRing delay={800} size={96} />
              <PulseRing delay={1600} size={96} />
            </>
          )}
          <SymbolView
            name={{
              ios: isNotFound
                ? "wifi.slash"
                : isSelecting
                  ? "hifispeaker"
                  : "wifi",
              android: isNotFound
                ? "wifi_off"
                : isSelecting
                  ? "speaker"
                  : "wifi",
              web: isNotFound ? "wifi_off" : isSelecting ? "speaker" : "wifi",
            }}
            tintColor={isNotFound ? COLORS.error : COLORS.primary}
            size={48}
          />
        </View>

        {(isNotFound || isSelecting) && (
          <View style={$headerTextContainer}>
            {isSelecting && (
              <View style={[$badge, { marginBottom: 24 }]}>
                <Text style={$badgeText}>SETUP WIZARD</Text>
              </View>
            )}

            <Text style={[$cardTitle, { marginBottom: 4, color: COLORS.text }]}>
              {isNotFound ? "No Speaker Detected" : "Select Speaker"}
            </Text>

            <Text style={[$cardDescription, { marginBottom: 20 }]}>
              {isNotFound
                ? "Let's get your speaker connected."
                : `We found the following Bose speaker${speakers.length === 1 ? "" : "s"} in setup mode nearby. Select the one you want to configure.`}
            </Text>

            {isNotFound && (
              <View style={[$badge, { marginBottom: 24 }]}>
                <Text style={$badgeText}>SETUP WIZARD</Text>
              </View>
            )}
          </View>
        )}

        {isNotFound && (
          <Card
            style={[
              $card,
              { padding: 0, overflow: "hidden", marginBottom: 32 },
            ]}
          >
            <View style={$stepsContainer}>
              {/* Step 1 */}
              <View style={$stepRow}>
                <View style={$stepNumberBadge}>
                  <Text style={$stepNumberText}>1</Text>
                </View>
                <View style={$stepTextContent}>
                  <Text style={$stepTitleText}>Activate Setup Mode</Text>
                  <Text style={$stepDescriptionText}>
                    Press and hold the{" "}
                    <Text style={{ fontWeight: "700", color: COLORS.text }}>
                      2
                    </Text>{" "}
                    and{" "}
                    <Text style={{ fontWeight: "700", color: COLORS.text }}>
                      Volume Down (-)
                    </Text>{" "}
                    buttons on the speaker for 5 seconds until the Wi-Fi light
                    is{" "}
                    <Text style={{ color: COLORS.warning, fontWeight: "700" }}>
                      solid amber
                    </Text>
                    .
                  </Text>
                </View>
              </View>

              <View style={$stepDivider} />

              {/* Step 2 */}
              <View style={$stepRow}>
                <View style={$stepNumberBadge}>
                  <Text style={$stepNumberText}>2</Text>
                </View>
                <View style={$stepTextContent}>
                  <Text style={$stepTitleText}>Move Phone Closer</Text>
                  <Text style={$stepDescriptionText}>
                    Ensure your phone is within 10 feet of the speaker for a
                    strong signal.
                  </Text>
                </View>
              </View>

              <View style={$stepDivider} />

              {/* Step 3 */}
              <View style={$stepRow}>
                <View style={$stepNumberBadge}>
                  <Text style={$stepNumberText}>3</Text>
                </View>
                <View style={$stepTextContent}>
                  <Text style={$stepTitleText}>Verify Phone Settings</Text>
                  <Text style={$stepDescriptionText}>
                    Make sure your phone's Wi-Fi is enabled and Location
                    services are turned on.
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {isScanning && (
          <Card style={$card}>
            <View style={$badge}>
              <Text style={$badgeText}>SETUP WIZARD</Text>
            </View>

            <Text style={$cardTitle}>Searching for Speaker</Text>

            <View style={$dotsRow}>
              <View style={[$dot, $dotActive]} />
              <View style={$dot} />
              <View style={$dot} />
              <View style={$dot} />
              <View style={$dot} />
            </View>

            <Text style={$cardDescription}>
              Looking for your Bose SoundTouch speaker's setup network. Make
              sure your speaker's Wi-Fi indicator is{" "}
              <Text style={{ color: COLORS.warning, fontWeight: "700" }}>
                solid amber
              </Text>
              .
            </Text>
          </Card>
        )}

        {isSelecting && (
          <View style={$listContainer}>
            {speakers.map((item) => (
              <Card
                key={item.bssid}
                style={[
                  $card,
                  { padding: 16, marginBottom: 12, width: "100%" },
                ]}
              >
                <TouchableOpacity
                  style={[$speakerRow, { width: "100%" }]}
                  onPress={() => {
                    dispatch({
                      type: "HOTSPOT_FOUND",
                      ssid: item.ssid,
                      bssid: item.bssid,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={$speakerIconSmall}>
                    <SymbolView
                      name={{
                        ios: "hifispeaker",
                        android: "speaker",
                        web: "speaker",
                      }}
                      tintColor={COLORS.primary}
                      size={20}
                    />
                  </View>
                  <View style={$speakerTextCol}>
                    <Text style={$speakerText} numberOfLines={1}>
                      {item.ssid}
                    </Text>
                    <Text style={$speakerSubtitle} numberOfLines={1}>
                      {item.ssid.includes("ST 10")
                        ? "SoundTouch 10"
                        : "SoundTouch Speaker"}
                    </Text>
                  </View>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    tintColor={COLORS.primary}
                    size={16}
                  />
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {(isNotFound || isSelecting) && (
          <View style={$buttonContainer}>
            {isSelecting ? (
              <Host style={{ width: "100%", height: 52 }}>
                <Button
                  variant="text"
                  label="Rescan"
                  onPress={() => {
                    dispatch({ type: "RETRY" });
                  }}
                />
              </Host>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                style={$primaryButton}
                onPress={() => {
                  dispatch({ type: "RETRY" });
                }}
              >
                <SymbolView
                  name={{
                    ios: "arrow.clockwise",
                    android: "refresh",
                    web: "refresh",
                  }}
                  tintColor={COLORS.background}
                  size={18}
                />
                <Text style={$primaryButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}

            {isNotFound && (
              <Card
                style={$secondaryButton}
                render={
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      height: "100%",
                      width: "100%",
                    }}
                    onPress={handleOpenWifiSettings}
                  />
                }
              >
                <SymbolView
                  name={{
                    ios: "gearshape",
                    android: "settings",
                    web: "settings",
                  }}
                  tintColor={COLORS.textSecondary}
                  size={18}
                />
                <Text style={$secondaryButtonText}>Open Wi-Fi Settings</Text>
              </Card>
            )}
          </View>
        )}
      </View>
    </View>
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

const $iconContainerError: ViewStyle = {
  backgroundColor: `${COLORS.errorLight}10`,
  borderColor: COLORS.error,
};

const $headerTextContainer: ViewStyle = {
  alignItems: "center",
  width: "100%",
};

const $card: ViewStyle = {
  borderRadius: 20,
  padding: 24,
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

const $dotsRow: ViewStyle = {
  flexDirection: "row",
  gap: 8,
  marginBottom: 20,
  justifyContent: "center",
};

const $dot: ViewStyle = {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: COLORS.border,
};

const $dotActive: ViewStyle = {
  backgroundColor: COLORS.primary,
};

const $cardDescription: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 20,
};

const $buttonContainer: ViewStyle = {
  width: "100%",
  gap: 12,
  marginTop: 16,
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

const $primaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.background,
  fontWeight: "600",
};

const $secondaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 52,
  width: "100%",
  padding: 0,
};

const $secondaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.textSecondary,
  fontWeight: "600",
};

const $listContainer: ViewStyle = {
  width: "100%",
  gap: 12,
  marginTop: 12,
  marginBottom: 24,
};

const $speakerRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
};

const $speakerIconSmall: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  backgroundColor: COLORS.background,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 16,
};

const $speakerTextCol: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  marginRight: 16,
};

const $speakerText: TextStyle = {
  fontSize: 16,
  color: COLORS.text,
  fontWeight: "600",
  marginBottom: 2,
};

const $speakerSubtitle: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
};

const $stepsContainer: ViewStyle = {
  width: "100%",
};

const $stepRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 16,
  width: "100%",
  paddingHorizontal: 20,
  paddingVertical: 20,
};

const $stepDivider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  width: "100%",
  opacity: 0.5,
};

const $stepNumberBadge: ViewStyle = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: COLORS.primaryTransparent,
  borderWidth: 1,
  borderColor: COLORS.primary,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 0,
};

const $stepNumberText: TextStyle = {
  fontSize: 13,
  fontWeight: "700",
  color: COLORS.primary,
};

const $stepTextContent: ViewStyle = {
  flex: 1,
  gap: 4,
};

const $stepTitleText: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: COLORS.text,
};

const $stepDescriptionText: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
  lineHeight: 18,
};
