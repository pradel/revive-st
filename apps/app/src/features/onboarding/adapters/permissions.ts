import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import type { Permissions } from "../session/ports";

const LOCATION_SOURCE_SETTINGS = "android.settings.LOCATION_SOURCE_SETTINGS";

export const expoPermissions: Permissions = {
  async location(request) {
    const response = request
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    const fine =
      Platform.OS === "android"
        ? response.android?.accuracy === "fine"
        : response.granted;
    return {
      granted: response.granted,
      fine: response.granted && fine,
      canAskAgain: response.canAskAgain,
    };
  },
  async locationServicesEnabled() {
    return Location.hasServicesEnabledAsync();
  },
  async openAppSettings() {
    await Linking.openSettings();
  },
  async openLocationSettings() {
    if (Platform.OS === "android") {
      await Linking.sendIntent(LOCATION_SOURCE_SETTINGS);
    } else {
      await Linking.openSettings();
    }
  },
};
