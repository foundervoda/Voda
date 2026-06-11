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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useOrderStore } from "../../store/useOrderStore";

// Seamless fallback mock data aligned with database seeds
const FALLBACK_PRODUCTS = [
  {
    id: "prod-air-runner",
    name: "Air Runner Max",
    price: 89.99,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop",
    category: "Footwear",
    trending: true,
    store: { name: "SNEAKER HOUSE", location: "Level 1, Unit 12" }
  },
  {
    id: "prod-cloud-walker",
    name: "Cloud Walker Pro",
    price: 119.99,
    imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop",
    category: "Footwear",
    trending: true,
    store: { name: "SNEAKER HOUSE", location: "Level 1, Unit 12" }
  },
  {
    id: "prod-retro-court",
    name: "Retro Court Classic",
    price: 79.99,
    imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&auto=format&fit=crop",
    category: "Footwear",
    trending: true,
    store: { name: "URBAN THREADS", location: "Level 2, Unit 7" }
  },
  {
    id: "prod-urban-hiker",
    name: "Urban Hiker Boot",
    price: 149.90,
    imageUrl: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop",
    category: "Footwear",
    trending: true,
    store: { name: "URBAN THREADS", location: "Level 2, Unit 7" }
  },
  {
    id: "prod-trench-coat",
    name: "Signature Trench Coat",
    price: 149.90,
    image: "/images/shoes/air-runner.png",
    category: "Apparel",
    trending: false,
    store: { name: "URBAN THREADS", location: "Level 2, Unit 7" }
  },
  {
    id: "prod-knit-hoodie",
    name: "Oversized Knit Hoodie",
    price: 79.99,
    image: "/images/shoes/cloud-walker.png",
    category: "Apparel",
    trending: false,
    store: { name: "URBAN THREADS", location: "Level 2, Unit 7" }
  }
];

