import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

const BASE_URL = "http://localhost:3001/api";
console.log("[api] baseURL:", BASE_URL);

// expo-secure-store is native-only; fall back to localStorage on web
const storage = {
  getItem: (key) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  deleteItem: (key) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor to handle global auth state and 401 Unauthorized redirections safely
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("[api] 401 Unauthorized response detected. Clearing session state.");
      await storage.deleteItem(TOKEN_KEY);
      
      try {
        // Dynamically import useAuthStore to avoid circular dependency and safely update state
        const { useAuthStore } = require("../store/useAuthStore");
        useAuthStore.getState().logout();
      } catch (e) {
        console.error("[api] Failed to dispatch logout on 401", e);
      }
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token) => storage.setItem(TOKEN_KEY, token);
export const clearToken = () => storage.deleteItem(TOKEN_KEY);
export const getToken = () => storage.getItem(TOKEN_KEY);
