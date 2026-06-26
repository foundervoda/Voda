import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";

const CATEGORIES = ["All", "Sneakers", "Apparel", "Boots"];

const getProductImage = (item) => {
  const basePath = "http://localhost:3001";
  const imgPath = item?.images?.[0] || item?.imageUrl || item?.image;
  if (!imgPath) return null;
  return imgPath.startsWith("http") ? { uri: imgPath } : { uri: `${basePath}${imgPath}` };
};

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async (queryText = searchQuery) => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory !== "All") {
        params.category = selectedCategory;
      }
      if (queryText.trim()) {
        params.q = queryText.trim();
      }

      const res = await api.get("/products", { params });
      setProducts(res.data?.data?.products || res.data?.products || []);
    } catch (err) {
      console.log("Failed to fetch search products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    fetchProducts();
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    fetchProducts("");
  };

  const renderProductCard = ({ item }) => {
    const roundedPrice = Math.round(Number(item.price) || 0);
    const formattedPrice = roundedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const imageSource = getProductImage(item);

    return (
      <Pressable
        style={s.card}
        onPress={() => navigation.navigate("ProductDetail", { productId: item.id, id: item.id })}
      >
        <View style={s.imageContainer}>
          {imageSource ? (
            <Image source={imageSource} style={s.image} resizeMode="cover" />
          ) : (
            <View style={s.fallbackImage}>
              <Ionicons name="image-outline" size={32} color="#012a6230" />
            </View>
          )}
          <View style={s.categoryBadge}>
            <Text style={s.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>

        <View style={s.cardInfo}>
          <Text style={s.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={s.store} numberOfLines={1}>
            🏬 {item.store?.name || "Partner Store"}
          </Text>
          <Text style={s.price}>₹{formattedPrice}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header Title */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Browse Products</Text>
        <Text style={s.headerSubtitle}>Discover collections across all mall outlets</Text>
      </View>

      {/* Search Input */}
      <View style={s.searchContainer}>
        <View style={s.searchWrapper}>
          <Ionicons name="search" size={18} color="#012a62" style={s.searchIcon} />
          <TextInput
            placeholder="Search footwear, jackets, zara luxe..."
            placeholderTextColor="rgba(1, 42, 98, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            clearButtonMode="never"
            style={s.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch} style={s.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#012a62" style={{ opacity: 0.6 }} />
            </Pressable>
          ) : (
            <Pressable onPress={handleSearchSubmit} style={s.searchBtn}>
              <Ionicons name="arrow-forward-circle" size={24} color="#012a62" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories Horizonal Selector */}
      <View style={s.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={s.categoriesScroll}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item)}
                style={[s.categoryTab, isActive && s.categoryTabActive]}
              >
                <Text style={[s.categoryTabText, isActive && s.categoryTabTextActive]}>
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Product List Grid */}
      {loading ? (
        <View style={s.loaderContainer}>
          <ActivityIndicator size="large" color="#012a62" />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={s.listContent}
          columnWrapperStyle={s.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#012a62" style={{ opacity: 0.3, marginBottom: 12 }} />
              <Text style={s.emptyText}>No products match your filters</Text>
              <Text style={s.emptySubText}>Try searching for something else or clearing the search</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#012a62",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#012a6260",
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#012a6210",
  },
  searchIcon: {
    marginRight: 10,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    height: 52,
    fontSize: 14.5,
    color: "#012a62",
    fontWeight: "600",
  },
  clearBtn: {
    padding: 6,
  },
  searchBtn: {
    padding: 2,
  },
  categoriesContainer: {
    marginBottom: 14,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: "row",
  },
  categoryTab: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#012a6208",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryTabActive: {
    backgroundColor: "#012a62",
    borderColor: "#012a62",
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "750",
    color: "#012a62a0",
  },
  categoryTabTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 14,
  },
  card: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#012a6206",
    overflow: "hidden",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  imageContainer: {
    width: "100%",
    height: 140,
    backgroundColor: "rgba(1, 42, 98, 0.02)",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(1, 42, 98, 0.75)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardInfo: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: "750",
    color: "#012a62",
  },
  store: {
    fontSize: 11,
    color: "#012a6260",
    fontWeight: "600",
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: "850",
    color: "#012a62",
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
  },
  emptySubText: {
    fontSize: 12,
    color: "#012a6250",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
});
