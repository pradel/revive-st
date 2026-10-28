import { createContext } from "react";

/**
 * True when the section item around a row handles its press (Android
 * `FormSection` makes the whole list item clickable), so the row mustn't
 * also handle it.
 */
export const ContainerHandlesPress = createContext(false);
