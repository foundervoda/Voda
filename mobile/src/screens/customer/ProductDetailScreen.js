import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "../../store/useOrderStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Premium High-Conversion Mock Product Data
const MOCK_PRODUCT = {
  id: "mock-voda-trench",
  name: "Signature Belted Trench Coat",
  price: 149.90,
  originalPrice: 199.00,
  category: "Apparel",
  store: {
    name: "Zara",
    location: "Level 1, South Wing",
    eta: "25-35 mins",
  },
  rating: 4.8,
  reviewsCount: 86,
  description: "A classic belted trench coat made of water-repellent technical fabric. Features a lapel collar, long sleeves with adjustable buttoned cuffs, front welt pockets, and a matching self-tie belt to cinch the silhouette.",
  images: [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop",
  ],
  sizes: [
    { value: "XS", status: "IN_STOCK" },
    { value: "S", status: "LOW_STOCK", stock: 2 },
    { value: "M", status: "OUT_OF_STOCK" },
    { value: "L", status: "IN_STOCK" },
    { value: "XL", status: "IN_STOCK" },
  ],
  details: [
    "Water-repellent technical fabric",
    "Double-breasted button closure at front",
    "Adjustable cuffs with buttoned tabs",
    "100% premium cotton inner lining",
  ],
  care: [
    "Do not machine wash",
    "Do not bleach",
    "Iron at low temp (Max 110°C / 230°F)",
    "Dry clean with common solvents",
    "Do not tumble dry",
  ]
};

