import ChevronRight from "@expo/material-symbols/chevron_right.xml";
import {
  Button,
  Column,
  Icon,
  Picker,
  Row,
  Spacer,
  Text,
  type PickerItemValue,
} from "@expo/ui";
import { Slider as ComposeSlider } from "@expo/ui/jetpack-compose";
import { height, weight } from "@expo/ui/jetpack-compose/modifiers";
import { Slider as SwiftUISlider } from "@expo/ui/swift-ui";
import { buttonStyle, textSelection } from "@expo/ui/swift-ui/modifiers";
import { use } from "react";
import { Platform, ToastAndroid } from "react-native";

import { copyText } from "@/lib/clipboard";
import { useSliderDraft } from "@/lib/useSliderDraft";
import { ComposeSliderSlots } from "@/ui/ds/ComposeSliderSlots";
import { sliderDimensions } from "@/ui/ds/Slider.types";
import { color } from "@/ui/tokens";

import type { FormIcon } from "./icons";
import { ContainerHandlesPress } from "./rowPress";

const ios = Platform.OS === "ios";

const secondary = { color: color.textSecondary };
const caption = { color: color.textSecondary, fontSize: 13 };

/**
 * Lays the label out like a native settings row: on iOS a flexible spacer
 * pushes trailing content to the edge; on Android (Compose `Row`) the label
 * takes the remaining width so long text wraps instead of pushing the
 * trailing content out.
 */
const labelModifiers = ios ? undefined : [weight(1)];
const iosSpacer = ios ? <Spacer flexible /> : null;

function Label({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  if (description === undefined) {
    return <Text modifiers={labelModifiers}>{label}</Text>;
  }
  return (
    <Column spacing={2} modifiers={labelModifiers}>
      <Text>{label}</Text>
      <Text textStyle={caption}>{description}</Text>
    </Column>
  );
}

/** Leading icon in a fixed-width column so labels line up across rows. */
function RowIcon({ icon }: { icon: FormIcon | undefined }) {
  return icon ? (
    <Icon
      name={icon}
      size={20}
      color={color.textSecondary}
      style={{ width: 28 }}
    />
  ) : null;
}

/**
 * Read-only row: label (and description) with a trailing value. `copyable`
 * values are selectable on iOS and copied on tap on Android. `stacked` puts the
 * value under the label, wrapping, for values too long to share the row.
 */
export function FormValueRow({
  label,
  description,
  value,
  valueColor = color.textSecondary,
  icon,
  copyable,
  stacked,
}: {
  label: string;
  description?: string;
  value?: string;
  valueColor?: string;
  icon?: FormIcon;
  copyable?: boolean;
  stacked?: boolean;
}) {
  const valueText =
    value !== undefined ? (
      <Text
        textStyle={
          stacked ? { ...caption, color: valueColor } : { color: valueColor }
        }
        numberOfLines={stacked ? undefined : 1}
        modifiers={copyable && ios ? [textSelection(true)] : undefined}
      >
        {value}
      </Text>
    ) : null;

  return (
    <Row
      alignment="center"
      spacing={12}
      onPress={
        copyable && !ios && value !== undefined
          ? () => {
              void copyText(value, `Copied ${label}`).catch(() => {
                ToastAndroid.show("Could not copy", ToastAndroid.SHORT);
              });
            }
          : undefined
      }
    >
      <RowIcon icon={icon} />
      {stacked ? (
        <Column spacing={2} modifiers={labelModifiers}>
          <Text>{label}</Text>
          {valueText}
        </Column>
      ) : (
        <>
          <Label label={label} description={description} />
          {iosSpacer}
          {valueText}
        </>
      )}
    </Row>
  );
}

/** Tappable row that opens something (screen, website): label, value, chevron. */
export function FormLinkRow({
  label,
  description,
  value,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  description?: string;
  value?: string;
  icon?: FormIcon;
  disabled?: boolean;
  onPress: () => void;
}) {
  // Android's `FormSection` makes the whole list item clickable instead.
  const containerHandlesPress = use(ContainerHandlesPress);
  return (
    <Row
      alignment="center"
      spacing={12}
      onPress={containerHandlesPress ? undefined : onPress}
      disabled={disabled}
    >
      <RowIcon icon={icon} />
      <Label label={label} description={description} />
      {iosSpacer}
      {value !== undefined ? <Text textStyle={secondary}>{value}</Text> : null}
      <Icon
        name={{ ios: "chevron.right", android: ChevronRight }}
        size={14}
        color={color.textTertiary}
      />
    </Row>
  );
}

/**
 * Action row: a text button (Android) or the Form's default tinted button
 * (iOS; the universal `text` variant would render it in the label color).
 */
export function FormButtonRow({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      variant="text"
      disabled={disabled}
      onPress={onPress}
      modifiers={ios ? [buttonStyle("automatic")] : undefined}
    />
  );
}

/**
 * Native menu picker with its label: trailing on iOS (SwiftUI menu button);
 * below the label on Android, where the Material dropdown field is full width.
 */
export function FormPickerRow<Value extends PickerItemValue>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  disabled?: boolean;
  onChange: (value: Value) => void;
}) {
  const picker = (
    <Picker selectedValue={value} onValueChange={onChange} enabled={!disabled}>
      {options.map((option) => (
        <Picker.Item
          key={String(option.value)}
          label={option.label}
          value={option.value}
        />
      ))}
    </Picker>
  );

  if (!ios) {
    return (
      <Column spacing={8}>
        <Text>{label}</Text>
        {picker}
      </Column>
    );
  }
  return (
    <Row alignment="center" spacing={12}>
      <Label label={label} />
      {iosSpacer}
      {picker}
    </Row>
  );
}

