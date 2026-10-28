import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SearchBarCommands } from "react-native-screens";

import {
  useRadioFavorites,
  useRadioToggleFavorite,
} from "@/features/radio/hooks/useRadioFavorites";
import {
  useRadioStations,
  type RadioStation,
} from "@/features/radio/hooks/useRadioStations";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  useMargeAPIStatusQuery,
  type BoseSpeaker,
} from "@/features/speakers/hooks/useSpeakerManager";
import { logger } from "@/lib/logger";
import { Button } from "@/ui/ds/Button";
import { Chip } from "@/ui/ds/Chip";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { SegmentedControl } from "@/ui/ds/SegmentedControl";
import { Shelf } from "@/ui/ds/Shelf";
import { Text } from "@/ui/ds/Text";
import { Tile } from "@/ui/ds/Tile";
import { artwork, color, radius, space } from "@/ui/tokens";

const GENRE_TAGS = [
  "All",
  "Jazz",
  "Classical",
  "Rock",
  "Pop",
  "80s",
  "90s",
  "News",
  "Ambient",
];

const TABS = [
  { value: "search", label: "Browse" },
  { value: "favorites", label: "Favorites" },
] as const;

function stationDetail(station: RadioStation) {
  return [
    station.country,
    station.codec,
    station.bitrate ? `${station.bitrate} kbps` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function RadioBrowser() {
  const { speakers, playStreamMutation } = useBose();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState<string | null>("All");
  const searchBarRef = useRef<SearchBarCommands>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const { data: favorites = [] } = useRadioFavorites();
  const { mutate: toggleFavorite } = useRadioToggleFavorite();

  const {
    data: stations,
    isLoading,
    isError,
    error,
  } = useRadioStations(
    debouncedQuery,
    selectedTag === "All" ? null : selectedTag,
  );

  const [castingStation, setCastingStation] = useState<RadioStation | null>(
    null,
  );
  const [castModalVisible, setCastModalVisible] = useState(false);
  const [castingToSpeakerId, setCastingToSpeakerId] = useState<string | null>(
    null,
  );

  const isSearching = Boolean(debouncedQuery) || selectedTag !== "All";

  const handleSearch = (searchQuery = query, tag = selectedTag) => {
    setQuery(searchQuery);
    setDebouncedQuery(searchQuery);
    setSelectedTag(tag ?? "All");
    setActiveTab("search");
  };

  const handleStationPress = (station: RadioStation) => {
    setCastingStation(station);
    setCastModalVisible(true);
  };

  const handleCastToSpeaker = async (
    speakerId: string,
    isMargeAPIConfigured = false,
  ) => {
    if (!castingStation) {
      return;
    }
    const speaker = speakers.find((spk) => spk.deviceID === speakerId);
    if (!speaker) {
      return;
    }

    if (!isMargeAPIConfigured) {
      Alert.alert(
        "Configuration Required",
        "This speaker must be configured for the Marge API before it can play custom radio streams.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Configure",
            onPress: () => {
              setCastModalVisible(false);
              router.push(`/speakers/${speakerId}/settings`);
            },
          },
        ],
      );
      return;
    }

    logger.info(
      `[radio] Attempting to cast to speaker ${speakerId} (configured: ${isMargeAPIConfigured})`,
    );

    setCastingToSpeakerId(speakerId);
    try {
      const streamUrl = castingStation.url_resolved ?? castingStation.url;
      logger.info(
        `[radio] Calling mutateAsync for ${speaker.host} with ${streamUrl}`,
      );
      await playStreamMutation.mutateAsync({
        deviceID: speaker.deviceID,
        uri: streamUrl,
        name: castingStation.name,
      });
      logger.info(`[radio] mutateAsync finished successfully`);
      setCastModalVisible(false);
      Alert.alert(
        "Casting Started",
        `Now streaming "${castingStation.name}" to ${speaker.name}.`,
      );
    } catch (err) {
      logger.error(err);
      if (err instanceof Error && err.message === "UNKNOWN_SOURCE_ERROR") {
        Alert.alert(
          "Source Missing on Speaker",
          `The speaker "${speaker.name}" is missing the "LOCAL_INTERNET_RADIO" source in its registry (this often happens after a factory reset).\n\nTo fix this, you must setup the speaker from the settings screen.`,
        );
      } else {
        Alert.alert(
          "Casting Failed",
          `Failed to play this stream on ${speaker.name}.`,
        );
      }
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const renderStationRow = ({ item }: { item: RadioStation }) => {
    const isFav = favorites.some((fav) => fav.stationuuid === item.stationuuid);

    return (
      <ListRow
        title={item.name}
        subtitle={stationDetail(item)}
        artworkUri={item.favicon || null}
        fallbackIcon={icons.radio}
        onPress={() => {
          handleStationPress(item);
        }}
        trailing={
          <IconButton
            icon={isFav ? icons.starFilled : icons.star}
            accessibilityLabel={
              isFav ? "Remove from favorites" : "Add to favorites"
            }
            tint={isFav ? "accent" : "textSecondary"}
            onPress={() => {
              toggleFavorite({ station: item, isFavorite: isFav });
            }}
          />
        }
      />
    );
  };

  const renderBrowseEmpty = () => {
    if (isLoading) {
      return (
        <View style={$loading}>
          <ActivityIndicator size="small" color={color.textSecondary} />
          <Text variant="subhead" color="textSecondary">
            Fetching stations…
          </Text>
        </View>
      );
    }
    if (isError) {
      return (
        <EmptyState
          icon={icons.warning}
          title="Search failed"
          description={
            error instanceof Error
              ? error.message
              : "Could not retrieve radio stations. Please check your internet connection."
          }
          actions={
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                void queryClient.refetchQueries({
                  queryKey: ["radio-stations"],
                });
              }}
            />
          }
        />
      );
    }
    return (
      <EmptyState
        icon={icons.radio}
        title="No stations found"
        description="Try a different search term or genre tag."
      />
    );
  };

  const controls = (
    <View style={$controls}>
      <SegmentedControl
        options={TABS}
        value={activeTab}
        onChange={setActiveTab}
      />
    </View>
  );

  const browseHeader = (
    <>
      {controls}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={$tags}
      >
        {GENRE_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            selected={selectedTag === tag}
            onPress={() => {
              const nextTag = selectedTag === tag ? "All" : tag;
              searchBarRef.current?.clearText();
              handleSearch("", nextTag);
            }}
          />
        ))}
      </ScrollView>
      {favorites.length > 0 && !isSearching && (
        <Shelf title="Your favorites">
          {favorites.map((station) => (
            <Tile
              key={station.stationuuid}
              title={station.name}
              subtitle={station.country || undefined}
              artworkUri={station.favicon || null}
              fallbackIcon={icons.radio}
              onPress={() => {
                handleStationPress(station);
              }}
            />
          ))}
        </Shelf>
      )}
      {!isLoading && !isError && stations && stations.length > 0 && (
        <SectionHeader title={isSearching ? "Search results" : "Trending"} />
      )}
    </>
  );

  return (
    <Screen footer={<NowPlayingBar />}>
      <Stack.SearchBar
        ref={searchBarRef}
        placeholder="Search stations"
        autoCapitalize="none"
        onChangeText={(event) => {
          const text = event.nativeEvent.text;
          setQuery(text);
          // Clearing the field (including `clearText()` when a genre is
          // picked) keeps the genre; typing a query searches all genres.
          if (text !== "") {
            setSelectedTag("All");
            setActiveTab("search");
          }
        }}
        onSearchButtonPress={(event) => {
          handleSearch(event.nativeEvent.text, "All");
        }}
        onCancelButtonPress={() => {
          setQuery("");
        }}
        onClose={() => {
          setQuery("");
        }}
      />

      {activeTab === "search" ? (
        <FlatList
          data={isLoading || isError ? [] : (stations ?? [])}
          keyExtractor={(item) => item.stationuuid}
          renderItem={renderStationRow}
          ListHeaderComponent={browseHeader}
          ListEmptyComponent={renderBrowseEmpty()}
          contentContainerStyle={$listContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.stationuuid}
          renderItem={renderStationRow}
          ListHeaderComponent={controls}
          contentContainerStyle={$listContent}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <EmptyState
              icon={icons.starFilled}
              title="No favorites yet"
              description="Stations you star will appear here for quick access."
              actions={
                <Button
                  label="Find stations"
                  variant="secondary"
                  onPress={() => {
                    setActiveTab("search");
                  }}
                />
              }
            />
          }
        />
      )}

      <Modal
        visible={castModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCastModalVisible(false);
        }}
      >
        <View style={$modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close"
            onPress={() => {
              setCastModalVisible(false);
            }}
          />
          <SafeAreaView edges={["bottom"]} style={$sheet}>
            <View style={$grabber} />
            <View style={$sheetHeader}>
              <Text variant="title">Play on…</Text>
              <Text variant="body" color="textSecondary" numberOfLines={2}>
                {`Choose a speaker for "${castingStation?.name ?? ""}".`}
              </Text>
            </View>

            {speakers.length === 0 ? (
              <EmptyState
                icon={icons.wifiOff}
                title="No speakers discovered"
                description="Make sure your SoundTouch speaker is online and on the same Wi-Fi."
              />
            ) : (
              <View style={$speakerList}>
                {speakers.map((speaker) => (
                  <SpeakerCastItem
                    key={speaker.deviceID}
                    speaker={speaker}
                    isCasting={castingToSpeakerId === speaker.deviceID}
                    onCast={(id, isConfigured) => {
                      void handleCastToSpeaker(id, isConfigured);
                    }}
                  />
                ))}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </Screen>
  );
}

function SpeakerCastItem({
  speaker,
  isCasting,
  onCast,
}: {
  speaker: BoseSpeaker;
  isCasting: boolean;
  onCast: (id: string, isConfigured: boolean) => void;
}) {
  const margeAPIStatus = useMargeAPIStatusQuery(speaker.host);
  const isPowerOff =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";

  const isError = margeAPIStatus.isError;
  const isConfigured = margeAPIStatus.data === true;
  const isLoading = margeAPIStatus.isLoading;
  const isDisabled = isCasting || isLoading || isError;

  const getStatusText = () => {
    if (isLoading) {
      return "Checking configuration…";
    }
    if (isError) {
      return "Connection failed";
    }
    if (!isConfigured) {
      return "Not configured for Marge API";
    }
    if (isPowerOff) {
      return "Standby";
    }
    return `Playing · Vol ${speaker.volume}%`;
  };

  const renderTrailing = () => {
    if (isCasting || isLoading) {
      return <ActivityIndicator size="small" color={color.textSecondary} />;
    }
    if (isError) {
      return <Icon name={icons.warning} size={16} color="danger" />;
    }
    if (isConfigured) {
      return <Icon name={icons.play} size={16} color="textPrimary" />;
    }
    return <Icon name={icons.lock} size={16} color="textTertiary" />;
  };

  return (
    <ListRow
      title={speaker.name}
      subtitle={getStatusText()}
      disabled={isDisabled}
      leading={
        <View style={$speakerIcon}>
          <Icon name={icons.speaker} size={20} />
        </View>
      }
      trailing={renderTrailing()}
      onPress={() => {
        logger.info(
          `[SpeakerCastItem] PRESSED ${speaker.name} (${speaker.deviceID})`,
        );
        onCast(speaker.deviceID, isConfigured);
      }}
    />
  );
}

const $controls: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.sm,
};

const $tags: ViewStyle = {
  gap: space.xs,
  paddingHorizontal: space.screen,
  paddingVertical: space.sm,
};

const $listContent: ViewStyle = {
  paddingBottom: space.xl,
};

const $loading: ViewStyle = {
  alignItems: "center",
  gap: space.sm,
  paddingVertical: space.xxxl,
};

const $modalOverlay: ViewStyle = {
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: color.scrim,
};

const $sheet: ViewStyle = {
  backgroundColor: color.surface1,
  borderTopLeftRadius: radius.lg,
  borderTopRightRadius: radius.lg,
  paddingBottom: space.md,
};

const $grabber: ViewStyle = {
  alignSelf: "center",
  width: 36,
  height: 5,
  marginTop: space.xs,
  borderRadius: radius.pill,
  backgroundColor: color.surface3,
};

const $sheetHeader: ViewStyle = {
  gap: space.xxs,
  paddingHorizontal: space.screen,
  paddingTop: space.md,
  paddingBottom: space.xs,
};

const $speakerList: ViewStyle = {
  paddingTop: space.xxs,
};

const $speakerIcon: ViewStyle = {
  width: artwork.row,
  height: artwork.row,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.xs,
  backgroundColor: color.surface2,
};