export default function ProductDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const productId = route?.params?.productId;

  // React Query fetch for real integration, fails/skips gracefully to mock data
  const { data: apiProductResponse, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api.get(`/products/${productId}`).then((r) => r.data?.data || r.data),
    enabled: !!productId,
    retry: false,
  });

  const addToCart = useOrderStore((s) => s.addToCart);

  // Fallback to MOCK_PRODUCT if apiProduct is not yet loaded/failed
  const product = apiProductResponse || MOCK_PRODUCT;

  // Normalize API product data to match our schema
  const productData = {
    id: product.id || MOCK_PRODUCT.id,
    name: product.name || MOCK_PRODUCT.name,
    price: Number(product.price) || MOCK_PRODUCT.price,
    originalPrice: product.originalPrice || (Number(product.price) ? (Number(product.price) * 1.25) : MOCK_PRODUCT.originalPrice),
    category: product.category || MOCK_PRODUCT.category,
    images: product.images && product.images.length > 0 ? product.images : MOCK_PRODUCT.images,
    store: product.store || MOCK_PRODUCT.store,
    rating: product.rating || MOCK_PRODUCT.rating,
    reviewsCount: product.reviewsCount || MOCK_PRODUCT.reviewsCount,
    description: product.description || MOCK_PRODUCT.description,
    details: product.details || MOCK_PRODUCT.details,
    care: product.care || MOCK_PRODUCT.care,
    variants: product.variants || null,
  };

  // Resolve sizes from API variants OR mock data sizes
  const sizeOptions = productData.variants && productData.variants.length > 0
    ? productData.variants.map((v) => ({
        id: v.id,
        value: v.size,
        status: v.stock === 0 ? "OUT_OF_STOCK" : v.stock <= 2 ? "LOW_STOCK" : "IN_STOCK",
        stock: v.stock,
      }))
    : MOCK_PRODUCT.sizes;

  // State Management
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Collapsible Accordion States
  const [accordions, setAccordions] = useState({
    details: true,
    policy: false,
    shipping: false,
  });

  const toggleAccordion = (section) => {
    setAccordions((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleScroll = (event) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (slide !== currentImageIndex) {
      setCurrentImageIndex(slide);
    }
  };

  const selectedSizeObj = sizeOptions.find((s) => s.value === selectedSize);
  const isSizeOutOfStock = selectedSizeObj?.status === "OUT_OF_STOCK";

  const handleAddToCart = () => {
    if (!selectedSize) {
      Alert.alert("Select Size", "Please select a size to experience Voda Try & Buy.");
      return;
    }
    
    addToCart({
      id: `${productData.id}-${selectedSize}`,
      productId: productData.id,
      name: productData.name,
      price: productData.price,
      size: selectedSize,
      image: productData.images[0],
      storeName: productData.store.name,
    });

    triggerToast(`Added size ${selectedSize} to cart! Try it at your door.`);
  };

  const handleNotifyMe = () => {
    if (!selectedSize) {
      Alert.alert("Select Size", "Please select a size first.");
      return;
    }
    triggerToast(`Restock alert set for size ${selectedSize}!`);
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3500);
  };

  if (isLoading && productId) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
      {/* Floating Header */}
      <View 
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-4"
      >
        <Pressable
          onPress={() => navigation?.goBack()}
          className="h-10 w-10 rounded-full bg-white/95 items-center justify-center shadow-md shadow-black/10 active:opacity-80"
        >
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </Pressable>
        
        <Pressable
          onPress={() => setIsWishlisted(!isWishlisted)}
          className="h-10 w-10 rounded-full bg-white/95 items-center justify-center shadow-md shadow-black/10 active:opacity-80"
        >
          <Ionicons 
            name={isWishlisted ? "heart" : "heart-outline"} 
            size={20} 
            color={isWishlisted ? "#f43f5e" : "#1e293b"} 
          />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Image Carousel */}
        <View className="relative">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            decelerationRate="fast"
            style={{ width: SCREEN_WIDTH, height: 420 }}
          >
            {productData.images.map((imgUrl, index) => (
              <Image
                key={index}
                source={{ uri: imgUrl }}
                style={{ width: SCREEN_WIDTH, height: 420 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Dots Indicator */}
          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center space-x-1.5">
            {productData.images.map((_, index) => (
              <View
                key={index}
                className={`h-2 rounded-full ${
                  currentImageIndex === index ? "bg-emerald-500 w-5" : "bg-white/60 w-2"
                }`}
              />
            ))}
          </View>
        </View>

        {/* Product Details Section */}
        <View className="px-5 pt-6">
          {/* Store Name & Location */}
          <View className="flex-row items-center mb-1.5">
            <Text className="text-xs font-semibold text-emerald-600 tracking-wider uppercase">
              {productData.store.name}
            </Text>
            <View className="h-1.5 w-1.5 rounded-full bg-gray-300 mx-2" />
            <Text className="text-xs text-gray-500 font-medium">
              {productData.store.location}
            </Text>
          </View>

          {/* Product Name */}
          <Text className="text-2xl font-bold text-slate-800 tracking-tight leading-tight mb-2.5">
            {productData.name}
          </Text>

          {/* Rating & Fast Shipping ETA */}
          <View className="flex-row items-center justify-between mb-5 border-b border-gray-100 pb-4">
            <View className="flex-row items-center">
              <View className="flex-row mr-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.floor(productData.rating) ? "star" : "star-outline"}
                    size={15}
                    color="#f59e0b"
                  />
                ))}
              </View>
              <Text className="text-xs font-bold text-slate-700">{productData.rating}</Text>
              <Text className="text-xs text-gray-400 font-medium ml-1">({productData.reviewsCount} reviews)</Text>
            </View>

            <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <Ionicons name="flash" size={13} color="#10b981" style={{ marginRight: 4 }} />
              <Text className="text-xs font-bold text-slate-700">ETA {productData.store.eta}</Text>
            </View>
          </View>

          {/* Price Block */}
          <View className="flex-row items-baseline mb-6">
            <Text className="text-3xl font-extrabold text-slate-900 mr-2.5">
              ${productData.price.toFixed(2)}
            </Text>
            {productData.originalPrice > productData.price && (
              <>
                <Text className="text-sm font-medium text-gray-400 line-through mr-3">
                  ${productData.originalPrice.toFixed(2)}
                </Text>
                <View className="bg-emerald-50 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">
                    {Math.round(((productData.originalPrice - productData.price) / productData.originalPrice) * 100)}% Off
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Voda Try & Buy Signature Banner */}
          <View className="bg-emerald-50 border border-emerald-100/80 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-1.5">
              <View className="bg-emerald-500 rounded-full p-1 mr-2">
                <Ionicons name="shirt" size={12} color="#ffffff" />
              </View>
              <Text className="text-emerald-800 font-bold text-xs uppercase tracking-wider">
                Voda Try & Buy Eligible
              </Text>
            </View>
            <Text className="text-emerald-700 text-xs leading-relaxed font-medium">
              Try before you pay! Get delivery in 25-35 mins. Try the size at your door for up to 10 minutes. Only pay for what you decide to keep.
            </Text>
          </View>

          {/* Responsive Size Selector */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-bold text-slate-800 uppercase tracking-wider">Select Size</Text>
              <Pressable className="active:opacity-75">
                <Text className="text-xs font-bold text-emerald-600">Size Guide</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap gap-2.5">
              {sizeOptions.map((size) => {
                const isSelected = selectedSize === size.value;
                const isOutOfStock = size.status === "OUT_OF_STOCK";
                const isLowStock = size.status === "LOW_STOCK";

                return (
                  <Pressable
                    key={size.value}
                    onPress={() => setSelectedSize(size.value)}
                    className={`h-12 w-12 rounded-xl items-center justify-center border ${
                      isSelected
                        ? "bg-emerald-500 border-emerald-500 shadow-sm"
                        : isOutOfStock
                        ? "bg-gray-50/50 border-gray-200 border-dashed opacity-45"
                        : "bg-white border-gray-200 active:border-gray-400"
                    }`}
                  >
                    <Text
                      className={`font-bold text-sm ${
                        isSelected
                          ? "text-white"
                          : isOutOfStock
                          ? "text-gray-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {size.value}
                    </Text>
                    {isLowStock && !isSelected && (
                      <View className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 border border-white" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Dynamic Status / Warning Label */}
            {selectedSize && (() => {
              if (selectedSizeObj?.status === "LOW_STOCK") {
                return (
                  <View className="flex-row items-center mt-3 bg-amber-50/70 border border-amber-100 rounded-lg py-2 px-3">
                    <Ionicons name="warning-outline" size={13} color="#d97706" style={{ marginRight: 6 }} />
                    <Text className="text-[11px] font-semibold text-amber-700">
                      Hurry! Only {selectedSizeObj.stock} left in stock.
                    </Text>
                  </View>
                );
              }
              if (selectedSizeObj?.status === "OUT_OF_STOCK") {
                return (
                  <View className="flex-row items-center mt-3 bg-slate-50 border border-slate-200/60 rounded-lg py-2 px-3">
                    <Ionicons name="notifications-outline" size={13} color="#64748b" style={{ marginRight: 6 }} />
                    <Text className="text-[11px] font-semibold text-slate-500">
                      Out of stock. Select "Notify Me" below to get alerts.
                    </Text>
                  </View>
                );
              }
              return (
                <View className="flex-row items-center mt-3 bg-emerald-50/40 border border-emerald-100/50 rounded-lg py-2 px-3">
                  <Ionicons name="checkmark-circle-outline" size={13} color="#10b981" style={{ marginRight: 6 }} />
                  <Text className="text-[11px] font-semibold text-emerald-700">
                    Size is in stock & ready for Try & Buy delivery.
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Premium Info Accordions */}
          <View className="border-t border-gray-100 mt-4 pt-1">
            {/* Description Accordion */}
            <Pressable
              onPress={() => toggleAccordion("details")}
              className="flex-row justify-between items-center py-4 border-b border-gray-100"
            >
              <Text className="text-sm font-bold text-slate-800">Description & Details</Text>
              <Ionicons
                name={accordions.details ? "chevron-up" : "chevron-down"}
                size={18}
                color="#64748b"
              />
            </Pressable>
            {accordions.details && (
              <View className="py-2.5">
                <Text className="text-xs text-gray-500 leading-relaxed mb-4">
                  {productData.description}
                </Text>
                <View className="space-y-2">
                  {productData.details.map((detail, idx) => (
                    <View key={idx} className="flex-row items-center mb-2">
                      <Ionicons name="checkmark" size={12} color="#10b981" style={{ marginRight: 8 }} />
                      <Text className="text-xs text-slate-600 font-medium">{detail}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Try & Buy Guarantee Accordion */}
            <Pressable
              onPress={() => toggleAccordion("policy")}
              className="flex-row justify-between items-center py-4 border-b border-gray-100"
            >
              <Text className="text-sm font-bold text-slate-800">Voda Try & Buy Policy</Text>
              <Ionicons
                name={accordions.policy ? "chevron-up" : "chevron-down"}
                size={18}
                color="#64748b"
              />
            </Pressable>
            {accordions.policy && (
              <View className="py-2.5 space-y-2">
                <Text className="text-xs text-gray-500 leading-relaxed">
                  Voda gives you a premium, zero-risk shopping experience:
                </Text>
                <View className="flex-row items-start mt-2 mb-2">
                  <Text className="text-emerald-500 text-xs font-bold mr-2">1.</Text>
                  <Text className="text-xs text-slate-600 leading-relaxed flex-1">
                    Your runner will bring the item directly to your door in 25-35 minutes.
                  </Text>
                </View>
                <View className="flex-row items-start mb-2">
                  <Text className="text-emerald-500 text-xs font-bold mr-2">2.</Text>
                  <Text className="text-xs text-slate-600 leading-relaxed flex-1">
                    You have up to <Text className="font-bold">10 minutes</Text> to try on the clothing.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-emerald-500 text-xs font-bold mr-2">3.</Text>
                  <Text className="text-xs text-slate-600 leading-relaxed flex-1">
                    Keep and pay for only what fits. Give the unwanted items back to the runner immediately. No return shipping labels, no waiting for refunds.
                  </Text>
                </View>
              </View>
            )}

            {/* Shipping & Delivery Accordion */}
            <Pressable
              onPress={() => toggleAccordion("shipping")}
              className="flex-row justify-between items-center py-4 border-b border-gray-100"
            >
              <Text className="text-sm font-bold text-slate-800">Express Delivery & Returns</Text>
              <Ionicons
                name={accordions.shipping ? "chevron-up" : "chevron-down"}
                size={18}
                color="#64748b"
              />
            </Pressable>
            {accordions.shipping && (
              <View className="py-2.5">
                <Text className="text-xs text-gray-500 leading-relaxed">
                  All Voda orders are dispatched instantly from local stores in the shopping mall. Your runner collects, bags, and hands off the package to the delivery rider in real time. We guarantee arrival at your doorstep in under 35 minutes. Instant hassle-free returns right at your doorstep.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Dynamic Feedback Toast */}
      {showToast && (
        <View className="absolute bottom-28 left-5 right-5 z-50 bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 flex-row items-center justify-between shadow-xl">
          <View className="flex-row items-center flex-1 pr-2">
            <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginRight: 8 }} />
            <Text className="text-white text-xs font-medium leading-tight flex-1">
              {toastMessage}
            </Text>
          </View>
          {!isSizeOutOfStock && (
            <Pressable 
              onPress={() => navigation?.navigate("Cart")}
              className="bg-emerald-500 px-3 py-1.5 rounded-lg active:bg-emerald-600"
            >
              <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                View Cart
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Premium Sticky Bottom Action Bar */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 px-4 pt-3 flex-row items-center justify-between shadow-2xl z-40"
      >
        <View className="mr-5">
          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Price</Text>
          <Text className="text-2xl font-extrabold text-slate-800 leading-tight">
            ${productData.price.toFixed(2)}
          </Text>
        </View>

        {isSizeOutOfStock ? (
          <Pressable
            onPress={handleNotifyMe}
            className="flex-1 h-12 bg-slate-800 rounded-xl items-center justify-center flex-row shadow-lg shadow-slate-900/10 active:bg-slate-900"
          >
            <Ionicons name="notifications" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text className="text-white font-bold text-xs uppercase tracking-wide">
              Notify Me
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleAddToCart}
            className="flex-1 h-12 bg-emerald-500 rounded-xl items-center justify-center flex-row shadow-lg shadow-emerald-500/25 active:bg-emerald-600"
          >
            <Ionicons name="cart" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text className="text-white font-bold text-xs uppercase tracking-wide">
              Add to Cart
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
