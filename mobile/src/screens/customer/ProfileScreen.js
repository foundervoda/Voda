import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";
import { useSizingStore } from "../../store/useSizingStore";

function SectionHeader({ title }) {
  return <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>;
}

function GroupedRow({ icon, label, value, onPress, destructive, isLast }) {
  const content = (
    <View style={[s.groupRow, !isLast && s.groupRowBorder]}>
      {icon && (
        <View style={[s.groupRowIcon, destructive && s.groupRowIconDestructive]}>
          <Ionicons name={icon} size={16} color={destructive ? "#dc2626" : "#ffffff"} />
        </View>
      )}
      <Text style={[s.groupRowLabel, destructive && { color: "#dc2626" }]}>{label}</Text>
      {value ? <Text style={s.groupRowValue} numberOfLines={1}>{value}</Text> : null}
      {onPress && !destructive && (
        <Ionicons name="chevron-forward" size={16} color="#c7c7cc" style={{ marginLeft: 4 }} />
      )}
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: "#f2f2f7" }]}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, address: savedAddress, updateProfile, updateAddress, logout } = useAuthStore();
  const socket = useSocket();
  const savedSizes = useSizingStore();

  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setLocalAddress] = useState(savedAddress || "");
  const [password, setPassword] = useState("");
  const [sizeSneakers, setSizeSneakers] = useState(savedSizes.sizeSneakers || "");
  const [sizeApparel, setSizeApparel] = useState(savedSizes.sizeApparel || "");
  const [fitApparel, setFitApparel] = useState(savedSizes.fitApparel || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) { setEmail(user.email || ""); setPhone(user.phone || ""); }
  }, [user]);

  useEffect(() => {
    setSizeSneakers(savedSizes.sizeSneakers || "");
    setSizeApparel(savedSizes.sizeApparel || "");
    setFitApparel(savedSizes.fitApparel || "");
  }, [savedSizes.sizeSneakers, savedSizes.sizeApparel, savedSizes.fitApparel]);

  const isGold = !!(user?.email?.toLowerCase() ?? "").includes("gold");
  const isPlatinum = !!(user?.email?.toLowerCase() ?? "").includes("platinum");
  const tier = isPlatinum ? "Platinum" : isGold ? "Gold" : "Free";

  const tierColor = isPlatinum ? "#1e3a8a" : isGold ? "#b8860b" : "#64748b";
  const tierBg = isPlatinum ? "#dbeafe" : isGold ? "#fef9c3" : "#f1f5f9";

  const handleSave = async () => {
    if (!email.trim() || !phone.trim()) { setError("Email and Phone are required"); return; }
    setError(null);
    setLoading(true);
    try {
      const payload = { email: email.trim(), phone: phone.trim() };
      if (password.trim()) payload.password = password.trim();
      await updateProfile(payload);
      await updateAddress(address.trim());
      setPassword("");
      savedSizes.setSizes({
        sizeSneakers: sizeSneakers.trim(),
        sizeApparel: sizeApparel.trim(),
        fitApparel: fitApparel.trim(),
      });
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const initials = (user?.email || "U").substring(0, 2).toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Large Title Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={s.headerLargeTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 32) + 24 }]}
      >
        {/* Avatar Hero */}
        <View style={s.avatarSection}>
          <View style={[s.avatarCircle, { borderColor: tierColor }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.avatarEmail} numberOfLines={1}>{user?.email}</Text>
          <View style={[s.tierBadge, { backgroundColor: tierBg }]}>
            <Text style={[s.tierBadgeText, { color: tierColor }]}>
              {isPlatinum ? "✦ Voda Platinum" : isGold ? "★ Voda Gold" : "Free Plan"}
            </Text>
          </View>
        </View>

        {/* Membership */}
        <SectionHeader title="Membership" />
        <View style={s.card}>
          <GroupedRow
            icon={isGold || isPlatinum ? "sparkles" : "star-outline"}
            label={isPlatinum ? "Voda Platinum" : isGold ? "Voda Gold" : "Upgrade Plan"}
            value={isPlatinum ? "Active" : isGold ? "Active" : ""}
            onPress={() => navigation.navigate("VodaGold")}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account Details" />
        <View style={s.card}>
          <View style={[s.inputRow, s.groupRowBorder]}>
            <View style={[s.groupRowIcon, { backgroundColor: "#3b82f6" }]}>
              <Ionicons name="mail" size={16} color="#fff" />
            </View>
            <TextInput
              style={s.inlineInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#aeaeb2"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={[s.inputRow, s.groupRowBorder]}>
            <View style={[s.groupRowIcon, { backgroundColor: "#22c55e" }]}>
              <Ionicons name="call" size={16} color="#fff" />
            </View>
            <TextInput
              style={s.inlineInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone Number"
              placeholderTextColor="#aeaeb2"
              keyboardType="phone-pad"
            />
          </View>
          <View style={[s.inputRow, s.groupRowBorder]}>
            <View style={[s.groupRowIcon, { backgroundColor: "#f97316" }]}>
              <Ionicons name="location" size={16} color="#fff" />
            </View>
            <TextInput
              style={[s.inlineInput, { height: "auto", minHeight: 44 }]}
              value={address}
              onChangeText={setLocalAddress}
              placeholder="Delivery Address"
              placeholderTextColor="#aeaeb2"
              multiline
            />
          </View>
          <View style={s.inputRow}>
            <View style={[s.groupRowIcon, { backgroundColor: "#6366f1" }]}>
              <Ionicons name="lock-closed" size={16} color="#fff" />
            </View>
            <TextInput
              style={s.inlineInput}
              value={password}
              onChangeText={setPassword}
              placeholder="New Password (optional)"
              placeholderTextColor="#aeaeb2"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Sizing */}
        <SectionHeader title="Size Profile" />
        <View style={s.card}>
          <View style={[s.inputRow, s.groupRowBorder]}>
            <View style={[s.groupRowIcon, { backgroundColor: "#0891b2" }]}>
              <Ionicons name="footsteps" size={16} color="#fff" />
            </View>
            <Text style={s.inputLabel}>Sneaker Size</Text>
            <TextInput
              style={s.inlineInputRight}
              value={sizeSneakers}
              onChangeText={setSizeSneakers}
              placeholder="e.g. UK 9"
              placeholderTextColor="#aeaeb2"
              textAlign="right"
            />
          </View>
          <View style={[s.inputRow, s.groupRowBorder]}>
            <View style={[s.groupRowIcon, { backgroundColor: "#8b5cf6" }]}>
              <Ionicons name="shirt" size={16} color="#fff" />
            </View>
            <Text style={s.inputLabel}>Apparel Size</Text>
            <TextInput
              style={s.inlineInputRight}
              value={sizeApparel}
              onChangeText={setSizeApparel}
              placeholder="e.g. M, L, XL"
              placeholderTextColor="#aeaeb2"
              textAlign="right"
            />
          </View>
          <View style={s.inputRow}>
            <View style={[s.groupRowIcon, { backgroundColor: "#ec4899" }]}>
              <Ionicons name="options" size={16} color="#fff" />
            </View>
            <Text style={s.inputLabel}>Fit Preference</Text>
            <TextInput
              style={s.inlineInputRight}
              value={fitApparel}
              onChangeText={setFitApparel}
              placeholder="e.g. Slim Fit"
              placeholderTextColor="#aeaeb2"
              textAlign="right"
            />
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fdde59" />
          ) : (
            <Text style={s.saveBtnText}>Save Changes</Text>
          )}
        </Pressable>

        {/* My Orders */}
        <SectionHeader title="Activity" />
        <View style={s.card}>
          <GroupedRow
            icon="receipt"
            label="My Orders"
            onPress={() => navigation.navigate("OrderHistory")}
          />
        </View>

        {/* Sign Out */}
        <SectionHeader title="" />
        <View style={s.card}>
          <GroupedRow
            icon="log-out"
            label="Sign Out"
            destructive
            onPress={handleLogout}
            isLast
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: "#fdf9ea",
  },
  headerLargeTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#012a62",
    letterSpacing: -0.5,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Section Header
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#012a62",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 24,
    opacity: 0.55,
    textTransform: "uppercase",
  },
  // Avatar
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 2.5,
    borderColor: "#012a62",
  },
  avatarText: {
    color: "#fdde59",
    fontSize: 28,
    fontWeight: "700",
  },
  avatarEmail: {
    fontSize: 15,
    fontWeight: "500",
    color: "#3c3c43",
    marginBottom: 8,
    maxWidth: "85%",
    textAlign: "center",
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: "rgba(1, 42, 98, 0.15)",
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  // Card
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  // Group Rows
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  groupRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c6c6c8",
  },
  groupRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  groupRowIconDestructive: {
    backgroundColor: "#dc2626",
  },
  groupRowLabel: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    flex: 1,
  },
  groupRowValue: {
    fontSize: 15,
    color: "#6d6d72",
    fontWeight: "400",
    maxWidth: 140,
    textAlign: "right",
  },
  // Input Rows
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 50,
  },
  inputLabel: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    flex: 1,
  },
  inlineInput: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    paddingVertical: 8,
  },
  inlineInputRight: {
    fontSize: 15,
    color: "#3c3c43",
    fontWeight: "400",
    textAlign: "right",
    minWidth: 100,
    paddingVertical: 8,
  },
  // Error
  error: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  // Save Button
  saveBtn: {
    backgroundColor: "#012a62",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 4,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: "#fdde59",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.3,
  },
});
