import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { probeSpeakerIP } from "@/features/onboarding/utils/networkHelpers";

export default function ManualIPScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [ip, setIP] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.step === "PROVISIONING_COMPLETE") {
      router.replace("/onboarding/success" as any);
    } else if (state.step === "SCANNING_FOR_HOTSPOT") {
      router.back();
    }
  }, [state.step, router]);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setError("");
    try {
      const alive = await probeSpeakerIP(ip);
      if (alive) {
        dispatch({
          type: "MANUAL_IP_VALIDATED",
          ip,
          name: "Speaker",
        });
      } else {
        setError("No SoundTouch device found at this address.");
      }
    } catch {
      setError("Could not connect. Check the IP and try again.");
    }
    setValidating(false);
  }, [ip, dispatch]);

  const handleCancel = useCallback(() => {
    dispatch({ type: "MANUAL_IP_CANCELLED" });
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Speaker IP</Text>
      <Text style={styles.description}>
        Enter the IP address of your speaker on your home network.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="192.168.1.x"
        value={ip}
        onChangeText={setIP}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {validating ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={handleCancel}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !ip && styles.buttonDisabled]}
            onPress={handleValidate}
            disabled={!ip}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    width: "100%",
    textAlign: "center",
    marginBottom: 12,
    fontVariant: ["tabular-nums"],
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  secondaryButtonText: {
    fontSize: 16,
    color: "#555",
  },
});
