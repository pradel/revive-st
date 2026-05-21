import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { View, Text, StyleSheet, Pressable } from "react-native";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";

export default function SuccessScreen() {
  const { state } = useWifiProvisioning();
  const router = useRouter();

  const s = state as { speakerName?: string; speakerIP?: string };

  const handleDone = async () => {
    if (s.speakerIP) {
      await SecureStore.setItemAsync("speaker_ip", s.speakerIP);
    }
    if (s.speakerName) {
      await SecureStore.setItemAsync("speaker_name", s.speakerName);
    }
    router.replace("/" as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setup Complete</Text>
      <Text style={styles.speakerName}>{s.speakerName ?? "Speaker"}</Text>
      <Text style={styles.detail}>is ready to use</Text>
      <Pressable style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Got It</Text>
      </Pressable>
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
    marginBottom: 16,
  },
  speakerName: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 4,
  },
  detail: {
    fontSize: 16,
    color: "#888",
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
