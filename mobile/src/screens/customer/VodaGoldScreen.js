import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/useAuthStore";

const TIERS = ["Free", "Gold", "Platinum"];

const TIERS_DATA = {
  Free: {
    name: "Free Standard",
    price: "₹0",
    period: "/ month",
    tagline: "Basic mall ordering",
    icon: "person-outline",
    accentColor: "#64748b",
    gradientColors: ["#f1f5f9", "#e2e8f0"],
    textColor: "#334155",
    matrix: [
      { icon: "bicycle-outline",   label: "Delivery Fee",         value: "₹99 per order" },
      { icon: "timer-outline",     label: "T&B Trial Time",       value: "10 minutes" },
      { icon: "ticket-outline",    label: "T&B Fee",              value: "₹149 per trial" },
      { icon: "storefront-outline",label: "Stores per Order",     value: "1 store max" },
      { icon: "location-outline",  label: "Zone Access",          value: "Local zone only" },
    ],
    benefits: [
      "Standard delivery in 45–60 mins",
      "Try & Buy for ₹149 fee",
      "1 store per order",
      "Limited to local zone",
    ],
  },
  Gold: {
    name: "Voda Gold",
    price: "₹199",
    period: "/ month",
    tagline: "VIP Shopping & Fast Returns",
    icon: "sparkles",
    accentColor: "#b8860b",
    gradientColors: ["#fef9c3", "#fde68a"],
    textColor: "#78350f",
    matrix: [
      { icon: "bicycle-outline",   label: "Delivery Fee",         value: "FREE" },
      { icon: "timer-outline",     label: "T&B Trial Time",       value: "15 minutes" },
      { icon: "ticket-outline",    label: "T&B Fee",              value: "FREE" },
      { icon: "storefront-outline",label: "Stores per Order",     value: "Up to 3 stores" },
      { icon: "location-outline",  label: "Zone Access",          value: "1 zone switch/month" },
    ],
    benefits: [
      "Unlimited FREE delivery",
      "Unlimited FREE Try & Buy",
      "Up to 3 stores per order",
      "1 zone switch per month",
      "Priority customer support",
    ],
  },
  Platinum: {
    name: "Voda Platinum",
    price: "₹399",
    period: "/ month",
    tagline: "The Ultimate Mall VIP",
    icon: "diamond-outline",
    accentColor: "#fdde59",
    gradientColors: ["#1e3a8a", "#0f172a"],
    textColor: "#ffffff",
    matrix: [
      { icon: "bicycle-outline",   label: "Delivery Fee",         value: "FREE (Priority)" },
      { icon: "timer-outline",     label: "T&B Trial Time",       value: "20 minutes" },
      { icon: "ticket-outline",    label: "T&B Fee",              value: "FREE" },
      { icon: "storefront-outline",label: "Stores per Order",     value: "Up to 5 stores" },
      { icon: "location-outline",  label: "Zone Access",          value: "Unlimited zones" },
    ],
    benefits: [
      "Priority FREE delivery",
      "Extended 20-min Try & Buy",
      "Up to 5 stores per order",
      "Unlimited multi-zone access",
      "VIP early access & stock drops",
    ],
  },
};

