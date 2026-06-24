import { create } from "zustand";
import {
  api,
  saveToken,
  clearToken,
  saveAddress,
  clearAddress,
  getAddress,
} from "../api/client";

export const useAuthStore = create((set) => ({
  user: null,
  address: "",
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    await saveToken(data.data.token);
    const address = await getAddress();
    set({ user: data.data.user, address: address || "" });
  },

  loginWithCode: async (code) => {
    const { data } = await api.post("/auth/login-code", { code });
    await saveToken(data.data.token);
    set({ user: data.data.user, address: "" });
  },

  requestOtp: async (phone) => {
    const { data } = await api.post("/auth/request-otp", { phone });
    return data.data; // { sent, devOtp }
  },

  verifyOtp: async (phone, otp) => {
    const { data } = await api.post("/auth/verify-otp", { phone, otp });
    await saveToken(data.data.token);
    const address = await getAddress();
    set({ user: data.data.user, address: address || "" });
  },

  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    await saveToken(data.data.token);
    const address = await getAddress();
    set({ user: data.data.user, address: address || "" });
  },

  logout: async () => {
    await clearToken();
    await clearAddress();
    set({ user: null, address: "" });
  },

  updateProfile: async (payload) => {
    const { data } = await api.put("/auth/me", payload);
    set({ user: data.data.user });
  },

  updateAddress: async (addr) => {
    await saveAddress(addr);
    set({ address: addr });
  },

  // Called on app start — restores the session from a stored token
  hydrate: async () => {
    try {
      const { data } = await api.get("/auth/me");
      const address = await getAddress();
      set({ user: data.data.user, address: address || "", isLoading: false });
    } catch (err) {
      set({ user: null, address: "", isLoading: false });
    }
  },
}));
