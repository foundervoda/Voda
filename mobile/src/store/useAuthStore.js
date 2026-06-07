import { create } from "zustand";
import { api, saveToken, clearToken } from "../api/client";

export const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    await saveToken(data.data.token);
    set({ user: data.data.user });
  },

  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    await saveToken(data.data.token);
    set({ user: data.data.user });
  },

  logout: async () => {
    await clearToken();
    set({ user: null });
  },

  // Called on app start — restores the session from a stored token
  hydrate: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.data.user, isLoading: false });
    } catch (err) {
      set({ user: null, isLoading: false });
    }
  },
}));
