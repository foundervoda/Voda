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

  const { user } = useAuthStore();
  const userName = user?.email ? user.email.split("@")[0] : "Customer";
  const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Cart from Zustand
  const cart = useOrderStore((s) => s.cart || []);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

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
    return (
      <Pressable
        onPress={() => navigation.navigate("StoreCatalog", { store: item })}
        style={styles.storeCard}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.image }} style={styles.storeImage} resizeMode="cover" />
          <View style={styles.gradientOverlay} />
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={10} color="#0d1b5e" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.storeName}>{item.name}</Text>
          <Text style={styles.storeDescription} numberOfLines={2}>
            {item.description}
          </Text>
          
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
          <Text style={styles.greetingText}>Welcome back, {capitalizedName}</Text>
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
    backgroundColor: "#fdf9ea",
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
    backgroundColor: "rgba(13, 27, 94, 0.04)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(13, 27, 94, 0.05)",
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
    paddingBottom: 100,
  },
  storeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(13, 27, 94, 0.03)",
  },
  imageWrapper: {
    width: "100%",
    height: 160,
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
