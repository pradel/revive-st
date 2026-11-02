import { Link, type Href } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type ViewStyle,
} from "react-native";

import { artwork, color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import { icons } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

/** What the mini player shows for one speaker. */
export interface MiniPlayerPage {
  key: string;
  title: string;
  subtitle: string;
  artworkUri?: string | null;
  /** Playing: its dot is tinted with the accent. */
  isPlaying: boolean;
}

export interface MiniPlayerProps {
  /**
   * One per speaker. With several, the bar swipes between them, with a dot
   * per page under it; with one, it's a plain bar.
   */
  pages: readonly MiniPlayerPage[];
  /** The page shown. */
  index: number;
  /** A swipe (or a screen reader action) settled on another page. */
  onIndexChange: (index: number) => void;
  /** The player; on iOS 18+ it zooms open from the artwork. */
  playerHref: Href;
  /** For the page shown; omitted when it has nothing to play or pause. */
  onPlayPause?: () => void;
  /**
   * `floating` draws its own card above the tabs; `docked` is a full-width
   * strip on the tab bar's surface, attached to its top (Android);
   * `accessory` and `inline` sit in the iOS tab bar accessory, which supplies
   * the glass background (`inline` is the compact version beside a minimized
   * tab bar, without the artwork, subtitle or dots).
   */
  variant?: "floating" | "docked" | "accessory" | "inline";
}

type Variant = NonNullable<MiniPlayerProps["variant"]>;

const accessoryArtwork = 32;
const dockedArtwork = 40;

export function MiniPlayer({
  pages,
  index,
  onIndexChange,
  playerHref,
  onPlayPause,
  variant = "floating",
}: MiniPlayerProps) {
  const floating = variant === "floating";
  const docked = variant === "docked";
  const ownsBackground = floating || docked;
  const shown = pages[index];

  const renderPage = (page: MiniPlayerPage, pageIndex: number) => (
    <PageView
      page={page}
      position={
        pages.length > 1
          ? { index: pageIndex, count: pages.length, onIndexChange }
          : undefined
      }
      playerHref={playerHref}
      variant={variant}
    />
  );

  // The open-player area and the play button are siblings so screen readers
  // can focus each one.
  return (
    <View
      style={floating ? $wrapper : docked ? $dockedWrapper : $accessoryWrapper}
    >
      <View style={[$row, floating && $bar, docked && $dockedRow]}>
        {pages.length > 1 ? (
          <Pager
            pages={pages}
            index={index}
            onIndexChange={onIndexChange}
            showDots={variant !== "inline"}
            renderPage={renderPage}
          />
        ) : shown ? (
          <View style={$single}>{renderPage(shown, 0)}</View>
        ) : null}
        {onPlayPause && shown ? (
          <IconButton
            icon={shown.isPlaying ? icons.pause : icons.play}
            accessibilityLabel={shown.isPlaying ? "Pause" : "Play"}
            onPress={onPlayPause}
            tint="textPrimary"
            iconSize={ownsBackground ? 22 : 18}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The pages side by side, one screen-width each. It holds no state of its
 * own beyond its width: the iOS tab bar accessory renders the mini player
 * twice, so the page shown always comes from `index`.
 */
function Pager({
  pages,
  index,
  onIndexChange,
  showDots,
  renderPage,
}: {
  pages: readonly MiniPlayerPage[];
  index: number;
  onIndexChange: (index: number) => void;
  showDots: boolean;
  renderPage: (page: MiniPlayerPage, index: number) => ReactNode;
}) {
  const [width, setWidth] = useState<number>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Only a swipe picks a page. Scrolls the pager makes itself (following
  // `index`, or pages added before the one shown) or a screen reader makes
  // also end in `onMomentumScrollEnd`, so those snap back to `index`.
  const swipingRef = useRef(false);

  // Follows a page picked elsewhere (or this pager's twin); a no-op after a
  // swipe here, which already rests on it.
  useEffect(() => {
    if (width !== undefined) {
      // oxlint-disable-next-line id-length -- React Native's option name
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
    }
  }, [index, width]);

  return (
    <View
      style={$pager}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {width === undefined ? null : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // oxlint-disable-next-line id-length -- React Native's option names
          contentOffset={{ x: index * width, y: 0 }}
          onScrollBeginDrag={() => {
            swipingRef.current = true;
          }}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            if (!swipingRef.current) {
              if (next !== index) {
                scrollRef.current?.scrollTo({
                  // oxlint-disable-next-line id-length -- React Native's option name
                  x: index * width,
                  animated: false,
                });
              }
              return;
            }
            swipingRef.current = false;
            if (next !== index && next >= 0 && next < pages.length) {
              onIndexChange(next);
            }
          }}
        >
          {pages.map((page, pageIndex) => (
            <View
              key={page.key}
              // A row, like the bar holding a single page: the page's
              // `flex: 1` then fills the width, not a height still unknown.
              style={[$page, { width }]}
              // Only the page shown is read out; the others are a swipe away.
              accessibilityElementsHidden={pageIndex !== index}
              importantForAccessibility={
                pageIndex === index ? "auto" : "no-hide-descendants"
              }
            >
              {renderPage(page, pageIndex)}
            </View>
          ))}
        </ScrollView>
      )}
      {showDots ? (
        <View style={$dots} pointerEvents="none">
          {pages.map((page, pageIndex) => (
            <View
              key={page.key}
              style={[
                $dot,
                {
                  backgroundColor:
                    pageIndex === index
                      ? color.textPrimary
                      : page.isPlaying
                        ? color.accent
                        : color.textTertiary,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PageView({
  page,
  position,
  playerHref,
  variant,
}: {
  page: MiniPlayerPage;
  /** Where the page sits among several, for screen readers. */
  position?: {
    index: number;
    count: number;
    onIndexChange: (index: number) => void;
  };
  playerHref: Href;
  variant: Variant;
}) {
  const floating = variant === "floating";
  const docked = variant === "docked";
  const ownsBackground = floating || docked;
  // `Link asChild` takes only a flat style object, so the pressed state is
  // tracked here.
  const [isPressed, setIsPressed] = useState(false);

  const actions = position
    ? [
        ...(position.index < position.count - 1
          ? [{ name: "nextSpeaker", label: "Next speaker" }]
          : []),
        ...(position.index > 0
          ? [{ name: "previousSpeaker", label: "Previous speaker" }]
          : []),
      ]
    : undefined;

  return (
    <Link href={playerHref} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          position
            ? `Now playing: ${page.title}, ${page.subtitle}, speaker ${position.index + 1} of ${position.count}`
            : `Now playing: ${page.title}, ${page.subtitle}`
        }
        accessibilityHint="Opens the player"
        accessibilityActions={actions}
        onAccessibilityAction={(event) => {
          if (!position) {
            return;
          }
          if (event.nativeEvent.actionName === "nextSpeaker") {
            position.onIndexChange(position.index + 1);
          } else if (event.nativeEvent.actionName === "previousSpeaker") {
            position.onIndexChange(position.index - 1);
          }
        }}
        onPressIn={() => {
          setIsPressed(true);
        }}
        onPressOut={() => {
          setIsPressed(false);
        }}
        style={{
          ...$open,
          ...(ownsBackground ? undefined : $openAccessory),
          ...(docked ? $openDocked : undefined),
          ...(isPressed ? $pressed : undefined),
        }}
      >
        {variant === "inline" ? null : (
          <Link.AppleZoom>
            <Artwork
              uri={page.artworkUri}
              title={page.title}
              size={
                floating
                  ? artwork.row
                  : docked
                    ? dockedArtwork
                    : accessoryArtwork
              }
              radius={ownsBackground ? radius.xs : accessoryArtwork / 2}
            />
          </Link.AppleZoom>
        )}
        <View style={$text}>
          <Text variant="subhead" color="textPrimary" numberOfLines={1}>
            {page.title}
          </Text>
          {variant === "inline" ? null : (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {page.subtitle}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const $wrapper: ViewStyle = {
  paddingHorizontal: space.xs,
  paddingBottom: space.xs,
};

const $accessoryWrapper: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  paddingHorizontal: space.xxs,
};

/** Flush with the tab bar below: same surface, hairlines above and between. */
const $dockedWrapper: ViewStyle = {
  backgroundColor: color.surface1,
  borderTopWidth: StyleSheet.hairlineWidth,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderColor: color.separator,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
};

const $bar: ViewStyle = {
  paddingRight: space.xs,
  borderRadius: radius.md,
  backgroundColor: color.surface2,
  shadowColor: color.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
};

const $dockedRow: ViewStyle = {
  paddingRight: space.xs,
};

const $single: ViewStyle = {
  flex: 1,
};

const $page: ViewStyle = {
  flexDirection: "row",
};

const $pager: ViewStyle = {
  flex: 1,
  // Clips the neighbouring pages and the press highlight to the bar.
  overflow: "hidden",
  borderRadius: radius.md,
};

/**
 * A line of its own under the pages, centered, so a long subtitle never
 * runs into it.
 */
const $dots: ViewStyle = {
  flexDirection: "row",
  justifyContent: "center",
  gap: 5,
  paddingTop: 2,
  paddingBottom: 3,
};

const $dot: ViewStyle = {
  width: 5,
  height: 5,
  borderRadius: radius.pill,
};

const $open: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  padding: space.xs,
  borderRadius: radius.md,
};

const $openAccessory: ViewStyle = {
  paddingVertical: 0,
  paddingHorizontal: space.xxs,
};

const $openDocked: ViewStyle = {
  paddingHorizontal: space.md,
  borderRadius: 0,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
