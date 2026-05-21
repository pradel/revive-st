import { useRouter } from "expo-router";
import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import WifiManager from "react-native-wifi-reborn";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { isSpeakerHotspot } from "@/features/onboarding/utils/networkHelpers";

export default function NetworkPickerScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [networks, setNetworks] = useState<
    Array<{ ssid: string; bssid: string; level: number }>
  >([]);
  const [selectedSSID, setSelectedSSID] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [manualEntry, setManualEntry] = useState(false);

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
        const list = await WifiManager.reScanAndLoadWifiList();
        const filtered = list
          .filter((n): n is typeof n => !!n.SSID && !isSpeakerHotspot(n.SSID))
          .map((n) => ({ ssid: n.SSID, bssid: n.BSSID, level: n.level }))
          .sort((a, b) => a.ssid.localeCompare(b.ssid) || b.level - a.level);
        setNetworks(filtered);
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
    if (!selectedSSID || !password) return;

    dispatch({
      type: "NETWORK_SELECTED",
      homeSSID: selectedSSID,
      homePassword: password,
    });
  }, [selectedSSID, password, dispatch]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Home Network</Text>

      {loading ? (
        <ActivityIndicator size="large" style={styles.spinner} />
      ) : !manualEntry && networks.length > 0 ? (
        <FlatList
          data={networks}
          keyExtractor={(item) => `${item.ssid}_${item.bssid}`}
          style={styles.list}
          renderItem={({ item }) => {
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
              <Pressable
                style={[
                  styles.networkItem,
                  isSelected && styles.networkItemSelected,
                ]}
                onPress={() => setSelectedSSID(item.ssid)}
              >
                <View style={styles.networkRow}>
                  <Text
                    style={[
                      styles.networkText,
                      isSelected && styles.networkTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.ssid}
                  </Text>
                  <Text
                    style={[
                      styles.signalText,
                      isSelected && styles.networkTextSelected,
                    ]}
                  >
                    {"●".repeat(bars)}
                    {"○".repeat(Math.max(0, 4 - bars))}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : null}

      {(manualEntry || networks.length === 0) && (
        <TextInput
          style={styles.input}
          placeholder="Network name (SSID)"
          value={selectedSSID}
          onChangeText={setSelectedSSID}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {!manualEntry && networks.length > 0 && (
        <Pressable onPress={() => setManualEntry(true)}>
          <Text style={styles.manualLink}>Enter SSID manually</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.input}
        placeholder="WiFi password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        style={[
          styles.button,
          (!selectedSSID || !password) && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedSSID || !password}
      >
        <Text style={styles.buttonText}>Connect Speaker</Text>
      </Pressable>

      {!loading && (
        <Text style={styles.note}>
          Your password is only sent to your speaker locally and is never
          stored.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  spinner: {
    marginTop: 40,
  },
  list: {
    maxHeight: 200,
    marginBottom: 16,
  },
  networkItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#f5f5f5",
  },
  networkItemSelected: {
    backgroundColor: "#208AEF",
  },
  networkText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  networkTextSelected: {
    color: "#fff",
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signalText: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  manualLink: {
    color: "#208AEF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#208AEF",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
});
