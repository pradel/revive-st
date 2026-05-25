import { BottomSheet } from "@expo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
  Alert,
  ScrollView,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useRadioFavorites,
  useRadioToggleFavorite,
} from "@/features/radio/hooks/useRadioFavorites";
import {
  useRadioStations,
  type RadioStation,
} from "@/features/radio/hooks/useRadioStations";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { logger } from "@/lib/logger";
import { Header } from "@/ui/Header";
import { COLORS } from "@/ui/theme";

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

export default function RadioBrowser() {
  const { speakers, playStreamMutation } = useBose();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState<string | null>("All");

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

  const handleCastToSpeaker = async (speakerId: string) => {
    if (!castingStation) {
      return;
    }
    const speaker = speakers.find((spk) => spk.deviceID === speakerId);
    if (!speaker) {
      return;
    }

    setCastingToSpeakerId(speakerId);
    try {
      const streamUrl = castingStation.url_resolved ?? castingStation.url;
      await playStreamMutation.mutateAsync({
        host: speaker.host,
        uri: streamUrl,
        name: castingStation.name,
      });
      setCastModalVisible(false);
      Alert.alert(
        "Casting Started",
        `Now streaming "${castingStation.name}" to ${speaker.name}.`,
      );
    } catch (err) {
      logger.error(err);
      Alert.alert(
        "Casting Failed",
        `Failed to play this stream on ${speaker.name}. Note: SoundTouch speakers prefer direct HTTP MP3/AAC streams.`,
      );
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const renderStationCard = ({ item }: { item: RadioStation }) => {
    const isFav = favorites.some((fav) => fav.stationuuid === item.stationuuid);

    const handleToggle = () => {
      toggleFavorite({ station: item, isFavorite: isFav });
    };

    return (
      <Pressable
        style={$stationCard}
        onPress={() => {
          handleStationPress(item);
        }}
      >
        <View style={$stationLogoContainer}>
          {item.favicon ? (
            <Image source={{ uri: item.favicon }} style={$stationLogo} />
          ) : (
            <SymbolView
              name={{ ios: "radio", android: "radio", web: "radio" }}
              tintColor={COLORS.textMuted}
              size={28}
            />
          )}
        </View>

        <View style={$stationDetails}>
          <Text style={$stationName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={$stationSubText} numberOfLines={1}>
            {item.country ?? "Unknown Country"} • {item.codec ?? "MP3"}
            {item.bitrate ? ` • ${item.bitrate} kbps` : ""}
          </Text>
        </View>

        <Pressable style={$favoriteButton} onPress={handleToggle}>
          <Text
            style={isFav ? $favoriteIconTextActive : $favoriteIconTextInactive}
          >
            {isFav ? "★" : "☆"}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  const renderSearchResults = () => {
    if (isLoading) {
      return (
        <View style={$centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={$loadingText}>Fetching stations...</Text>
        </View>
      );
    }
    if (isError) {
      return (
        <View style={$infoContainer}>
          <Text style={$infoIcon}>⚠</Text>
          <Text style={$infoTitle}>Search Failed</Text>
          <Text style={$infoText}>
            {error instanceof Error
              ? error.message
              : "Could not retrieve radio stations. Please check your internet connection."}
          </Text>
          <Pressable
            style={$exploreButton}
            onPress={() => {
              void queryClient.refetchQueries({
                queryKey: ["radio-stations"],
              });
            }}
          >
            <Text style={$exploreButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (!stations || stations.length === 0) {
      return (
        <View style={$infoContainer}>
          <Text style={$infoIcon}>📻</Text>
          <Text style={$infoTitle}>No Stations Found</Text>
          <Text style={$infoText}>
            Try a different search term or genre tag.
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={stations}
        keyExtractor={(item) => item.stationuuid}
        renderItem={renderStationCard}
        contentContainerStyle={$listContent}
      />
    );
  };

  return (
    <SafeAreaView style={$container}>
      <Header />

      <View style={$tabsContainer}>
        <View style={$tabsWrapper}>
          <Pressable
            style={[$tab, activeTab === "search" && $activeTab]}
            onPress={() => {
              setActiveTab("search");
            }}
          >
            <Text style={[$tabText, activeTab === "search" && $activeTabText]}>
              Browse
            </Text>
          </Pressable>
          <Pressable
            style={[$tab, activeTab === "favorites" && $activeTab]}
            onPress={() => {
              setActiveTab("favorites");
            }}
          >
            <Text
              style={[$tabText, activeTab === "favorites" && $activeTabText]}
            >
              Favorites
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "search" ? (
        <View style={{ flex: 1 }}>
          <View style={$searchBox}>
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              tintColor={COLORS.textSecondary}
              size={20}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={$searchInput}
              placeholder="Search by station name..."
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSelectedTag("All");
              }}
              onSubmitEditing={() => {
                handleSearch(query, "All");
              }}
              returnKeyType="search"
            />
            {query.trim().length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                }}
                style={$clearSearchButton}
              >
                <Text style={$clearSearchText}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <FlatList
              data={GENRE_TAGS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={$tagsContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[$tagPill, selectedTag === item && $tagPillActive]}
                  onPress={() => {
                    const nextTag = selectedTag === item ? "All" : item;
                    handleSearch("", nextTag);
                  }}
                >
                  <Text
                    style={[$tagText, selectedTag === item && $tagTextActive]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          {!isLoading && !isError && stations && stations.length > 0 && (
            <Text style={$listHeaderTitle}>
              {debouncedQuery || selectedTag !== "All"
                ? "SEARCH RESULTS"
                : "TRENDING STATIONS"}
            </Text>
          )}
          {renderSearchResults()}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {favorites.length === 0 ? (
            <View style={$infoContainer}>
              <Text style={$infoIcon}>★</Text>
              <Text style={$infoTitle}>No Favorites Yet</Text>
              <Text style={$infoText}>
                Stations you mark with a star will appear here for fast access.
              </Text>
              <Pressable
                style={$exploreButton}
                onPress={() => {
                  setActiveTab("search");
                }}
              >
                <Text style={$exploreButtonText}>Find Stations</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.stationuuid}
              renderItem={renderStationCard}
              contentContainerStyle={$listContent}
            />
          )}
        </View>
      )}

      <BottomSheet
        isPresented={castModalVisible}
        onDismiss={() => {
          setCastModalVisible(false);
        }}
      >
        <View style={$sheetContent}>
          <View style={$sheetHeader}>
            <Text style={$sheetTitle}>Select Speaker</Text>
          </View>

          <Text style={$sheetSubtitle}>
            Which speaker would you like to stream {`"${castingStation?.name}"`}{" "}
            to?
          </Text>

          {speakers.length === 0 ? (
            <View style={$sheetEmpty}>
              <Text style={$sheetEmptyIcon}>📡</Text>
              <Text style={$sheetEmptyTitle}>No Speakers Discovered</Text>
              <Text style={$sheetEmptyText}>
                Please ensure your SoundTouch speaker is online and connected to
                the same Wi-Fi.
              </Text>
            </View>
          ) : (
            <ScrollView style={$speakerList}>
              {speakers.map((speaker) => {
                const isPowerOff =
                  speaker.source === "STANDBY" ||
                  speaker.playStatus === "STANDBY";
                const isCasting = castingToSpeakerId === speaker.deviceID;

                return (
                  <Pressable
                    key={speaker.deviceID}
                    style={$speakerItem}
                    onPress={() => {
                      void handleCastToSpeaker(speaker.deviceID);
                    }}
                    disabled={isCasting}
                  >
                    <View style={$speakerItemLeft}>
                      <SymbolView
                        name={{
                          ios: "speaker.wave.2.fill",
                          android: "speaker",
                          web: "speaker",
                        }}
                        tintColor={COLORS.textMuted}
                        size={20}
                      />
                      <View>
                        <Text style={$speakerName}>{speaker.name}</Text>
                        <Text style={$speakerStatus}>
                          {isPowerOff
                            ? "Standby"
                            : `Playing • Vol ${speaker.volume}%`}
                        </Text>
                      </View>
                    </View>
                    {isCasting ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={$castPlayIcon}>▶</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $tabsContainer: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 12,
};

const $tabsWrapper: ViewStyle = {
  flexDirection: "row",
  backgroundColor: COLORS.card,
  borderRadius: 24,
  padding: 4,
};

const $tab: ViewStyle = {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 20,
  alignItems: "center",
  backgroundColor: COLORS.transparent,
};

const $activeTab: ViewStyle = {
  backgroundColor: COLORS.border,
};

const $tabText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 14,
  fontWeight: "600",
};

const $activeTabText: TextStyle = {
  color: COLORS.text,
};

const $searchBox: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: COLORS.card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: COLORS.border,
  marginHorizontal: 16,
  marginBottom: 12,
  paddingHorizontal: 12,
};

const $searchInput: TextStyle = {
  flex: 1,
  color: COLORS.text,
  height: 44,
  fontSize: 15,
};

const $clearSearchButton: ViewStyle = {
  padding: 6,
};

const $clearSearchText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 16,
};

const $tagsContent: ViewStyle = {
  gap: 8,
};

const $tagPill: ViewStyle = {
  paddingHorizontal: 24,
  paddingVertical: 8,
  borderRadius: 24,
  backgroundColor: COLORS.background,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $tagPillActive: ViewStyle = {
  backgroundColor: COLORS.primary,
  borderColor: COLORS.primary,
};

const $tagText: TextStyle = {
  color: COLORS.textSecondary,
  fontSize: 13,
  fontWeight: "600",
};

const $tagTextActive: TextStyle = {
  color: COLORS.text,
};

const $listContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingBottom: 24,
  gap: 16,
};

const $stationCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: COLORS.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 10,
};

const $stationLogoContainer: ViewStyle = {
  width: 56,
  height: 56,
  borderRadius: 8,
  backgroundColor: COLORS.card,
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
};

const $stationLogo: ImageStyle = {
  width: 56,
  height: 56,
};

const $stationDetails: ViewStyle = {
  flex: 1,
  marginLeft: 14,
  marginRight: 8,
};

const $stationName: TextStyle = {
  color: COLORS.text,
  fontSize: 16,
  fontWeight: "bold",
};

const $stationSubText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 13,
  marginTop: 4,
};

const $favoriteButton: ViewStyle = {
  width: 36,
  height: 36,
  justifyContent: "center",
  alignItems: "center",
};

const $favoriteIconTextActive: TextStyle = {
  color: COLORS.primary,
  fontSize: 24,
};

const $favoriteIconTextInactive: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 24,
};

const $listHeaderTitle: TextStyle = {
  color: COLORS.textSecondary,
  fontSize: 12,
  fontWeight: "bold",
  letterSpacing: 1.5,
  paddingHorizontal: 16,
  marginBottom: 12,
};

const $centerState: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: 60,
};

const $loadingText: TextStyle = {
  color: COLORS.textSecondary,
  marginTop: 12,
  fontSize: 15,
};

const $infoContainer: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 32,
  marginTop: 20,
};

const $infoIcon: TextStyle = {
  fontSize: 64,
  marginBottom: 16,
  opacity: 0.5,
};

const $infoTitle: TextStyle = {
  color: COLORS.text,
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 8,
  textAlign: "center",
};

const $infoText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 14,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 24,
};

const $exploreButton: ViewStyle = {
  backgroundColor: COLORS.primary,
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 8,
};

const $exploreButtonText: TextStyle = {
  color: COLORS.text,
  fontWeight: "600",
  fontSize: 14,
};

const $sheetContent: ViewStyle = {
  width: "100%",
  paddingHorizontal: 24,
  paddingTop: 16,
  paddingBottom: 24,
};

const $sheetHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const $sheetTitle: TextStyle = {
  color: COLORS.text,
  fontSize: 20,
  fontWeight: "700",
};

const $sheetSubtitle: TextStyle = {
  color: COLORS.textSecondary,
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 20,
};

const $speakerList: ViewStyle = {
  marginBottom: 12,
};

const $speakerItem: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: COLORS.card,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 16,
  padding: 16,
  marginBottom: 10,
};

const $speakerItemLeft: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const $speakerName: TextStyle = {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "bold",
};

const $speakerStatus: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 12,
  marginTop: 2,
};

const $castPlayIcon: TextStyle = {
  color: COLORS.primary,
  fontSize: 18,
  fontWeight: "bold",
};

const $sheetEmpty: ViewStyle = {
  alignItems: "center",
  paddingVertical: 40,
};

const $sheetEmptyIcon: TextStyle = {
  fontSize: 48,
  marginBottom: 12,
};

const $sheetEmptyTitle: TextStyle = {
  color: COLORS.text,
  fontSize: 16,
  fontWeight: "bold",
  marginBottom: 6,
};

const $sheetEmptyText: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 12,
  textAlign: "center",
};
