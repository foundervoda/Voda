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
import ChatbotScreen from "./ChatbotScreen";

const FALLBACK_PRODUCTS = [
  {
    id: "prod-air-runner",
    name: "Air Runner 2",
    price: 8990.00,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop",
    category: "Sneakers",
    trending: true,
    storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac"
  },
  {
    id: "prod-cloud-walker",
    name: "Cloud Walker Pro",
    price: 11990.00,
    imageUrl: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&auto=format&fit=crop",
    category: "Sneakers",
    trending: true,
    storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac"
  },
  {
    id: "prod-trench-coat",
    name: "Classic Trench Coat",
    price: 14990.00,
    imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop",
    category: "Apparel",
    trending: true,
    storeId: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234"
  },
  {
    id: "prod-apex-run",
    name: "Apex Running Shoes",
    price: 9990.00,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop",
    category: "Sneakers",
    trending: true,
    storeId: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319"
  }
];

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getProductImage = (item) => {
  const basePath = "http://localhost:3001";
  const imgPath = item?.images?.[0] || item?.imageUrl || item?.image;
  if (!imgPath) return null;
  return imgPath.startsWith("http") ? { uri: imgPath } : { uri: `${basePath}${imgPath}` };
};

export default function StoreCatalogScreen({ route, navigation }) {
  const { store } = route.params;
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [chatbotVisible, setChatbotVisible] = useState(false);

  // Cart from Zustand
  const cart = useOrderStore((s) => s.cart || []);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Query Products
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((res) => res.data?.data?.products || res.data?.products || []),
    retry: false,
  });

  const baseProducts = products && products.length > 0 ? products : FALLBACK_PRODUCTS;

  // Filter products by selected store ID
  const storeProducts = baseProducts.filter((p) => p.storeId === store.id);

  // Categories
  const storeCategories = ["All", ...new Set(storeProducts.map((p) => p.category))];

  const displayedProducts = storeProducts.filter((product) => {
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCategory !== "All" && product.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const renderCategoryChip = ({ item }) => {
    const isActive = selectedCategory === item;
    return (
      <Pressable
        onPress={() => setSelectedCategory(item)}
        style={[
          chipStyles.pill,
          isActive ? chipStyles.pillActive : chipStyles.pillInactive,
        ]}
      >
        <Text
          style={[
            chipStyles.pillTxt,
            isActive ? chipStyles.pillTxtActive : chipStyles.pillTxtInactive,
          ]}
        >
          {item}
        </Text>
      </Pressable>
    );
  };

  const renderProductCard = ({ item }) => {
    const imageSource = getProductImage(item);
    const price = Number(item.price) || 0;

    return (
      <Pressable
        onPress={() => navigation.navigate("ProductDetail", { productId: item.id })}
        style={styles.productCard}
      >
        <View style={styles.imageWrapper}>
          {imageSource ? (
            <Image source={imageSource} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.fallbackImageBg}>
              <Ionicons name="image-outline" size={24} color="#0d1b5e" style={{ opacity: 0.3 }} />
            </View>
          )}
          {item.trending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingText}>🔥 Trending</Text>
            </View>
          )}
        </View>

        <View style={styles.cardDetails}>
          <View>
            <Text numberOfLines={1} style={styles.productName}>
              {item.name}
            </Text>
            <Text style={styles.productCategory}>
              {item.category}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>
              ₹{formatRupeePrice(price)}
            </Text>
            <View style={styles.tryBadge}>
              <Text style={styles.tryText}>Try & Buy</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Floating Cart Button */}
      <View style={styles.cartFloatingWrapper}>
        <Pressable 
          onPress={() => navigation.navigate("Cart")}
          style={styles.cartButton}
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
            placeholder={`Search products in ${store.name}...`}
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

      {/* Category Selection Bar */}
      {storeCategories.length > 2 && (
        <View style={styles.categoriesContainer}>
          <FlatList
            horizontal
            data={storeCategories}
            renderItem={renderCategoryChip}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
      )}

      {/* Products Grid */}
      {isLoading && displayedProducts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d1b5e" />
        </View>
      ) : (
        <FlatList
          data={displayedProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={!!isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#0d1b5e" style={{ opacity: 0.4, marginBottom: 8 }} />
              <Text style={styles.emptyText}>No products found in this store</Text>
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

      {/* Chatbot Presentation Modal */}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13, 27, 94, 0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
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
    letterSpacing: 0,
    padding: 0,
  },
  categoriesContainer: {
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#0d1b5e",
    fontWeight: "700",
    opacity: 0.5,
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    margin: 8,
    flex: 0.5,
    overflow: "hidden",
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(13, 27, 94, 0.03)",
    height: 230,
  },
  imageWrapper: {
    width: "100%",
    height: 130,
    backgroundColor: "rgba(13, 27, 94, 0.02)",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  fallbackImageBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  trendingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fdde59",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    shadowColor: "#0d1b5e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  trendingText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#0d1b5e",
    textTransform: "uppercase",
  },
  cardDetails: {
    padding: 10,
    flex: 1,
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0d1b5e",
  },
  productCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0d1b5e",
  },
  tryBadge: {
    backgroundColor: "#fdde59",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tryText: {
    fontSize: 7.5,
    fontWeight: "900",
    color: "#0d1b5e",
    textTransform: "uppercase",
  },
  cartFloatingWrapper: {
    position: "absolute",
    top: -100, // Safe hiding spot or we render cart standard on navigation
    right: 16,
    zIndex: 10,
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

const chipStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "#0d1b5e",
    borderColor: "#0d1b5e",
  },
  pillInactive: {
    backgroundColor: "rgba(13,27,94,0.04)",
    borderColor: "rgba(13,27,94,0.05)",
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: "700",
  },
  pillTxtActive: { color: "#ffffff" },
  pillTxtInactive: { color: "rgba(13,27,94,0.7)" },
});
