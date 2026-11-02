import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
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

/**
 * iOS 26: the floating card is Liquid Glass, like the tab bar under it,
 * tinted by the artwork shown behind it.
 */
const liquidGlass = isLiquidGlassAvailable();

/** What the mini player shows for one speaker. */
export interface MiniPlayerPage {
  key: string;
  title: string;
  subtitle: string;
  artworkUri?: string | null;
  /** Playing: its dot is a solid grey; idle ones are an outline. */
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
   * `floating` draws a rounded card above the tabs (iOS); `docked` is a
   * full-width strip on the tab bar's surface, attached to its top (Android).
   */
  variant?: "floating" | "docked";
}

const dockedArtwork = 40;

export function MiniPlayer({
  pages,
  index,
  onIndexChange,
  playerHref,
  onPlayPause,
  variant = "floating",
}: MiniPlayerProps) {
  const docked = variant === "docked";
  const shown = pages[index];
  const paged = pages.length > 1;
  const glass = !docked && liquidGlass;

  const renderPage = (page: MiniPlayerPage, pageIndex: number) => (
    <PageView
      page={page}
      position={
        paged
          ? { index: pageIndex, count: pages.length, onIndexChange }
          : undefined
      }
      playerHref={playerHref}
      docked={docked}
    />
  );

  // The open-player area and the play button are siblings so screen readers
  // can focus each one.
  return (
    <View style={docked ? $dockedWrapper : $wrapper}>
      <View style={docked ? undefined : glass ? $glassBar : $bar}>
        {(glass || docked) && shown?.artworkUri ? (
          <Image
            source={{ uri: shown.artworkUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={40}
            transition={300}
          />
        ) : null}
        {glass ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            colorScheme="dark"
          />
        ) : docked && shown?.artworkUri ? (
          // Android has no glass: a scrim keeps the text readable instead.
          <View style={$scrim} />
        ) : null}
        <View style={[$row, glass && $rowGlass]}>
          {paged ? (
            <Pager
              pages={pages}
              index={index}
              onIndexChange={onIndexChange}
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
              iconSize={22}
            />
          ) : paged ? (
            // Keeps the pages as wide whether the speaker shown can play
            // or not, so they don't resize as they slide.
            <View style={$buttonSlot} />
          ) : null}
        </View>
        {paged ? (
          // Under the whole bar, not just the pages: they stay put, centered,
          // whatever the page shown.
          <View
            style={[$dots, glass && $dotsGlass, docked && $dotsDocked]}
            pointerEvents="none"
          >
            {pages.map((page, pageIndex) => (
              <View
                key={page.key}
                style={
                  pageIndex === index
                    ? $dotSelected
                    : page.isPlaying
                      ? $dotPlaying
                      : $dotIdle
                }
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The pages side by side, one bar-width each. The page shown always comes
 * from `index`: it holds no state beyond its width.
 */
function Pager({
  pages,
  index,
  onIndexChange,
  renderPage,
}: {
  pages: readonly MiniPlayerPage[];
  index: number;
  onIndexChange: (index: number) => void;
  renderPage: (page: MiniPlayerPage, index: number) => ReactNode;
}) {
  const [width, setWidth] = useState<number>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Only a swipe picks a page. Scrolls the pager makes itself (following
  // `index`, or pages added before the one shown) or a screen reader makes
  // also end in `onMomentumScrollEnd`, so those snap back to `index`.
  const swipingRef = useRef(false);

  // Follows a page picked elsewhere; a no-op after a swipe here, which
  // already rests on it.
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
    </View>
  );
}

function PageView({
  page,
  position,
  playerHref,
  docked,
}: {
  page: MiniPlayerPage;
  /** Where the page sits among several, for screen readers. */
  position?: {
    index: number;
    count: number;
    onIndexChange: (index: number) => void;
  };
  playerHref: Href;
  docked: boolean;
}) {
  // `Link asChild` takes only a flat style object, so the pressed state is
  // tracked here.
  const [isPressed, setIsPressed] = useState(false);
  const glass = !docked && liquidGlass;

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
          ...(docked ? $openDocked : undefined),
          ...(glass ? $openGlass : undefined),
          // The dots under the pages take the rest of the bottom padding.
          ...(position
            ? docked
              ? $openAboveDotsDocked
              : $openAboveDots
            : undefined),
          ...(isPressed ? (glass ? $pressedGlass : $pressed) : undefined),
        }}
      >
        <Link.AppleZoom>
          <Artwork
            uri={page.artworkUri}
            title={page.title}
            size={docked ? dockedArtwork : artwork.row}
            radius={radius.xs}
          />
        </Link.AppleZoom>
        <View style={$text}>
          <Text variant="subhead" color="textPrimary" numberOfLines={1}>
            {page.title}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {page.subtitle}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** Lined up with the cards on the screen above it. */
const $wrapper: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.xs,
};

/**
 * Flush with the tab bar below, on the same surface: a hairline above, and a
 * full line under it so the bar reads as separate from the tabs.
 */
const $dockedWrapper: ViewStyle = {
  backgroundColor: color.surface1,
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: color.separator,
  borderBottomWidth: 1,
  borderBottomColor: color.surface3,
};

/** The play button keeps clear of the bar's edge. */
const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
  paddingRight: space.xs,
};

const $bar: ViewStyle = {
  borderRadius: radius.md,
  backgroundColor: color.surface2,
  shadowColor: color.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
};

/**
 * Rounded like the tab bar's glass; its padding (`$openGlass`) keeps the
 * artwork's corners concentric with the card's.
 */
const $glassBar: ViewStyle = {
  borderRadius: radius.lg,
  overflow: "hidden",
};

const $scrim: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: color.scrim,
};

/** As wide as the play button it stands in for. */
const $buttonSlot: ViewStyle = {
  width: 40,
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

/** Matches the glass card's wider page padding (`$openGlass`). */
const $rowGlass: ViewStyle = {
  paddingRight: space.sm,
};

/**
 * A line of its own under the pages and the play button, centered. Under
 * the pages' own bottom padding: a little more space below the dots than
 * above them, so they read as part of the bar's edge.
 */
const $dots: ViewStyle = {
  flexDirection: "row",
  justifyContent: "center",
  gap: 6,
  paddingBottom: space.xxs + 2,
};

const $dotsGlass: ViewStyle = {
  paddingBottom: space.sm - 2,
};

const $dotsDocked: ViewStyle = {
  paddingBottom: space.sm,
};

const $dot: ViewStyle = {
  width: 5,
  height: 5,
  borderRadius: radius.pill,
};

/** Three shades of white: the speaker shown, others playing, idle ones. */
const $dotSelected: ViewStyle = {
  ...$dot,
  backgroundColor: color.textPrimary,
};

const $dotPlaying: ViewStyle = {
  ...$dot,
  backgroundColor: color.textSecondary,
};

const $dotIdle: ViewStyle = {
  ...$dot,
  borderWidth: 1,
  borderColor: color.textTertiary,
};

const $open: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  padding: space.xs,
  borderRadius: radius.md,
};

/** A full-width strip: Material's 16dp side margins and room to breathe. */
const $openDocked: ViewStyle = {
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  borderRadius: 0,
};

const $openAboveDots: ViewStyle = {
  paddingBottom: space.xxs,
};

const $openAboveDotsDocked: ViewStyle = {
  paddingBottom: space.xs,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

/** A light wash over the glass, not an opaque surface. */
const $pressedGlass: ViewStyle = {
  backgroundColor: color.separator,
};

const $openGlass: ViewStyle = {
  padding: space.sm,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
