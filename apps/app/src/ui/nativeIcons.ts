import AddIcon from "@expo/material-symbols/add.xml";
import BluetoothIcon from "@expo/material-symbols/bluetooth.xml";
import CableIcon from "@expo/material-symbols/cable.xml";
import CastIcon from "@expo/material-symbols/cast.xml";
import CopyIcon from "@expo/material-symbols/content_copy.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import InputIcon from "@expo/material-symbols/input.xml";
import MoreIcon from "@expo/material-symbols/more_vert.xml";
import PlayIcon from "@expo/material-symbols/play_arrow.xml";
import PowerIcon from "@expo/material-symbols/power_settings_new.xml";
import RefreshIcon from "@expo/material-symbols/refresh.xml";
import SaveIcon from "@expo/material-symbols/save.xml";
import SettingsIcon from "@expo/material-symbols/settings.xml";
import ShareIcon from "@expo/material-symbols/share.xml";
import SpeakerIcon from "@expo/material-symbols/speaker.xml";
import StarIcon from "@expo/material-symbols/star.xml";
import { Platform } from "react-native";

const ios = Platform.OS === "ios";

/**
 * Icons for native toolbars and menus: SF Symbol names on iOS, Material
 * Symbol vector drawables on Android (native Android toolbars and menus only
 * render image sources).
 */
export const nativeIcons = {
  add: ios ? "plus" : AddIcon,
  bluetooth: ios ? "wave.3.right" : BluetoothIcon,
  cast: ios ? "airplayaudio" : CastIcon,
  copy: ios ? "doc.on.doc" : CopyIcon,
  delete: ios ? "trash" : DeleteIcon,
  more: ios ? "ellipsis" : MoreIcon,
  nowPlaying: ios ? "play.circle" : SpeakerIcon,
  play: ios ? "play.fill" : PlayIcon,
  power: ios ? "power" : PowerIcon,
  save: ios ? "square.and.arrow.down" : SaveIcon,
  refresh: ios ? "arrow.clockwise" : RefreshIcon,
  settings: ios ? "gearshape" : SettingsIcon,
  share: ios ? "square.and.arrow.up" : ShareIcon,
  source: ios ? "rectangle.connected.to.line.below" : InputIcon,
  aux: ios ? "cable.connector" : CableIcon,
  star: ios ? "star" : StarIcon,
  starSlash: ios ? "star.slash" : StarIcon,
} as const;