export default function VodaGoldScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  let currentTier = "Free";
  if (user?.email?.toLowerCase().includes("platinum")) currentTier = "Platinum";
  else if (user?.email?.toLowerCase().includes("gold")) currentTier = "Gold";

  const [activeTab, setActiveTab] = useState(currentTier);

  const handleSelectTier = async (tierName) => {
    if (tierName === currentTier) return;
    setLoading(true);
    try {
      let clean = (user?.email || "")
        .replace(/_platinum/gi, "").replace(/platinum/gi, "")
        .replace(/_gold/gi, "").replace(/gold/gi, "");
      const [local, domain] = clean.split("@");
      const newEmail =
        tierName === "Gold" ? `${local}_gold@${domain}` :
        tierName === "Platinum" ? `${local}_platinum@${domain}` :
        clean;
      await updateProfile({ email: newEmail, phone: user?.phone || "1234567890" });
      Alert.alert("Plan Updated", `You are now on the ${tierName} plan!`);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not update plan");
    } finally {
      setLoading(false);
    }
  };

  const tier = TIERS_DATA[activeTab];
  const isCurrentPlan = activeTab === currentTier;
  const isPlatinum = activeTab === "Platinum";

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* iOS-style Navigation Bar */}
      <View style={[s.navBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          hitSlop={12}
          style={({ pressed }) => [s.navBackBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-back" size={24} color="#012a62" />
        </Pressable>
        <Text style={s.navTitle}>Membership</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* iOS Segmented Control */}
      <View style={s.segmentWrapper}>
        <View style={s.segmentControl}>
          {TIERS.map((t) => {
            const active = activeTab === t;
            const isCurrent = currentTier === t;
            return (
              <Pressable
                key={t}
                onPress={() => setActiveTab(t)}
                style={[s.segment, active && s.segmentActive]}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]}>
                  {t}
                </Text>
                {isCurrent && <View style={[s.segmentDot, active && { backgroundColor: "#fdde59" }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 32) + 20 }]}
      >
        {/* Hero Card */}
        <LinearGradient
          colors={tier.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <View style={s.heroTop}>
            <View style={[s.heroIconWrap, isPlatinum && s.heroIconWrapPlatinum]}>
              <Ionicons name={tier.icon} size={28} color={isPlatinum ? "#fdde59" : "#012a62"} />
            </View>
            <View style={s.heroMeta}>
              <Text style={[s.heroName, { color: tier.textColor }]}>{tier.name}</Text>
              <Text style={[s.heroTagline, { color: isPlatinum ? "rgba(255,255,255,0.65)" : "#64748b" }]}>
                {tier.tagline}
              </Text>
            </View>
          </View>

          <View style={s.heroPriceRow}>
            <View>
              <Text style={[s.heroPrice, { color: tier.textColor }]}>
                {tier.price}
                <Text style={[s.heroPeriod, { color: isPlatinum ? "rgba(255,255,255,0.5)" : "#94a3b8" }]}>
                  {" "}{tier.period}
                </Text>
              </Text>
            </View>
            {isCurrentPlan && (
              <View style={s.currentBadge}>
                <Text style={s.currentBadgeText}>CURRENT PLAN</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Plan Details — iOS-style grouped list */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>PLAN DETAILS</Text>
          <View style={s.card}>
            {tier.matrix.map((row, idx) => (
              <View key={row.label} style={[s.row, idx < tier.matrix.length - 1 && s.rowBorder]}>
                <View style={s.rowLeft}>
                  <View style={s.rowIconWrap}>
                    <Ionicons name={row.icon} size={15} color="#fdde59" />
                  </View>
                  <Text style={s.rowLabel}>{row.label}</Text>
                </View>
                <Text style={[s.rowValue, row.value === "FREE" && s.rowValueFree]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Key Benefits */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>KEY BENEFITS</Text>
          <View style={s.card}>
            {tier.benefits.map((b, idx) => (
              <View key={idx} style={[s.benefitRow, idx < tier.benefits.length - 1 && s.rowBorder]}>
                <View style={s.benefitCheck}>
                  <Ionicons name="checkmark" size={13} color="#ffffff" />
                </View>
                <Text style={s.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        {isCurrentPlan ? (
          <View style={s.activePlanBox}>
            <Ionicons name="shield-checkmark" size={22} color="#16a34a" />
            <Text style={s.activePlanText}>Your {currentTier} plan is active</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.5 }]}
            onPress={() => handleSelectTier(activeTab)}
            disabled={loading}
          >
            <LinearGradient
              colors={isPlatinum ? ["#1e3a8a", "#0f172a"] : ["#fde68a", "#f59e0b"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.ctaGradient}
            >
              {loading ? (
                <ActivityIndicator color={isPlatinum ? "#fdde59" : "#012a62"} />
              ) : (
                <>
                  <Text style={[s.ctaText, isPlatinum && { color: "#fdde59" }]}>
                    {activeTab === "Free" ? "Switch to Free" : `Upgrade to ${activeTab}`}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={isPlatinum ? "#fdde59" : "#012a62"}
                    style={{ marginLeft: 8 }}
                  />
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  // Navigation Bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: "#fdf9ea",
  },
  navBackBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(1, 42, 98, 0.06)",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#012a62",
    letterSpacing: -0.4,
  },
  // Segmented Control (exact iOS style)
  segmentWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#fdf9ea",
  },
  segmentControl: {
    flexDirection: "row",
    backgroundColor: "rgba(1, 42, 98, 0.08)",
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  segmentActive: {
    backgroundColor: "#012a62",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#012a62",
    letterSpacing: -0.1,
    opacity: 0.65,
  },
  segmentTextActive: {
    fontWeight: "700",
    color: "#fdde59",
    opacity: 1,
  },
  segmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fdde59",
  },
  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // Hero Card
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  heroIconWrapPlatinum: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  heroPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroPrice: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -1,
  },
  heroPeriod: {
    fontSize: 14,
    fontWeight: "400",
  },
  currentBadge: {
    backgroundColor: "rgba(22, 163, 74, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.3)",
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 0.5,
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#012a62",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    opacity: 0.55,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  // Matrix Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c6c6c8",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3c3c43",
    textAlign: "right",
    flexShrink: 0,
  },
  rowValueFree: {
    color: "#012a62",
    fontWeight: "800",
  },
  // Benefits
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  benefitCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    flex: 1,
  },
  // Active plan
  activePlanBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#012a62",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  activePlanText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fdde59",
  },
  // CTA
  ctaBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    letterSpacing: -0.3,
  },
});
