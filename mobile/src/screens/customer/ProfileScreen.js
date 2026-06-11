import { useState } from "react";
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

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout } = useAuthStore();

  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      <ScrollView contentContainerStyle={s.content}>
        {/* Profile Avatar Card */}
        <View style={s.avatarCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.userEmail}>{user?.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{user?.role || "Customer"}</Text>
          </View>
        </View>

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

        {/* Buttons */}
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
    marginBottom: 12,
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
  },
  logoutBtnText: {
    color: "#dc2626",
    fontWeight: "800",
    fontSize: 15,
  },
});
