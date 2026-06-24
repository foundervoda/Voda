import { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from "react-native";
import { useAuthStore } from "../store/useAuthStore";

// Detect role from input value
function detectRole(val) {
  if (/^[Rr]\d{3}$/.test(val)) return "RUNNER";
  if (/^[Dd]\d{3}$/.test(val)) return "RIDER";
  return null; // customer (phone number)
}

const HINT = {
  RUNNER: "Runner account detected",
  RIDER:  "Delivery partner detected",
};

export default function LoginScreen() {
  const { loginWithCode, requestOtp, verifyOtp } = useAuthStore();

  const [identifier, setIdentifier] = useState("");
  const [phase, setPhase] = useState("id"); // "id" | "otp"
  const [phone, setPhone] = useState("");   // stored after OTP request
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const role = detectRole(identifier.trim());
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // ── Phase 1: identifier submitted ─────────────────────────────
  const handleIdentifier = async () => {
    setError(null);
    const val = identifier.trim();
    if (!val) return;

    if (role) {
      // Runner or rider — direct code login
      setLoading(true);
      try {
        await loginWithCode(val);
      } catch (err) {
        setError(err?.response?.data?.error?.message ?? "Invalid code");
      } finally {
        setLoading(false);
      }
    } else {
      // Customer — request OTP
      setLoading(true);
      try {
        const result = await requestOtp(val);
        setPhone(val);
        setDevOtp(result.devOtp ?? null);
        setOtp("");
        setPhase("otp");
      } catch (err) {
        setError(err?.response?.data?.error?.message ?? "Could not send OTP");
      } finally {
        setLoading(false);
      }
    }
  };

  // ── Phase 2: OTP submitted ─────────────────────────────────────
  const handleOtp = async () => {
    if (otp.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? "Incorrect code");
      setOtp("");
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigit = (text, idx) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const arr = otp.split("");
    arr[idx] = digit;
    const next = arr.join("").slice(0, 6);
    setOtp(next);
    if (digit && idx < 5) otpRefs[idx + 1].current?.focus();
    if (next.length === 6) setTimeout(handleOtp, 80);
  };

  const handleOtpBack = (idx) => {
    if (otp[idx]) {
      const arr = otp.split("");
      arr[idx] = "";
      setOtp(arr.join(""));
    } else if (idx > 0) {
      otpRefs[idx - 1].current?.focus();
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.root}>
      <View style={s.logoWrap}>
        <Image source={require("../../assets/Voda Logo.png")} style={s.logo} resizeMode="contain" />
      </View>

      {phase === "id" ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome</Text>
          <Text style={s.cardSub}>Enter your phone number or partner ID</Text>

          <TextInput
            style={s.input}
            placeholder="Phone number or R/D code"
            placeholderTextColor="#012a6250"
            autoCapitalize="characters"
            keyboardType="default"
            value={identifier}
            onChangeText={(t) => { setIdentifier(t); setError(null); }}
            onSubmitEditing={handleIdentifier}
            returnKeyType="go"
            autoFocus
          />

          {/* Role hint chip */}
          {role && (
            <View style={s.roleChip}>
              <Text style={s.roleChipText}>{HINT[role]}</Text>
            </View>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={[s.btn, (!identifier.trim() || loading) && s.btnDisabled]}
            onPress={handleIdentifier}
            disabled={!identifier.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#fdde59" />
              : <Text style={s.btnText}>{role ? "Log in" : "Send OTP →"}</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.card}>
          <Pressable onPress={() => { setPhase("id"); setError(null); }} style={s.backBtn}>
            <Text style={s.backBtnText}>← Change number</Text>
          </Pressable>

          <Text style={s.cardTitle}>Enter OTP</Text>
          <Text style={s.cardSub}>Sent to {phone}</Text>

          {/* Dev mode OTP display */}
          {devOtp && (
            <View style={s.devBox}>
              <Text style={s.devLabel}>DEV — your OTP is</Text>
              <Text style={s.devOtp}>{devOtp}</Text>
            </View>
          )}

          <View style={s.otpRow}>
            {[0,1,2,3,4,5].map((i) => (
              <TextInput
                key={i}
                ref={otpRefs[i]}
                style={[s.otpBox, otp[i] && s.otpBoxFilled]}
                keyboardType="number-pad"
                maxLength={1}
                value={otp[i] ?? ""}
                onChangeText={(t) => handleOtpDigit(t, i)}
                onKeyPress={({ nativeEvent }) => nativeEvent.key === "Backspace" && handleOtpBack(i)}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={[s.btn, (otp.length < 6 || loading) && s.btnDisabled]}
            onPress={handleOtp}
            disabled={otp.length < 6 || loading}
          >
            {loading
              ? <ActivityIndicator color="#fdde59" />
              : <Text style={s.btnText}>Verify →</Text>}
          </Pressable>

          <Pressable
            style={s.resendBtn}
            onPress={async () => {
              setError(null);
              setOtp("");
              try {
                const result = await requestOtp(phone);
                setDevOtp(result.devOtp ?? null);
              } catch {}
            }}
          >
            <Text style={s.resendText}>Resend OTP</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const S = "#012a62";
const Y = "#fdde59";
const BG = "#fdf9ea";

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG, justifyContent: "center", paddingHorizontal: 24 },
  logoWrap:   { alignItems: "center", marginBottom: 28 },
  logo:       { width: 160, height: 160 },
  card:       { width: "100%" },
  cardTitle:  { fontSize: 22, fontWeight: "800", color: S, marginBottom: 4 },
  cardSub:    { fontSize: 13, color: "#012a6260", marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderColor: "#012a6225", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 10, fontSize: 17, color: S,
    backgroundColor: "#fffef5", letterSpacing: 1,
  },
  roleChip: {
    alignSelf: "flex-start", backgroundColor: "#e8f5e9",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10,
  },
  roleChipText: { fontSize: 12, fontWeight: "700", color: "#2e7d32" },
  error:      { color: "#dc2626", marginBottom: 10, fontSize: 13 },
  btn: {
    backgroundColor: S, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginTop: 4,
  },
  btnDisabled: { opacity: 0.45 },
  btnText:    { color: Y, fontWeight: "700", fontSize: 16 },
  backBtn:    { marginBottom: 16 },
  backBtnText:{ color: S, fontSize: 13, fontWeight: "600", opacity: 0.55 },
  devBox: {
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
    borderRadius: 10, padding: 12, marginBottom: 16, alignItems: "center",
  },
  devLabel:   { fontSize: 10, fontWeight: "700", color: "#92400e", letterSpacing: 0.5 },
  devOtp:     { fontSize: 28, fontWeight: "900", color: S, letterSpacing: 8, marginTop: 4, fontVariant: ["tabular-nums"] },
  otpRow:     { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 18 },
  otpBox: {
    width: 44, height: 54, borderWidth: 1.5, borderColor: "#012a6230",
    borderRadius: 10, textAlign: "center", fontSize: 22, fontWeight: "800",
    color: S, backgroundColor: "#fffef5",
  },
  otpBoxFilled: { borderColor: S, backgroundColor: "#fff" },
  resendBtn:  { marginTop: 14, alignItems: "center" },
  resendText: { color: S, fontSize: 13, opacity: 0.45 },
});
