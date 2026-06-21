import React, { useState, useEffect } from "react";
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
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "../../store/useOrderStore";
import { useActiveOrder } from "../../hooks/useActiveOrder";
import { api } from "../../api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Premium Brand-aligned Fallback Mock Product Data (rendered only if route parameters or fetch fail)
const MOCK_PRODUCTS_LIST = [
  {
    id: "prod-air-runner",
    name: "Air Runner Max",
    price: 89.99,
    originalPrice: 119.99,
    category: "Sneakers",
    store: {
      name: "SNEAKER HOUSE",
      location: "Level 1, Unit 12",
      eta: "15-25 mins",
    },
    rating: 4.6,
    reviewsCount: 42,
    description: "Premium running sneakers featuring responsive cushioning and breathable mesh upper for maximum daily comfort.",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop",
    sizes: [
      { value: "7", status: "IN_STOCK" },
      { value: "8", status: "LOW_STOCK", stock: 2 },
      { value: "9", status: "OUT_OF_STOCK" },
      { value: "10", status: "IN_STOCK" },
    ],
    details: ["Responsive cushioning technology", "Breathable mesh knit upper", "Durable rubber outsole"],
    care: ["Wipe with damp cloth", "Air dry only"],
  },
  {
    id: "prod-cloud-walker",
    name: "Cloud Walker Pro",
    price: 119.99,
    originalPrice: 159.99,
    category: "Sneakers",
    store: {
      name: "SNEAKER HOUSE",
      location: "Level 1, Unit 12",
      eta: "20-30 mins",
    },
    rating: 4.9,
    reviewsCount: 112,
    description: "Walk on clouds with our advanced foam midsole technology. Designed for long walks and standing comfort.",
    imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop",
    sizes: [
      { value: "8", status: "IN_STOCK" },
      { value: "9", status: "IN_STOCK" },
      { value: "10", status: "LOW_STOCK", stock: 1 },
    ],
    details: ["Advanced foam midsole", "Sleek low-top profile", "Padded collar and tongue"],
    care: ["Hand wash recommended"],
  },
  {
    id: "prod-retro-court",
    name: "Retro Court Classic",
    price: 79.99,
    originalPrice: 99.99,
    category: "Sneakers",
    store: {
      name: "URBAN THREADS",
      location: "Level 2, Unit 7",
      eta: "15-25 mins",
    },
    rating: 4.5,
    reviewsCount: 38,
    description: "A classic retro court shoe constructed from premium materials. Durability and style built for the street.",
    imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&auto=format&fit=crop",
    sizes: [
      { value: "7", status: "IN_STOCK" },
      { value: "8", status: "IN_STOCK" },
      { value: "9", status: "IN_STOCK" },
    ],
    details: ["Premium leather upper", "Cushioned footbed", "Classic cupsole construction"],
    care: ["Wipe clean with leather cleaner"],
  },
  {
    id: "prod-urban-hiker",
    name: "Urban Hiker Boot",
    price: 149.90,
    originalPrice: 199.00,
    category: "Boots",
    store: {
      name: "URBAN THREADS",
      location: "Level 2, Unit 7",
      eta: "25-35 mins",
    },
    rating: 4.8,
    reviewsCount: 76,
    description: "Rugged and durable hiker boot redesigned for the urban landscape. Supportive, comfortable, and weather-resistant.",
    imageUrl: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop",
    sizes: [
      { value: "8", status: "IN_STOCK" },
      { value: "9", status: "LOW_STOCK", stock: 1 },
      { value: "10", status: "OUT_OF_STOCK" },
      { value: "11", status: "IN_STOCK" },
    ],
    details: ["Weather-resistant construction", "Rust-proof speed lacing system", "Traction rubber outsole"],
    care: ["Clean with suede brush", "Treat with protective spray"],
  },
  {
    id: "prod-trench-coat",
    name: "Signature Trench Coat",
    price: 149.90,
    originalPrice: 199.00,
    category: "Apparel",
    store: {
      name: "URBAN THREADS",
      location: "Level 2, Unit 7",
      eta: "25-35 mins",
    },
    rating: 4.8,
    reviewsCount: 86,
    description: "A classic belted trench coat made of water-repellent technical fabric. Features a lapel collar, long sleeves with adjustable buttoned cuffs, front welt pockets, and a matching self-tie belt to cinch the silhouette.",
    image: "/images/shoes/air-runner.png",
    sizes: [
      { value: "XS", status: "IN_STOCK" },
      { value: "S", status: "LOW_STOCK", stock: 2 },
      { value: "M", status: "OUT_OF_STOCK" },
      { value: "L", status: "IN_STOCK" },
      { value: "XL", status: "IN_STOCK" },
    ],
    details: ["Water-repellent technical fabric", "Double-breasted button closure", "Adjustable cuffs"],
    care: ["Dry clean only"],
  },
  {
    id: "prod-knit-hoodie",
    name: "Oversized Knit Hoodie",
    price: 79.99,
    originalPrice: 99.99,
    category: "Apparel",
    store: {
      name: "URBAN THREADS",
      location: "Level 2, Unit 7",
      eta: "15-25 mins",
    },
    rating: 4.5,
    reviewsCount: 38,
    description: "An oversized hoodie knit from premium cotton blend. Ultra soft brushed interior for ultimate warmth.",
    image: "/images/shoes/cloud-walker.png",
    sizes: [
      { value: "S", status: "IN_STOCK" },
      { value: "M", status: "IN_STOCK" },
      { value: "L", status: "IN_STOCK" },
    ],
    details: ["Premium cotton blend", "Brushed fleece interior", "Oversized fit"],
    care: ["Machine wash cold"],
  }
];

