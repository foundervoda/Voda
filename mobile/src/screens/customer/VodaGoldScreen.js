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
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/useAuthStore";

// Easy to update Benefits Component with premium visual layout
function GoldBenefitsList() {
  const benefits = [
    {
      icon: "bicycle",
      title: "Free Instant Delivery",
      desc: "Enjoy unlimited free delivery on all orders in under 35 minutes.",
    },
    {
      icon: "shirt",
      title: "Unlimited Try & Buy",
      desc: "Try eligible apparel and sneakers at your door for 10 minutes. Only pay for what you keep.",
    },
    {
      icon: "chatbubble-ellipses",
      title: "24/7 Priority Support",
      desc: "Instant live agent chat support and priority runner assistance.",
    },
    {
      icon: "sparkles",
      title: "Exclusive Store Invites",
      desc: "Early access to trending limited editions and premium local mall drops.",
    },
  ];

  return (
    <View style={s.benefitsContainer}>
      {benefits.map((b, i) => (
        <View key={i} style={s.benefitCard}>
          <View style={s.iconContainer}>
            <Ionicons name={b.icon} size={20} color="#012a62" />
          </View>
          <View style={s.benefitTextContainer}>
            <Text style={s.benefitTitle}>{b.title}</Text>
            <Text style={s.benefitDesc}>{b.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function VodaGoldScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const isGold = !!(user?.email?.toLowerCase() ?? "").includes("gold");

  const handleToggleSubscription = async () => {
    setLoading(true);
    try {
      let currentEmail = user?.email || "";
      const isCurrentlyGold = currentEmail.toLowerCase().includes("gold");
      
      let newEmail;
      if (isCurrentlyGold) {
        newEmail = currentEmail.replace(/_gold/gi, "").replace(/gold/gi, "");
      } else {
        const parts = currentEmail.split("@");
        newEmail = `${parts[0]}_gold@${parts[1]}`;
      }
      
      await updateProfile({
        email: newEmail,
        phone: user?.phone || "1234567890",
      });

      Alert.alert(
        "Success",
        isCurrentlyGold
          ? "You have successfully downgraded to Standard Tier."
          : "Welcome to Voda Gold! Enjoy free delivery and Try & Buy."
      );
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not update subscription");
    } finally {
      setLoading(false);
    }
  };

  const getRenewalDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <LinearGradient colors={["#fdf9ea", "#ffffff"]} style={s.root}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header Back Button */}
      <View style={[s.headerNav, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable 
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]} 
          onPress={() => navigation.goBack()} 
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color="#012a62" />
        </Pressable>
        <Text style={s.headerNavTitle}>Voda Gold</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero Section */}
        <View style={s.hero}>
          <View style={s.goldSealOuterRing}>
            <LinearGradient
              colors={["#ffe681", "#d4af37"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.goldSeal}
            >
              <Ionicons name="sparkles" size={34} color="#001838" />
            </LinearGradient>
          </View>

          <Text style={s.heroTitle}>VODA GOLD</Text>
          <Text style={s.heroSub}>The Ultimate Mall Delivery Experience</Text>

          {isGold ? (
            <View style={s.statusPill}>
              <Text style={s.statusText}>ACTIVE MEMBER</Text>
            </View>
          ) : (
            <View style={s.priceTagContainer}>
              <Text style={s.priceTag}>Just ₹199 / month</Text>
            </View>
          )}
        </View>

        <View style={s.body}>
          {isGold ? (
            /* Subscriber view info card (Luxury Dark VIP Pass design) */
            <LinearGradient
              colors={["#012a62", "#001e47"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.infoCardGold}
            >
              <View style={s.infoCardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="sparkles" size={16} color="#fdde59" style={{ marginRight: 6 }} />
                  <Text style={s.infoCardHeaderTitle}>VODA GOLD VIP PASS</Text>
                </View>
                <Text style={s.infoCardHeaderStatus}>ACTIVE</Text>
              </View>
              
              <View style={s.infoCardDivider} />
              
              <View style={s.infoCardBody}>
                <View style={s.infoCardRow}>
                  <Text style={s.infoCardLabel}>MEMBERSHIP PLAN</Text>
                  <Text style={s.infoCardValue}>Annual Delivery Pass</Text>
                </View>
                <View style={s.infoCardRow}>
                  <Text style={s.infoCardLabel}>RENEWAL DATE</Text>
                  <Text style={s.infoCardValue}>{getRenewalDate()}</Text>
                </View>
                <View style={s.infoCardRow}>
                  <Text style={s.infoCardLabel}>BILLING STATUS</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="checkmark-circle" size={14} color="#22c55e" style={{ marginRight: 4 }} />
                    <Text style={[s.infoCardValue, { color: "#22c55e" }]}>Active via Voda Pay</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          ) : null}

          <Text style={s.sectionTitle}>Membership Benefits</Text>
          
          <GoldBenefitsList />

          {/* Action CTA */}
          {isGold ? (
            <Pressable
              style={({ pressed }) => [
                s.ctaBtnDowngrade,
                pressed && s.ctaBtnDowngradePressed,
                loading && s.btnDisabled
              ]}
              onPress={handleToggleSubscription}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#012a62" />
              ) : (
                <Text style={s.ctaTextDowngrade}>Cancel Membership</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                s.ctaBtn,
                pressed && s.ctaBtnPressed,
                loading && s.btnDisabled
              ]}
              onPress={handleToggleSubscription}
              disabled={loading}
            >
              <LinearGradient
                colors={["#ffe681", "#d4af37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.ctaBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#001e47" />
                ) : (
                  <Text style={s.ctaText}>UPGRADE TO GOLD NOW</Text>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {!isGold ? (
            <Text style={s.termsText}>
              Billed monthly. Cancel anytime in account settings. Terms & Conditions apply.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(1, 42, 98, 0.05)",
    borderColor: "rgba(1, 42, 98, 0.1)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: {
    backgroundColor: "rgba(1, 42, 98, 0.12)",
  },
  headerNavTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  goldSealOuterRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(253, 222, 89, 0.12)",
    borderColor: "rgba(253, 222, 89, 0.25)",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#d4af37",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  goldSeal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#012a62",
    letterSpacing: 3,
    marginBottom: 6,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(1, 42, 98, 0.7)",
    textAlign: "center",
    marginBottom: 18,
  },
  priceTagContainer: {
    borderRadius: 20,
    backgroundColor: "rgba(1, 42, 98, 0.04)",
    borderColor: "rgba(1, 42, 98, 0.08)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: "800",
    color: "#012a62",
    letterSpacing: 0.5,
  },
  statusPill: {
    borderColor: "rgba(22, 163, 74, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  body: {
    paddingHorizontal: 20,
  },
  infoCardGold: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#012a62",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoCardHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#fdde59",
    letterSpacing: 1.5,
  },
  infoCardHeaderStatus: {
    fontSize: 10,
    fontWeight: "900",
    color: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 1,
  },
  infoCardDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 14,
  },
  infoCardBody: {
    gap: 10,
  },
  infoCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoCardLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  infoCardValue: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(1, 42, 98, 0.5)",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  benefitsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(1, 42, 98, 0.06)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#012a62",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(253, 222, 89, 0.15)",
    borderColor: "rgba(253, 222, 89, 0.3)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#012a62",
    marginBottom: 3,
  },
  benefitDesc: {
    fontSize: 13,
    color: "rgba(1, 42, 98, 0.6)",
    lineHeight: 18,
    fontWeight: "500",
  },
  ctaBtn: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#d4af37",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaBtnPressed: {
    opacity: 0.9,
  },
  ctaBtnGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDowngrade: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  ctaBtnDowngradePressed: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  ctaText: {
    color: "#001838",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
  ctaTextDowngrade: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  termsText: {
    fontSize: 11,
    color: "rgba(1, 42, 98, 0.4)",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 15,
  },
});
