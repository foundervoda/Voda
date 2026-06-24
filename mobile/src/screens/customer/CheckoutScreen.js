import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "../../store/useOrderStore";
import { useAuthStore } from "../../store/useAuthStore";
import { formatRupees as formatRupeePrice } from "../../utils/price";

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cart, placeOrder } = useOrderStore();
  const { user, address: savedAddress } = useAuthStore();

  const [address, setAddress] = useState(savedAddress || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tbSelected, setTbSelected] = useState(false);
  const isGoldSubscriber = !!(user?.email?.toLowerCase() ?? "").includes("gold");

  // Partition/Check eligibility
  const hasEligible = cart.some(
    (item) => item.category?.toLowerCase() === "sneakers" || item.category?.toLowerCase() === "apparel"
  );
  const hasIneligible = cart.some(
    (item) => item.category?.toLowerCase() === "boots"
  );
  const noneEligible = !hasEligible;

  // If Gold, T&B is automatically active on all eligible items.
  // Standard members choose via toggle.
  const isTryAndBuy = isGoldSubscriber ? hasEligible : (tbSelected && hasEligible);

  // Fee calculation
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = isGoldSubscriber ? 0 : 150;
  const tryAndBuyFee = (!isGoldSubscriber && isTryAndBuy) ? 99 : 0;
  const totalAmount = subtotal + deliveryFee + tryAndBuyFee;

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      setError("Please enter a delivery address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const order = await placeOrder(address.trim(), isGoldSubscriber, isTryAndBuy);
      navigation.replace("OrderConfirm", { order });
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? "Could not place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]} showsVerticalScrollIndicator={false}>
        
        {/* Subscription Tier Banner */}
        {isGoldSubscriber ? (
          <View style={s.goldBanner}>
            <View style={s.bannerIconCircleGold}>
              <Ionicons name="sparkles" size={16} color="#012a62" />
            </View>
            <View style={s.bannerTextWrap}>
              <Text style={s.goldBannerTitle}>Voda Gold Member</Text>
              <Text style={s.goldBannerDesc}>
                Free delivery & automatic Try & Buy are active on this order.
              </Text>
            </View>
          </View>
        ) : (
          <Pressable style={s.standardBanner} onPress={() => navigation.navigate("VodaGold")}>
            <View style={s.bannerIconCircleStandard}>
              <Ionicons name="star-outline" size={16} color="#012a62" />
            </View>
            <View style={s.bannerTextWrap}>
              <Text style={s.standardBannerTitle}>Standard Account</Text>
              <Text style={s.standardBannerDesc}>
                Upgrade to Voda Gold for free delivery & free Try & Buy. Tap to view benefits →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Delivery Address Card */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Delivery Address</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Gate 3, Block B, Apartment 12, Mall Road"
            placeholderTextColor="#012a6250"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Order Summary / Items Card */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Order Summary</Text>
          {cart.map((item) => {
            const isItemEligible =
              item.category?.toLowerCase() === "sneakers" ||
              item.category?.toLowerCase() === "apparel";
            return (
              <View key={item.variantId} style={s.summaryRowItem}>
                <View style={s.summaryItemInfo}>
                  <Text style={s.summaryItemName}>
                    {item.name}
                    {item.size ? ` (Size ${item.size})` : ""}
                  </Text>
                  <Text style={s.summaryItemSub}>
                    Qty: {item.quantity} • {item.storeName || "Store"}
                  </Text>
                  {isTryAndBuy && (
                    isItemEligible ? (
                      <View style={s.eligibleBadge}>
                        <Ionicons name="checkmark-circle-outline" size={12} color="#16a34a" />
                        <Text style={s.eligibleBadgeText}>T&B Eligible</Text>
                      </View>
                    ) : (
                      <View style={s.ineligibleBadge}>
                        <Ionicons name="alert-circle-outline" size={12} color="#dc2626" />
                        <Text style={s.ineligibleBadgeText}>T&B not available for this item</Text>
                      </View>
                    )
                  )}
                </View>
                <Text style={s.summaryPrice}>
                  ₹{formatRupeePrice(item.price * item.quantity)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Try & Buy Info Card (Gold vs Standard) */}
        {isGoldSubscriber ? (
          <View style={[s.sectionCard, s.tbGoldCard]}>
            <View style={s.tbHeaderRow}>
              <Ionicons name="shirt" size={20} color="#012a62" />
              <Text style={s.tbCardTitleGold}>Gold Try & Buy Benefit</Text>
            </View>
            <Text style={s.tbCardDescGold}>
              {hasEligible
                ? "Try & Buy has been applied automatically to eligible items at no cost. Try them at your door for up to 10 mins. Keep and pay only for what fits!"
                : "You have free Try & Buy, but none of the items in your basket are eligible (Boots are ineligible for Try & Buy)."}
            </Text>
          </View>
        ) : (
          <View style={s.sectionCard}>
            {noneEligible ? (
              <View>
                <View style={s.tbHeaderRow}>
                  <Ionicons name="alert-circle-outline" size={20} color="#012a6260" />
                  <Text style={[s.tbToggleTitle, { marginLeft: 8, color: "#012a6280" }]}>Try & Buy Unavailable</Text>
                </View>
                <Text style={[s.tbToggleDesc, { marginTop: 6 }]}>
                  None of the items in your cart are eligible for Try & Buy. Sneakers and Apparel are eligible, but Boots are not.
                </Text>
              </View>
            ) : (
              <View>
                <View style={s.tbToggleRow}>
                  <View style={s.tbToggleTextContainer}>
                    <Text style={s.tbToggleTitle}>Opt-in to Try & Buy</Text>
                    <Text style={s.tbToggleDesc}>
                      Try eligible items at your door for 10 minutes. Pay only for what you keep! (₹99 fee applies)
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setTbSelected(!tbSelected)}
                    style={[
                      s.toggleContainer,
                      tbSelected ? s.toggleContainerActive : s.toggleContainerInactive,
                    ]}
                  >
                    <View
                      style={[
                        s.toggleKnob,
                        tbSelected ? s.toggleKnobActive : s.toggleKnobInactive,
                      ]}
                    />
                  </Pressable>
                </View>

                {hasIneligible && tbSelected && (
                  <View style={s.mixedNoticeContainer}>
                    <Ionicons name="warning-outline" size={14} color="#ea580c" style={{ marginRight: 6 }} />
                    <Text style={s.mixedNoticeText}>
                      T&B applies only to Sneakers & Apparel. Boots will be kept automatically.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Pricing Breakdown Card */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Price Details</Text>
          
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Subtotal</Text>
            <Text style={s.breakdownValue}>₹{formatRupeePrice(subtotal)}</Text>
          </View>

          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Delivery Fee</Text>
            {isGoldSubscriber ? (
              <View style={s.priceWrap}>
                <Text style={s.strikeThroughPrice}>₹150</Text>
                <Text style={s.freeText}>FREE</Text>
              </View>
            ) : (
              <Text style={s.breakdownValue}>₹150</Text>
            )}
          </View>

          {isTryAndBuy && (
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Try & Buy Fee</Text>
              {isGoldSubscriber ? (
                <Text style={s.freeText}>FREE</Text>
              ) : (
                <Text style={s.breakdownValue}>₹99</Text>
              )}
            </View>
          )}

          <View style={s.priceDivider} />
          
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Amount</Text>
            <Text style={s.totalValue}>₹{formatRupeePrice(totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Mock Details */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Payment</Text>
          <Text style={s.paymentSubtitle}>Secure checkout powered by Voda Pay</Text>
          <View style={s.mockCardContainer}>
            <View style={s.mockCardRow}>
              <Ionicons name="card" size={24} color="#fdde59" style={{ marginRight: 12 }} />
              <View>
                <Text style={s.mockCardNumber}>•••• •••• •••• 4242</Text>
                <Text style={s.mockCardExpiry}>Expiry 12/28</Text>
              </View>
            </View>
            <View style={s.mockBadge}>
              <Text style={s.mockBadgeText}>PROTOTYPE</Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={s.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Place Order Action */}
        <Pressable
          style={[s.placeOrderBtn, loading && s.btnDisabled]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#012a62" />
          ) : (
            <>
              <Text style={s.placeOrderBtnText}>Place Order • ₹{formatRupeePrice(totalAmount)}</Text>
              <Ionicons name="arrow-forward" size={18} color="#012a62" style={{ marginLeft: 6 }} />
            </>
          )}
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#012a6210",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#012a62",
  },
  content: {
    padding: 20,
  },
  // Banners
  goldBanner: {
    flexDirection: "row",
    backgroundColor: "#fffbeb",
    borderColor: "#fdde59",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#fdde59",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerIconCircleGold: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fdde59",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  standardBanner: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  bannerIconCircleStandard: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bannerTextWrap: {
    flex: 1,
  },
  goldBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 2,
  },
  goldBannerDesc: {
    fontSize: 12,
    color: "#012a62b0",
    fontWeight: "600",
    lineHeight: 16,
  },
  standardBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 2,
  },
  standardBannerDesc: {
    fontSize: 12,
    color: "#012a6280",
    fontWeight: "600",
    lineHeight: 16,
  },
  // Cards
  sectionCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 16,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#012a6215",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#012a62",
    backgroundColor: "#ffffff",
    minHeight: 70,
    textAlignVertical: "top",
    fontWeight: "600",
  },
  // Summary Item Row
  summaryRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#012a6205",
    paddingBottom: 12,
  },
  summaryItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  summaryItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#012a62",
    marginBottom: 3,
  },
  summaryItemSub: {
    fontSize: 12,
    color: "#012a6260",
    fontWeight: "600",
    marginBottom: 6,
  },
  eligibleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a10",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eligibleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
    marginLeft: 4,
  },
  ineligibleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc262610",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ineligibleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#dc2626",
    marginLeft: 4,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#012a62",
    marginTop: 2,
  },
  // Try & Buy Custom Cards
  tbGoldCard: {
    backgroundColor: "#fffdf0",
    borderColor: "#fdde5950",
    borderWidth: 1,
  },
  tbHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tbCardTitleGold: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
    marginLeft: 8,
  },
  tbCardDescGold: {
    fontSize: 12,
    color: "#012a62a0",
    fontWeight: "500",
    lineHeight: 17,
  },
  tbWarningCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a550",
    borderWidth: 1,
  },
  tbCardTitleWarning: {
    fontSize: 14,
    fontWeight: "800",
    color: "#dc2626",
    marginLeft: 8,
  },
  tbCardDescWarning: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "500",
    lineHeight: 17,
  },
  // Toggle Row (Standard User)
  tbToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tbToggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  tbToggleTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
  },
  tbToggleDesc: {
    fontSize: 12,
    color: "#012a6280",
    fontWeight: "500",
    lineHeight: 16,
  },
  toggleContainer: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: "center",
  },
  toggleContainerActive: {
    backgroundColor: "#fdde59",
    borderWidth: 1,
    borderColor: "#012a6240",
  },
  toggleContainerInactive: {
    backgroundColor: "#e2e8f0",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 1.5,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
    backgroundColor: "#012a62",
  },
  toggleKnobInactive: {
    transform: [{ translateX: 0 }],
  },
  mixedNoticeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#012a6205",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  mixedNoticeText: {
    fontSize: 11,
    color: "#012a6280",
    fontWeight: "600",
    flex: 1,
    lineHeight: 14,
  },
  // Breakdown
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#012a6270",
    fontWeight: "600",
  },
  breakdownValue: {
    fontSize: 13,
    color: "#012a62",
    fontWeight: "700",
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  strikeThroughPrice: {
    fontSize: 13,
    color: "#012a6250",
    textDecorationLine: "line-through",
    marginRight: 6,
    fontWeight: "600",
  },
  freeText: {
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "800",
  },
  priceDivider: {
    height: 1,
    backgroundColor: "#012a620c",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 15,
    color: "#012a62",
    fontWeight: "800",
  },
  totalValue: {
    fontSize: 18,
    color: "#012a62",
    fontWeight: "900",
  },
  // Payment
  paymentSubtitle: {
    fontSize: 12,
    color: "#012a6260",
    fontWeight: "600",
    marginBottom: 12,
  },
  mockCardContainer: {
    backgroundColor: "#012a62",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mockCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mockCardNumber: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  mockCardExpiry: {
    color: "#ffffff60",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  mockBadge: {
    backgroundColor: "#fdde5925",
    borderColor: "#fdde5950",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mockBadgeText: {
    color: "#fdde59",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  // Button
  placeOrderBtn: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  placeOrderBtnText: {
    color: "#012a62",
    fontWeight: "900",
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