const MOCK_PRODUCT = MOCK_PRODUCTS_LIST[0];

const convertToPremiumRupees = (rawPrice) => {
  const price = Number(rawPrice) || 0;
  if (price === 0) return 0;
  if (price > 1000) return price; // Already in Rupees!
  
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

const getProductImage = (item) => {
  const basePath = "http://localhost:3001";
  const imgPath = item?.images?.[0] || item?.imageUrl || item?.image;
  
  if (!imgPath) return null;
  return imgPath.startsWith("http") ? { uri: imgPath } : { uri: `${basePath}${imgPath}` };
};

export default function ProductDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const productId = route?.params ? (route.params.productId || route.params.id) : null;

  const [apiProduct, setApiProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(!!productId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setIsLoading(true);
    setError(null);
    api
      .get(`/products/${productId}`)
      .then((res) => {
        const data = res.data;
        setApiProduct(data?.data?.product || data?.product || data);
      })
      .catch((err) => {
        console.warn("[ProductDetailScreen] API fetch failed, falling back to mock product data.", err.message);
        setApiProduct(MOCK_PRODUCTS_LIST.find((p) => p.id === productId) || MOCK_PRODUCT);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [productId]);

  const addToCart = useOrderStore((s) => s.addToCart);
  const activeBannerOrder = useActiveOrder();

  // State Management (Unconditionally declared at the absolute top)
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Collapsible Accordion States (Unconditionally declared at the absolute top)
  const [accordions, setAccordions] = useState({
    details: true,
    policy: false,
    shipping: false,
  });

  const [recProducts, setRecProducts] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    const activeProductCat = apiProduct?.category || MOCK_PRODUCT.category;
    const activeProductId = productId || MOCK_PRODUCT.id;
    if (!activeProductCat) return;

    setRecLoading(true);
    api.post("/products/recommend", { query: activeProductCat })
      .then((res) => {
        const items = res.data?.data?.products || [];
        const filtered = items.filter(p => p.id !== activeProductId);
        setRecProducts(filtered);
      })
      .catch((err) => {
        console.warn("Failed to fetch personalized recommendations:", err.message);
        const filtered = MOCK_PRODUCTS_LIST.filter(p => p.category === activeProductCat && p.id !== activeProductId);
        setRecProducts(filtered);
      })
      .finally(() => {
        setRecLoading(false);
      });
  }, [productId, apiProduct]);

  // Early Return: Loading State (must sit below all Hook declarations)
  if (isLoading && productId) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-light">
        <ActivityIndicator size="large" color="#012a62" />
      </View>
    );
  }

  // Resolve active product: strictly use backend data if fetched, fallback to Mock when no route param is passed
  const activeProduct = productId ? apiProduct : MOCK_PRODUCT;

  // Early Return: Error/Missing State (must sit below all Hook declarations)
  if (productId && !isLoading && (!activeProduct || error)) {
    return (
      <View 
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} 
        className="flex-1 bg-brand-light items-center justify-center px-6"
      >
        <Ionicons name="alert-circle-outline" size={64} color="#012a62" className="mb-4" />
        <Text className="text-xl font-bold text-brand-blue text-center mb-2">
          Product Not Found
        </Text>
        <Text className="text-sm text-brand-blue/60 text-center mb-6">
          We couldn't retrieve the details for this item. It may have been removed or is currently unavailable.
        </Text>
        <Pressable
          onPress={() => navigation?.goBack()}
          className="bg-brand-blue px-6 py-3 rounded-xl shadow-md active:opacity-90"
        >
          <Text className="text-white font-bold text-sm tracking-wide">
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // Normalize product parameters mapping out the live database values dynamically
  const productData = {
    id: activeProduct?.id || MOCK_PRODUCT.id,
    name: activeProduct?.name || MOCK_PRODUCT.name,
    price: convertToPremiumRupees(activeProduct?.price || MOCK_PRODUCT.price),
    originalPrice: convertToPremiumRupees(
      activeProduct?.originalPrice || 
      (Number(activeProduct?.price) ? (Number(activeProduct?.price) * 1.25) : MOCK_PRODUCT.originalPrice)
    ),
    category: activeProduct?.category || MOCK_PRODUCT.category,
    images: (() => {
      if (Array.isArray(activeProduct?.images) && activeProduct.images.length > 0) {
        return activeProduct.images;
      }
      if (activeProduct?.imageUrl) {
        return [activeProduct.imageUrl];
      }
      if (activeProduct?.image) {
        return [activeProduct.image];
      }
      return [MOCK_PRODUCT.imageUrl || MOCK_PRODUCT.images?.[0]];
    })(),
    store: activeProduct?.store || MOCK_PRODUCT.store,
    rating: activeProduct?.rating || MOCK_PRODUCT.rating,
    reviewsCount: activeProduct?.reviewsCount || MOCK_PRODUCT.reviewsCount,
    description: activeProduct?.description || MOCK_PRODUCT.description,
    details: activeProduct?.details || MOCK_PRODUCT.details,
    care: activeProduct?.care || MOCK_PRODUCT.care,
    variants: activeProduct?.variants || null,
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

    if (!selectedSizeObj?.id) {
      Alert.alert("Error", "Product details failed to load. Go back and open the product again.");
      return;
    }

    addToCart({
      id: `${productData.id}-${selectedSize}`,
      productId: productData.id,
      variantId: selectedSizeObj?.id || `mock-variant-id-${selectedSize}`,
      name: productData.name,
      price: productData.price,
      size: selectedSize,
      image: getProductImage({ image: productData.images[0] })?.uri || productData.images[0],
      storeName: productData.store.name,
      category: productData.category,
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

  return (
    <View className="flex-1 bg-brand-light">
      <StatusBar barStyle="dark-content" />
      
      {/* Floating Header */}
      <View 
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-4"
      >
        <Pressable
          onPress={() => navigation?.goBack()}
          className="h-10 w-10 rounded-full bg-white/95 items-center justify-center shadow-md shadow-brand-blue/5 active:opacity-85"
        >
          <Ionicons name="chevron-back" size={24} color="#012a62" />
        </Pressable>
        
        <Pressable
          onPress={() => setIsWishlisted(!isWishlisted)}
          className="h-10 w-10 rounded-full bg-white/95 items-center justify-center shadow-md shadow-brand-blue/5 active:opacity-85"
        >
          <Ionicons 
            name={isWishlisted ? "heart" : "heart-outline"} 
            size={20} 
            color={isWishlisted ? "#f43f5e" : "#012a62"} 
          />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
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
            {productData.images.map((imgUrl, index) => {
              const imageSource = getProductImage({ image: imgUrl });
              return (
                <Image
                  key={index}
                  source={imageSource}
                  style={{ width: SCREEN_WIDTH, height: 420 }}
                  resizeMode="cover"
                />
              );
            })}
          </ScrollView>

          {/* Dots Indicator */}
          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center space-x-1.5">
            {productData.images.map((_, index) => (
              <View
                key={index}
                style={[
                  pdStyles.dot,
                  currentImageIndex === index ? pdStyles.dotActive : pdStyles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Product Details Section */}
        <View className="px-5 pt-6">
          {/* Store Name & Location */}
          <View className="flex-row items-center mb-1.5">
            <Text className="text-xs font-bold text-brand-blue/60 tracking-wider uppercase">
              {productData.store.name}
            </Text>
            <View className="h-1.5 w-1.5 rounded-full bg-brand-blue/20 mx-2" />
            <Text className="text-xs text-brand-blue/70 font-semibold">
              {productData.store.location}
            </Text>
          </View>

          {/* Product Name */}
          <Text className="text-2xl font-extrabold text-brand-blue tracking-tight leading-tight mb-2.5">
            {productData.name}
          </Text>

          {/* Rating & Fast Shipping ETA */}
          <View className="flex-row items-center justify-between mb-5 border-b border-brand-blue/10 pb-4">
            <View className="flex-row items-center">
              <View className="flex-row mr-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.floor(productData.rating) ? "star" : "star-outline"}
                    size={15}
                    color="#fdde59"
                  />
                ))}
              </View>
              <Text className="text-xs font-bold text-brand-blue">{productData.rating}</Text>
              <Text className="text-xs text-brand-blue/50 font-medium ml-1">({productData.reviewsCount} reviews)</Text>
            </View>

            <View className="flex-row items-center bg-brand-blue/5 px-3 py-1.5 rounded-lg border border-brand-blue/10">
              <Ionicons name="flash" size={13} color="#012a62" style={{ marginRight: 4 }} />
              <Text className="text-xs font-bold text-brand-blue">ETA {productData.store.eta || "25-35 mins"}</Text>
            </View>
          </View>

          {/* Price Block */}
          <View className="flex-row items-baseline mb-6">
            <Text className="text-3xl font-extrabold text-brand-blue mr-2.5">
              ₹{formatRupeePrice(productData.price)}
            </Text>
            {productData.originalPrice > productData.price && (
              <>
                <Text className="text-sm font-medium text-brand-blue/40 line-through mr-3">
                  ₹{formatRupeePrice(productData.originalPrice)}
                </Text>
                <View className="bg-brand-accent px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-black text-brand-blue uppercase tracking-wider">
                    {Math.round(((productData.originalPrice - productData.price) / productData.originalPrice) * 100)}% Off
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Voda Try & Buy Signature Banner */}
          <View className="bg-brand-blue/5 border border-brand-blue/10 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-1.5">
              <View className="bg-brand-blue rounded-full p-1 mr-2">
                <Ionicons name="shirt" size={12} color="#fdde59" />
              </View>
              <Text className="text-brand-blue font-extrabold text-xs uppercase tracking-wider">
                Voda Try & Buy Eligible
              </Text>
            </View>
            <Text className="text-brand-blue/80 text-xs leading-relaxed font-medium">
              Try before you pay! Get delivery in 25-35 mins. Try the size at your door for up to 10 minutes. Only pay for what you decide to keep.
            </Text>
          </View>

          {/* Responsive Size Selector */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-extrabold text-brand-blue uppercase tracking-wider">Select Size</Text>
              <Pressable className="active:opacity-75">
                <Text className="text-xs font-bold text-brand-blue/80">Size Guide</Text>
              </Pressable>
            </View>

            {sizeOptions.length === 0 ? (
              <Text className="text-xs text-brand-blue/60 italic">No sizing variant available for this product.</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2.5">
                {sizeOptions.map((size) => {
                  const isSelected = selectedSize === size.value;
                  const isOutOfStock = size.status === "OUT_OF_STOCK";
                  const isLowStock = size.status === "LOW_STOCK";

                  return (
                    <Pressable
                      key={size.value}
                      onPress={() => setSelectedSize(size.value)}
                      style={[
                        pdStyles.sizeBtn,
                        isSelected
                          ? pdStyles.sizeBtnSelected
                          : isOutOfStock
                          ? pdStyles.sizeBtnOOS
                          : pdStyles.sizeBtnDefault,
                      ]}
                    >
                      <Text
                        style={[
                          pdStyles.sizeTxt,
                          isSelected
                            ? pdStyles.sizeTxtSelected
                            : isOutOfStock
                            ? pdStyles.sizeTxtOOS
                            : pdStyles.sizeTxtDefault,
                        ]}
                      >
                        {size.value}
                      </Text>
                      {isLowStock && !isSelected && (
                        <View style={pdStyles.lowStockDot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Dynamic Status / Warning Label */}
            {selectedSize && (() => {
              if (selectedSizeObj?.status === "LOW_STOCK") {
                return (
                  <View className="flex-row items-center mt-3 bg-brand-accent/15 border border-brand-accent/55 rounded-lg py-2 px-3">
                    <Ionicons name="warning-outline" size={13} color="#012a62" style={{ marginRight: 6 }} />
                    <Text className="text-[11px] font-bold text-brand-blue">
                      Hurry! Only {selectedSizeObj.stock} left in stock.
                    </Text>
                  </View>
                );
              }
              if (selectedSizeObj?.status === "OUT_OF_STOCK") {
                return (
                  <View className="flex-row items-center mt-3 bg-brand-blue/5 border border-brand-blue/10 rounded-lg py-2 px-3">
                    <Ionicons name="notifications-outline" size={13} color="#012a62" style={{ marginRight: 6 }} />
                    <Text className="text-[11px] font-bold text-brand-blue/70">
                      Out of stock. Select "Notify Me" below to get alerts.
                    </Text>
                  </View>
                );
              }
              return (
                <View className="flex-row items-center mt-3 bg-brand-blue/5 border border-brand-blue/10 rounded-lg py-2 px-3">
                  <Ionicons name="checkmark-circle-outline" size={13} color="#012a62" style={{ marginRight: 6 }} />
                  <Text className="text-[11px] font-bold text-brand-blue">
                    Size is in stock & ready for Try & Buy delivery.
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Premium Info Accordions */}
          <View className="border-t border-brand-blue/10 mt-4 pt-1">
            {/* Description Accordion */}
            <Pressable
              onPress={() => toggleAccordion("details")}
              className="flex-row justify-between items-center py-4 border-b border-brand-blue/10"
            >
              <Text className="text-sm font-extrabold text-brand-blue">Description & Details</Text>
              <Ionicons
                name={accordions.details ? "chevron-up" : "chevron-down"}
                size={18}
                color="#012a62"
              />
            </Pressable>
            {accordions.details && (
              <View className="py-2.5">
                <Text className="text-xs text-brand-blue/70 leading-relaxed mb-4">
                  {productData.description}
                </Text>
                <View className="space-y-2">
                  {productData.details.map((detail, idx) => (
                    <View key={idx} className="flex-row items-center mb-2">
                      <Ionicons name="checkmark" size={12} color="#012a62" style={{ marginRight: 8 }} />
                      <Text className="text-xs text-brand-blue/90 font-semibold">{detail}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Try & Buy Guarantee Accordion */}
            <Pressable
              onPress={() => toggleAccordion("policy")}
              className="flex-row justify-between items-center py-4 border-b border-brand-blue/10"
            >
              <Text className="text-sm font-extrabold text-brand-blue">Voda Try & Buy Policy</Text>
              <Ionicons
                name={accordions.policy ? "chevron-up" : "chevron-down"}
                size={18}
                color="#012a62"
              />
            </Pressable>
            {accordions.policy && (
              <View className="py-2.5 space-y-2">
                <Text className="text-xs text-brand-blue/70 leading-relaxed">
                  Voda gives you a premium, zero-risk shopping experience:
                </Text>
                <View className="flex-row items-start mt-2 mb-2">
                  <Text className="text-brand-blue font-black text-xs mr-2">1.</Text>
                  <Text className="text-xs text-brand-blue/80 leading-relaxed flex-1">
                    Your runner will bring the item directly to your door in 25-35 minutes.
                  </Text>
                </View>
                <View className="flex-row items-start mb-2">
                  <Text className="text-brand-blue font-black text-xs mr-2">2.</Text>
                  <Text className="text-xs text-brand-blue/80 leading-relaxed flex-1">
                    You have up to <Text className="font-bold">10 minutes</Text> to try on the clothing.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-brand-blue font-black text-xs mr-2">3.</Text>
                  <Text className="text-xs text-brand-blue/80 leading-relaxed flex-1">
                    Keep and pay for only what fits. Give the unwanted items back to the runner immediately. No return shipping labels, no waiting for refunds.
                  </Text>
                </View>
              </View>
            )}

            {/* Shipping & Delivery Accordion */}
            <Pressable
              onPress={() => toggleAccordion("shipping")}
              className="flex-row justify-between items-center py-4 border-b border-brand-blue/10"
            >
              <Text className="text-sm font-extrabold text-brand-blue">Express Delivery & Returns</Text>
              <Ionicons
                name={accordions.shipping ? "chevron-up" : "chevron-down"}
                size={18}
                color="#012a62"
              />
            </Pressable>
            {accordions.shipping && (
              <View className="py-2.5">
                <Text className="text-xs text-brand-blue/70 leading-relaxed">
                  All Voda orders are dispatched instantly from local stores in the shopping mall. Your runner collects, bags, and hands off the package to the delivery rider in real time. We guarantee arrival at your doorstep in under 35 minutes. Instant hassle-free returns right at your doorstep.
                </Text>
              </View>
            )}
          </View>

          {/* Recommendations Section */}
          <View style={pdStyles.recSection}>
            <Text style={pdStyles.recSectionTitle}>Recommendations</Text>
            {recLoading ? (
              <ActivityIndicator size="small" color="#012a62" style={{ marginVertical: 20 }} />
            ) : recProducts.length === 0 ? (
              <Text style={pdStyles.recEmptyTxt}>No similar products found.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={pdStyles.recListContent}
              >
                {recProducts.map((item) => {
                  const imageSource = getProductImage(item);
                  const price = Number(item.price) || 0;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        navigation.push("ProductDetail", { productId: item.id });
                      }}
                      style={pdStyles.recCard}
                    >
                      <View style={pdStyles.recImageWrapper}>
                        {imageSource ? (
                          <Image source={imageSource} style={pdStyles.recProductImage} resizeMode="cover" />
                        ) : (
                          <View style={pdStyles.recFallbackImageBg}>
                            <Ionicons name="image-outline" size={20} color="#012a62" style={{ opacity: 0.3 }} />
                          </View>
                        )}
                      </View>
                      <Text numberOfLines={1} style={pdStyles.recProductName}>{item.name}</Text>
                      <Text style={pdStyles.recProductCategory}>{item.category}</Text>
                      <Text style={pdStyles.recProductPrice}>₹{formatRupeePrice(convertToPremiumRupees(price))}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Dynamic Feedback Toast */}
      {showToast && (
        <View className="absolute bottom-28 left-5 right-5 z-50 bg-brand-blue border border-brand-blue/10 rounded-xl px-4 py-3 flex-row items-center justify-between shadow-xl">
          <View className="flex-row items-center flex-1 pr-2">
            <Ionicons name="checkmark-circle" size={18} color="#fdde59" style={{ marginRight: 8 }} />
            <Text className="text-brand-light text-xs font-semibold leading-tight flex-1">
              {toastMessage}
            </Text>
          </View>
          {!isSizeOutOfStock && (
            <Pressable 
              onPress={() => navigation?.navigate("Cart")}
              className="bg-brand-accent px-3 py-1.5 rounded-lg active:opacity-90"
            >
              <Text className="text-brand-blue text-[10px] font-black uppercase tracking-wider">
                View Cart
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Premium Sticky Bottom Action Bar */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 16) + (activeBannerOrder ? 64 : 0) }}
        className="absolute bottom-0 left-0 right-0 border-t border-brand-blue/10 bg-brand-light/95 px-4 pt-3 flex-row items-center justify-between shadow-2xl z-40"
      >
        <View className="mr-5">
          <Text className="text-[10px] text-brand-blue/50 font-bold uppercase tracking-wider">Total Price</Text>
          <Text className="text-2xl font-black text-brand-blue leading-tight">
            ₹{formatRupeePrice(productData.price)}
          </Text>
        </View>

        {isSizeOutOfStock ? (
          <Pressable
            onPress={handleNotifyMe}
            style={pdStyles.actionBtnNotify}
          >
            <Ionicons name="notifications" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={pdStyles.actionTxtNotify}>
              Notify Me
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleAddToCart}
            style={pdStyles.actionBtnCart}
          >
            <Ionicons name="cart" size={16} color="#fdde59" style={{ marginRight: 6 }} />
            <Text style={pdStyles.actionTxtCart}>
              Add to Cart
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Static StyleSheet to avoid NativeWind dynamic className bug with React Navigation v7 + React 19
const pdStyles = StyleSheet.create({
  // Image carousel dots
  dot: { height: 8, borderRadius: 999 },
  dotActive: { width: 20, backgroundColor: "#012a62" },
  dotInactive: { width: 8, backgroundColor: "rgba(1,42,98,0.2)" },

  // Size selector buttons
  sizeBtn: {
    height: 48,
    width: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sizeBtnSelected: {
    backgroundColor: "#012a62",
    borderColor: "#012a62",
    shadowColor: "#012a62",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  sizeBtnOOS: {
    backgroundColor: "rgba(1,42,98,0.05)",
    borderColor: "rgba(1,42,98,0.2)",
    borderStyle: "dashed",
    opacity: 0.4,
  },
  sizeBtnDefault: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(1,42,98,0.25)",
  },

  // Size selector text
  sizeTxt: { fontWeight: "700", fontSize: 14 },
  sizeTxtSelected: { color: "#fdde59" },
  sizeTxtOOS: { color: "rgba(1,42,98,0.3)", textDecorationLine: "line-through" },
  sizeTxtDefault: { color: "#012a62" },

  // Low stock indicator dot
  lowStockDot: {
    position: "absolute",
    top: 4,
    right: 4,
    height: 8,
    width: 8,
    borderRadius: 999,
    backgroundColor: "#fdde59",
    borderWidth: 1,
    borderColor: "#ffffff",
  },

  // Bottom action buttons
  actionBtnCart: {
    flex: 1,
    height: 48,
    backgroundColor: "#012a62",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#012a62",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  actionTxtCart: {
    color: "#fdde59",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionBtnNotify: {
    flex: 1,
    height: 48,
    backgroundColor: "rgba(1,42,98,0.8)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#012a62",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  actionTxtNotify: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recSection: {
    marginTop: 24,
  },
  recSectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#012a62",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
  },
  recListContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  recCard: {
    width: 140,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 8,
    paddingBottom: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(1,42,98,0.06)",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  recImageWrapper: {
    width: "100%",
    height: 100,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(1,42,98,0.02)",
    marginBottom: 8,
  },
  recProductImage: {
    width: "100%",
    height: "100%",
  },
  recFallbackImageBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  recProductName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a62",
  },
  recProductCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginTop: 2,
  },
  recProductPrice: {
    fontSize: 12,
    fontWeight: "900",
    color: "#012a62",
    marginTop: 4,
  },
  recEmptyTxt: {
    fontSize: 12,
    color: "rgba(1,42,98,0.5)",
    fontStyle: "italic",
    marginVertical: 10,
  },
});
