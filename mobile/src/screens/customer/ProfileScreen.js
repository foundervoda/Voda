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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";


export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, address: savedAddress, updateProfile, updateAddress, logout } = useAuthStore();
  const socket = useSocket();

  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setLocalAddress] = useState(savedAddress || "");
  const [password, setPassword] = useState("");

  // Sync inputs with the auth store user state (e.g. standard/gold downgrades & updates)
  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isGoldSubscriber = !!(user?.email?.toLowerCase() ?? "").includes("gold");

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
      
      const payload = {
        email: newEmail,
        phone: phone.trim() || user?.phone || "1234567890",
      };
      
      await updateProfile(payload);
      setEmail(newEmail);
      Alert.alert(
        "Success",
        `Subscription tier updated! You are now a ${!isCurrentlyGold ? "Gold Member" : "Standard Tier customer"}.`
      );
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not update subscription tier");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!email.trim() || !phone.trim()) {
      setError("Email and Phone are required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        phone: phone.trim(),
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      await updateProfile(payload);
      await updateAddress(address.trim());
      setPassword("");
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => logout() },
      ]
    );
  };



  const initials = (user?.email || "U").substring(0, 2).toUpperCase();

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Custom Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar Card */}
        <View style={s.avatarCard}>
          <View style={[s.avatarCircle, isGoldSubscriber && s.avatarCircleGold]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.userEmail}>{user?.email}</Text>
          <View style={[s.roleBadge, isGoldSubscriber && s.roleBadgeGold]}>
            <Text style={[s.roleText, isGoldSubscriber && s.roleTextGold]}>
              {isGoldSubscriber ? "Voda Gold VIP" : (user?.role || "Customer")}
            </Text>
          </View>
        </View>

        {/* Subscription Tier Toggle */}
        <Pressable style={s.formCard} onPress={() => navigation.navigate("VodaGold")}>
          <Text style={s.formTitle}>Subscription Tier</Text>
          <View style={s.tierRow}>
            <View style={s.tierInfo}>
              <Text style={s.tierName}>{isGoldSubscriber ? "Voda Gold Member" : "Standard Tier"}</Text>
              <Text style={s.tierDesc}>
                {isGoldSubscriber 
                  ? "Enjoy free delivery and unlimited Try & Buy on all orders!"
                  : "Upgrade to Voda Gold for free delivery & unlimited Try & Buy."}
              </Text>
            </View>
            <View style={[s.toggleBtn, isGoldSubscriber ? s.toggleBtnActive : s.toggleBtnInactive]}>
              <Text style={[s.toggleBtnText, isGoldSubscriber ? s.toggleBtnTextActive : s.toggleBtnTextInactive]}>
                {isGoldSubscriber ? "Gold Active" : "Upgrade"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Edit Form */}
        <View style={s.formCard}>
          <Text style={s.formTitle}>Edit Details</Text>

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputContainer}>
            <Ionicons name="mail-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Phone Number</Text>
          <View style={s.inputContainer}>
            <Ionicons name="call-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
          </View>

          <Text style={s.label}>Default Delivery Address</Text>
          <View style={[s.inputContainer, { minHeight: 60, alignItems: "flex-start", paddingTop: 10 }]}>
            <Ionicons name="location-outline" size={18} color="#012a6260" style={[s.inputIcon, { marginTop: 2 }]} />
            <TextInput
              style={[s.input, { height: "100%", textAlignVertical: "top" }]}
              value={address}
              onChangeText={setLocalAddress}
              placeholder="Saved Delivery Address"
              multiline
            />
          </View>

          <Text style={s.label}>New Password (Optional)</Text>
          <View style={s.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Leave blank to keep current"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Save profile Button */}
        <Pressable
          style={[s.saveBtn, loading && s.btnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fdde59" />
          ) : (
            <Text style={s.saveBtnText}>Save Profile</Text>
          )}
        </Pressable>

        {/* Order History */}
        <Pressable
          style={s.navRow}
          onPress={() => navigation.navigate("OrderHistory")}
        >
          <Ionicons name="receipt-outline" size={18} color="#012a62" style={{ marginRight: 10 }} />
          <Text style={s.navRowText}>My Orders</Text>
          <Ionicons name="chevron-forward" size={16} color="#012a6260" style={{ marginLeft: "auto" }} />
        </Pressable>

        {/* Logout Button */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
          <Text style={s.logoutBtnText}>Logout</Text>
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#012a6210",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#012a62",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 20,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#fdde59",
    fontSize: 24,
    fontWeight: "900",
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: "#012a62",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "#012a6210",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  avatarCircleGold: {
    borderColor: "#fdde59",
    borderWidth: 2,
  },
  roleBadgeGold: {
    backgroundColor: "#fdde5940",
    borderColor: "#fdde59",
    borderWidth: 1.5,
  },
  roleTextGold: {
    color: "#012a62",
  },
  formCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 16,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#012a6280",
    marginBottom: 6,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#012a6220",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#012a62",
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: "#012a62",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  saveBtnText: {
    color: "#fdde59",
    fontWeight: "800",
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#dc262620",
    borderRadius: 12,
    backgroundColor: "#fffef5",
    marginTop: 8,
  },
  logoutBtnText: {
    color: "#dc2626",
    fontWeight: "800",
    fontSize: 15,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffef5",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#012a6210",
    marginBottom: 12,
  },
  navRowText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#012a62",
    flex: 1,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierInfo: {
    flex: 1,
    marginRight: 12,
  },
  tierName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#012a62",
  },
  tierDesc: {
    fontSize: 12,
    color: "#012a6260",
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
  },
  toggleBtnInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#012a6220",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "900",
  },
  toggleBtnTextActive: {
    color: "#012a62",
  },
  toggleBtnTextInactive: {
    color: "#012a6280",
  },
});
