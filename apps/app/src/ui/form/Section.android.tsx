import { FieldGroup } from "@expo/ui";
import {
  Column,
  ListItem,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { Children, Fragment, isValidElement, type ReactNode } from "react";

import { ContainerHandlesPress } from "./rowPress";
import { FormLinkRow } from "./rows";

type Position = "only" | "leading" | "middle" | "trailing";

function position(index: number, total: number): Position {
  if (total === 1) {
    return "only";
  }
  if (index === 0) {
    return "leading";
  }
  return index === total - 1 ? "trailing" : "middle";
}

const full = 20;
const small = 4;
const radii: Record<Position, Parameters<typeof Shapes.RoundedCorner>[0]> = {
  only: { topStart: full, topEnd: full, bottomStart: full, bottomEnd: full },
  leading: {
    topStart: full,
    topEnd: full,
    bottomStart: small,
    bottomEnd: small,
  },
  middle: {
    topStart: small,
    topEnd: small,
    bottomStart: small,
    bottomEnd: small,
  },
  trailing: {
    topStart: small,
    topEnd: small,
    bottomStart: full,
    bottomEnd: full,
  },
};

function splitChildren(children: ReactNode) {
  let footer: ReactNode;
  const rows: ReactNode[] = [];
  const walk = (node: ReactNode) => {
    // oxlint-disable-next-line react/no-react-children -- section slots, as in `FieldGroup.Section`
    Children.forEach(node, (child) => {
      if (child === null || child === undefined || typeof child === "boolean") {
        return;
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        if (child.type === FieldGroup.SectionFooter) {
          footer = child.props.children;
          return;
        }
        if (child.type === Fragment) {
          walk(child.props.children);
          return;
        }
      }
      rows.push(child);
    });
  };
  walk(children);
  return { footer, rows };
}

/** The press handler of a link row, which then spans the whole list item. */
function itemPress(row: ReactNode) {
  if (!isValidElement(row) || row.type !== FormLinkRow) {
    return undefined;
  }
  const { onPress, disabled } = row.props as {
    onPress: () => void;
    disabled?: boolean;
  };
  return disabled ? undefined : onPress;
}

/**
 * `FieldGroup.Section` with the same Material 3 look, except a link row's
 * whole list item is clickable (the stock section only lets the row's
 * content, inside the item's padding, take the tap).
 */
export function FormSection({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  const colors = useMaterialColors();
  const { footer, rows } = splitChildren(children);

  return (
    <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
      {title ? (
        <Column modifiers={[padding(16, 0, 16, 8)]}>
          <Text
            color={colors.onSurfaceVariant}
            style={{ typography: "titleMedium" }}
          >
            {title}
          </Text>
        </Column>
      ) : null}
      {rows.length > 0 ? (
        <Column
          verticalArrangement={{ spacedBy: 2 }}
          modifiers={[fillMaxWidth()]}
        >
          {rows.map((row, index) => {
            const onPress = itemPress(row);
            return (
              <ListItem
                // oxlint-disable-next-line react/no-array-index-key -- static rows; position is their identity, as in `FieldGroup.Section`
                key={index}
                colors={{ containerColor: colors.surfaceContainer }}
                modifiers={[
                  fillMaxWidth(),
                  // oxlint-disable-next-line react/capitalized-calls -- Compose shape factory, not a component
                  clip(
                    Shapes.RoundedCorner(radii[position(index, rows.length)]),
                  ),
                  ...(onPress ? [clickable(onPress)] : []),
                ]}
              >
                <ListItem.HeadlineContent>
                  <ContainerHandlesPress value={onPress !== undefined}>
                    {row}
                  </ContainerHandlesPress>
                </ListItem.HeadlineContent>
              </ListItem>
            );
          })}
        </Column>
      ) : null}
      {footer ? (
        <Column modifiers={[padding(16, 4, 16, 0)]}>{footer}</Column>
      ) : null}
    </Column>
  );
}
