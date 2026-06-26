import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useOrderStore } from "../../store/useOrderStore";
import { useAuthStore } from "../../store/useAuthStore";
import ChatbotScreen from "./ChatbotScreen";

const FALLBACK_STORES = [
  {
    id: "f7d3ad59-b76f-4eae-b812-83f2836a9dac",
    name: "Sneaker House",
    location: "Level 1, Unit 12",
    description: "Your ultimate footwear destination for classic sneakers and boots.",
    image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800",
    tags: ["Sneakers", "Boots"]
  },
  {
    id: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234",
    name: "Zara Luxe Hub",
    location: "Level 2, Unit 4",
    description: "Premium high-end fashion, luxury apparel, and minimalist attire.",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
    tags: ["Apparel"]
  },
  {
    id: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319",
    name: "Stellar Activewear",
    location: "Level 1, Unit 18",
    description: "Athletic utility clothing, high-performance wear, and trainers.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800",
    tags: ["Sneakers", "Apparel"]
  }
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [chatbotVisible, setChatbotVisible] = useState(false);
  const [currentMockZone, setCurrentMockZone] = useState("Zone A");

  const { user } = useAuthStore();
  const userName = user?.email ? user.email.split("@")[0] : "Customer";
  const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Detect active membership tier
  let currentTier = "Free";
  if (user?.email?.toLowerCase().includes("platinum")) {
    currentTier = "Platinum";
  } else if (user?.email?.toLowerCase().includes("gold")) {
    currentTier = "Gold";
  }

  const maxAllowedStores = currentTier === "Platinum" ? 5 : currentTier === "Gold" ? 3 : 1;

  // Cart from Zustand
  const cart = useOrderStore((s) => s.cart || []);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const uniqueCartStoreNames = [...new Set(cart.map(item => item.storeName))].filter(Boolean);

  const getStoreZone = (storeName) => {
    if (storeName === "Zara Luxe Hub") return "Zone B";
    return "Zone A";
  };

  // React Query: Fetch Stores
  const { data: stores, isLoading, refetch } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get("/products/stores").then((res) => res.data?.data?.stores || res.data?.stores || []),
    retry: false,
  });

  const baseStores = stores && stores.length > 0 ? stores : FALLBACK_STORES;

  // Enrich stores with mock descriptions and cover images for premium look
  const enrichedStores = baseStores.map((store) => {
    const fallback = FALLBACK_STORES.find((fs) => fs.id === store.id) || {};
    return {
      ...store,
      description: fallback.description || "Explore our wide range of premium collections in the mall.",
      image: fallback.image || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
      tags: fallback.tags || ["Retail"]
    };
  });

  const displayedStores = enrichedStores.filter((store) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      store.name?.toLowerCase().includes(query) ||
      store.location?.toLowerCase().includes(query)
    );
  });

  const renderStoreCard = ({ item }) => {
    const storeZone = getStoreZone(item.name);
    const isDifferentZone = storeZone !== currentMockZone;
    const isStoreLockedByZone = currentTier !== "Platinum" && isDifferentZone;

    const isLimitReached = uniqueCartStoreNames.length >= maxAllowedStores;
    const isStoreLockedByLimit = isLimitReached && !uniqueCartStoreNames.includes(item.name);

    const isLocked = isStoreLockedByZone || isStoreLockedByLimit;

    const handlePressStore = () => {
      if (isStoreLockedByZone) {
        if (currentTier === "Free") {
          Alert.alert(
            "Store Locked",
            "This store is outside your current delivery zone. Upgrade to Voda Gold or Platinum to access multi-zone delivery!",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Upgrade Plan", onPress: () => navigation.navigate("VodaGold") }
            ]
          );
        } else if (currentTier === "Gold") {
          Alert.alert(
            "Zone Switch Used",
            "You have already used your 1 monthly zone switch. Upgrade to Platinum for unlimited multi-zone delivery!",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Upgrade to Platinum", onPress: () => navigation.navigate("VodaGold") }
            ]
          );
        }
        return;
      }

      if (isStoreLockedByLimit) {
        if (currentTier === "Platinum") {
          Alert.alert(
            "Store Limit Reached",
            "You have reached the maximum limit of 5 stores for a single order on the Platinum plan.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Store Limit Reached",
            `Your current ${currentTier} plan allows ordering from a maximum of ${maxAllowedStores} store${maxAllowedStores > 1 ? "s" : ""} per order. Upgrade to access more stores!`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Upgrade Plan", onPress: () => navigation.navigate("VodaGold") }
            ]
          );
        }
        return;
      }

      navigation.navigate("StoreCatalog", { store: item });
    };

    return (
      <Pressable
        onPress={handlePressStore}
        style={[styles.storeCard, isLocked && styles.storeCardLocked]}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.image }} style={[styles.storeImage, isLocked && styles.storeImageLocked]} resizeMode="cover" />
          <View style={styles.gradientOverlay} />
          
          {/* Lock Overlay */}
          {isLocked && (
            <View style={styles.lockOverlay}>
              <View style={styles.lockIconBg}>
                <Ionicons name="lock-closed" size={20} color="#ffffff" />
              </View>
              <Text style={styles.lockText}>
                {isStoreLockedByZone ? "Outside Active Zone" : (currentTier === "Platinum" ? "5 stores in order" : "Store Limit Reached")}
              </Text>
            </View>
          )}

          <View style={styles.locationBadge}>
            <Ionicons name="location" size={10} color="#0d1b5e" />
            <Text style={styles.locationText}>{item.location} ({storeZone})</Text>
          </View>
        </View>

        <View style={[styles.cardInfo, isLocked && { opacity: 0.6 }]}>
          <Text style={styles.storeName}>{item.name}</Text>
          
          {isStoreLockedByZone ? (
            <Text style={styles.lockDetailText}>
              {currentTier === "Gold" 
                ? "Zone switch used: resets in 12 days." 
                : "Not in your active delivery zone."}
            </Text>
          ) : isStoreLockedByLimit ? (
            <Text style={styles.lockDetailText}>
              {currentTier === "Platinum"
                ? "Maximum 5 stores reached for this order."
                : `Store limit reached for this order (${maxAllowedStores} max).`}
            </Text>
          ) : (
            <Text style={styles.storeDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, idx) => (
              <View key={idx} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.logoContainer}>
            <View style={styles.logoIconBg}>
              <Ionicons name="bag-handle" size={15} color="#fdde59" />
            </View>
            <Text style={styles.brandText}>Voda</Text>
          </View>
          <Text style={styles.greetingText}>Welcome back, {capitalizedName} ({currentTier})</Text>
          <Text style={styles.headerTitle}>Mall Directory</Text>
        </View>
        
        {/* Cart Shortcut */}
        <Pressable 
          onPress={() => navigation.navigate("Cart")}
          style={styles.cartBtn}
        >
          <Ionicons name="cart" size={22} color="#0d1b5e" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#0d1b5e" style={styles.searchIcon} />
          <TextInput
            placeholder="Search stores by name or location..."
            placeholderTextColor="rgba(13, 27, 94, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#0d1b5e" style={{ opacity: 0.6 }} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Mock GPS Location Controller Banner */}
      <View style={styles.gpsBanner}>
        <View style={styles.gpsRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="navigate-circle" size={20} color="#0d1b5e" style={{ marginRight: 6 }} />
            <Text style={styles.gpsLabel}>Mock GPS Active Zone:</Text>
            <Text style={styles.gpsValue}>{currentMockZone}</Text>
          </View>
          <Pressable 
            onPress={() => setCurrentMockZone(prev => prev === "Zone A" ? "Zone B" : "Zone A")}
            style={({ pressed }) => [styles.gpsToggleBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.gpsToggleText}>Switch Location</Text>
          </Pressable>
        </View>
        {currentTier === "Gold" && (
          <Text style={styles.gpsWarning}>Zone switch used: resets in 12 days.</Text>
        )}
      </View>

      {/* Directory List */}
      {isLoading && displayedStores.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d1b5e" />
        </View>
      ) : (
        <FlatList
          data={displayedStores}
          renderItem={renderStoreCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={!!isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#0d1b5e" style={{ opacity: 0.4, marginBottom: 8 }} />
              <Text style={styles.emptyText}>No stores found matching your query</Text>
            </View>
          }
        />
      )}

      {/* Floating Chatbot FAB */}
      <Pressable
        onPress={() => setChatbotVisible(true)}
        style={styles.chatbotFab}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#fdde59" />
      </Pressable>

      {/* Chatbot Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={chatbotVisible}
        onRequestClose={() => setChatbotVisible(false)}
      >
        <ChatbotScreen navigation={navigation} onClose={() => setChatbotVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  storeCardLocked: {
    borderColor: "rgba(13, 27, 94, 0.04)",
    backgroundColor: "rgba(13, 27, 94, 0.02)",
  },
  storeImageLocked: {
    opacity: 0.3,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13, 27, 94, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0d1b5e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  lockText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  lockDetailText: {
    fontSize: 12,
    color: "#ea580c",
    fontWeight: "700",
    marginTop: 4,
  },
  gpsBanner: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0d1b5e10",
    padding: 12,
  },
  gpsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0d1b5e60",
  },
  gpsValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0d1b5e",
    marginLeft: 4,
  },
  gpsToggleBtn: {
    backgroundColor: "#0d1b5e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gpsToggleText: {
    color: "#fdde59",
    fontSize: 11,
    fontWeight: "800",
  },
  gpsWarning: {
    fontSize: 10,
    color: "#ea580c",
    fontWeight: "700",
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(13, 27, 94, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  logoIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#0d1b5e",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0d1b5e",
    letterSpacing: 0.5,
  },
  greetingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(13, 27, 94, 0.5)",
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0d1b5e",
    letterSpacing: -0.5,
    marginTop: 1,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(13, 27, 94, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fdde59",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0d1b5e",
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(120, 120, 128, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    borderWidth: 0,
  },
  searchIcon: {
    opacity: 0.6,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0d1b5e",
    fontWeight: "600",
    padding: 0,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  storeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrapper: {
    width: "100%",
    height: 180,
    position: "relative",
  },
  storeImage: {
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(0, 0, 0, 0.15)", // Subtle overlay
  },
  locationBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#fdde59",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  locationText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0d1b5e",
    marginLeft: 4,
  },
  cardInfo: {
    padding: 16,
  },
  storeName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0d1b5e",
    letterSpacing: -0.2,
  },
  storeDescription: {
    fontSize: 13,
    color: "rgba(13, 27, 94, 0.6)",
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 6,
  },
  tagsContainer: {
    flexDirection: "row",
    marginTop: 12,
  },
  tagBadge: {
    backgroundColor: "rgba(13, 27, 94, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0d1b5e",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    color: "#0d1b5e",
    fontWeight: "700",
    opacity: 0.5,
  },
  chatbotFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d1b5e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 9999,
  },
});