const convertToPremiumRupees = (rawPrice) => {
  const price = Number(rawPrice) || 0;
  if (price === 0) return 0;
  
  if (Math.abs(price - 149.90) < 0.1) return 11990;
  if (Math.abs(price - 79.99) < 0.1) return 6399;
  if (Math.abs(price - 89.99) < 0.1) return 7199;
  if (Math.abs(price - 119.99) < 0.1) return 9599;

  const inrBase = price * 80;
  return Math.round(inrBase / 100) * 100 - 1;
};

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Clean image URI resolver connecting local path strings to backend port
const getProductImage = (item) => {
  const basePath = "http://localhost:3001";
  const imgPath = item?.images?.[0] || item?.imageUrl || item?.image;
  
  if (!imgPath) return null;
  return imgPath.startsWith("http") ? { uri: imgPath } : { uri: `${basePath}${imgPath}` };
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Sneakers", "Boots", "Apparel"];

  // Get active cart state to dynamically render a notification/badge
  const cart = useOrderStore((s) => s.cart || []);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const addToCart = useOrderStore((s) => s.addToCart);

  // React Query hook targeting GET /products
  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((res) => res.data?.data?.products || res.data?.products),
    retry: false,
  });

  // Decide whether to use loaded products or fall back
  const baseProducts = products && products.length > 0 ? products : FALLBACK_PRODUCTS;

  // Filter base products reactively based on user search query and category selection
  const displayedProducts = baseProducts.filter((product) => {
    // 1. Search Query Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchSearch =
        product.name?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.store?.name?.toLowerCase().includes(query);
      if (!matchSearch) return false;
    }

    // 2. Category Chip Filter
    if (selectedCategory !== "All") {
      const categoryLower = product.category?.toLowerCase() || "";
      const nameLower = product.name?.toLowerCase() || "";
      
      if (selectedCategory === "Sneakers") {
        return categoryLower === "footwear" && !nameLower.includes("boot") && !nameLower.includes("hiker");
      }
      if (selectedCategory === "Boots") {
        return categoryLower === "footwear" && (nameLower.includes("boot") || nameLower.includes("hiker"));
      }
      if (selectedCategory === "Apparel") {
        return categoryLower === "apparel";
      }
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
    const premiumPrice = convertToPremiumRupees(price);

    return (
      <Pressable
        onPress={() => navigation.navigate("ProductDetail", { productId: item.id })}
        style={styles.iosCardShadow}
        className="flex-1 bg-white m-2 rounded-2xl overflow-hidden border border-brand-blue/[0.03] active:opacity-90 active:scale-[0.98] transition-transform duration-100"
      >
        {/* Product Image */}
        <View className="relative h-44 w-full bg-brand-blue/[0.02]">
          {imageSource ? (
            <Image
              source={imageSource}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-blue/[0.03]">
              <Ionicons name="image-outline" size={24} color="#012a62" style={{ opacity: 0.3 }} />
            </View>
          )}
          {item.trending && (
            <View className="absolute top-2.5 left-2.5 bg-brand-accent px-2 py-0.5 rounded-full shadow-xs">
              <Text className="text-[9px] font-extrabold text-brand-blue uppercase tracking-wide">
                🔥 Trending
              </Text>
            </View>
          )}
        </View>

        {/* Card Details */}
        <View className="p-3.5 flex-1 justify-between">
          <View className="mb-2">
            {/* Store Name (medium weight typography hierarchy) */}
            <Text className="text-[10px] font-medium text-brand-blue/50 uppercase tracking-widest mb-1">
              {item.store?.name || "Voda Store"}
            </Text>
            {/* Product Title (prominent bold title) */}
            <Text 
              numberOfLines={1} 
              className="text-sm font-bold text-brand-blue tracking-tight"
            >
              {item.name}
            </Text>
          </View>

          {/* Pricing & Tag Banner */}
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-base font-extrabold text-brand-blue">
              ₹{formatRupeePrice(premiumPrice)}
            </Text>
            
            {/* Brand Accent Highlights Try & Buy Eligible */}
            <View className="bg-brand-accent px-2 py-0.5 rounded-full border border-brand-accent/20 flex-row items-center space-x-1 shadow-xs">
              <Ionicons name="shirt" size={8} color="#012a62" />
              <Text className="text-[8px] font-black text-brand-blue uppercase tracking-wider">
                Try & Buy
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View 
      style={{ paddingTop: Math.max(insets.top, 12) }} 
      className="flex-1 bg-brand-light"
    >
      <StatusBar barStyle="dark-content" />

      {/* Header section with generous spacing */}
      <View className="px-4 pt-5 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xs font-black text-brand-blue/40 uppercase tracking-widest mb-0.5">
            Welcome to Voda
          </Text>
          <Text className="text-3xl font-black text-brand-blue tracking-tight">
            Trending Products
          </Text>
        </View>
        
        {/* Quick Cart Shortcut Icon with Native Badge */}
        <Pressable 
          onPress={() => navigation.navigate("Cart")}
          className="h-11 w-11 rounded-full bg-white border border-brand-blue/10 items-center justify-center shadow-sm active:opacity-80 active:scale-95 transition-all relative"
        >
          <Ionicons name="cart" size={20} color="#012a62" />
          {cartCount > 0 && (
            <View className="absolute -top-1.5 -right-1.5 bg-brand-accent border border-brand-light rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center">
              <Text className="text-[9px] font-black text-brand-blue">
                {cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Premium iOS-style search bar with subtle background color and alignments */}
      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-brand-blue/[0.04] border border-brand-blue/[0.08] rounded-2xl px-4 py-3">
          <Ionicons name="search" size={18} color="#012a62" style={{ opacity: 0.6, marginRight: 8 }} />
          <TextInput
            placeholder="Search products, stores, brands..."
            placeholderTextColor="rgba(1, 42, 98, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            className="flex-1 text-brand-blue text-sm font-semibold p-0"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} className="p-0.5 active:opacity-60">
              <Ionicons name="close-circle" size={16} color="#012a62" style={{ opacity: 0.6 }} />
            </Pressable>
          ) : (
            <Ionicons name="options-outline" size={18} color="#012a62" style={{ opacity: 0.6 }} />
          )}
        </View>
      </View>

      {/* Premium iOS Scrolling Category Filter Bar */}
      <View className="mb-5 pl-4">
        <FlatList
          horizontal
          data={categories}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        />
      </View>

      {/* Try & Buy Info Header Banner */}
      <View className="mx-4 mb-6 bg-brand-blue/[0.03] border border-brand-blue/[0.08] rounded-2xl p-4 flex-row items-center space-x-3.5 shadow-xs">
        <View className="bg-brand-accent h-10 w-10 rounded-full items-center justify-center shadow-xs">
          <Ionicons name="shirt" size={18} color="#012a62" />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-black text-brand-blue uppercase tracking-wider mb-0.5">
            Voda Try before you pay
          </Text>
          <Text className="text-[11px] text-brand-blue/75 leading-relaxed font-semibold">
            Try items at your doorstep for 10 minutes before finalizing payment.
          </Text>
        </View>
      </View>

      {/* Loading State */}
      {isLoading && displayedProducts.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#012a62" />
        </View>
      )}

      {/* Product List Grid */}
      <FlatList
        data={displayedProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={!!isLoading}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="alert-circle-outline" size={48} color="#012a62" className="opacity-40 mb-2" />
            <Text className="text-sm font-bold text-brand-blue opacity-50">No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iosCardShadow: {
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
});

// Static styles for category chips — avoids NativeWind dynamic className + React Nav v7 bug
const chipStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "#012a62",
    borderColor: "#012a62",
  },
  pillInactive: {
    backgroundColor: "rgba(1,42,98,0.04)",
    borderColor: "rgba(1,42,98,0.05)",
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  pillTxtActive: { color: "#ffffff" },
  pillTxtInactive: { color: "rgba(1,42,98,0.7)" },
});
