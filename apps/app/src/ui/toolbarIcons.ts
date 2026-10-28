import AddIcon from "@expo/material-symbols/add.xml";
import CopyIcon from "@expo/material-symbols/content_copy.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import MoreIcon from "@expo/material-symbols/more_vert.xml";
import ShareIcon from "@expo/material-symbols/share.xml";
import { Platform } from "react-native";

const ios = Platform.OS === "ios";

/**
 * Icons for `Stack.Toolbar` items: SF Symbol names on iOS, Material Symbol
 * vector drawables on Android (the native Android toolbar only renders image
 * sources).
 */
export const toolbarIcons = {
  add: ios ? "plus" : AddIcon,
  copy: ios ? "doc.on.doc" : CopyIcon,
  delete: ios ? "trash" : DeleteIcon,
  more: ios ? "ellipsis" : MoreIcon,
  share: ios ? "square.and.arrow.up" : ShareIcon,
} as const;