/**
 * Inline slider with its label and current value. Dragging updates the value
 * shown immediately; `onCommit` fires when the drag ends. On Android it uses
 * the app's thin track and round thumb, as on the speaker card.
 */
export function FormSliderRow({
  label,
  value,
  min,
  max,
  step,
  saving,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  saving?: boolean;
  onCommit: (value: number) => void;
}) {
  const draft = useSliderDraft(value, onCommit);
  const snap = (next: number) => Math.round((next - min) / step) * step + min;

  return (
    <Column spacing={4}>
      <Row alignment="center" spacing={12}>
        <Label label={label} />
        {iosSpacer}
        <Text textStyle={secondary}>
          {saving ? "Saving…" : String(draft.value)}
        </Text>
      </Row>
      {ios ? (
        <SwiftUISlider
          value={draft.value}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => {
            draft.swiftUI.onValueChange(snap(next));
          }}
          onEditingChanged={(isEditing) => {
            draft.swiftUI.onEditingChanged(isEditing);
          }}
        />
      ) : (
        <ComposeSlider
          value={draft.value}
          min={min}
          max={max}
          // Compose counts the stops between the ends, not the increment.
          steps={Math.max(0, Math.round((max - min) / step) - 1)}
          onValueChange={(next) => {
            draft.onValueChange(snap(next));
          }}
          onValueChangeFinished={() => {
            draft.onSlidingComplete();
          }}
          // Material pads the slider to a 48dp touch target, which leaves a gap
          // under the thumb; fit it to the thumb so the row looks balanced.
          modifiers={[height(sliderDimensions.regular.thumb + 8)]}
        >
          <ComposeSliderSlots
            value={draft.value}
            min={min}
            max={max}
            tint="accent"
            size="regular"
          />
        </ComposeSlider>
      )}
    </Column>
  );
}

/** Secondary text for `FieldGroup.SectionFooter`. */
export function FormFooterText({
  children,
  color: textColor = color.textSecondary,
}: {
  children: string;
  color?: string;
}) {
  return <Text textStyle={{ ...caption, color: textColor }}>{children}</Text>;
}
