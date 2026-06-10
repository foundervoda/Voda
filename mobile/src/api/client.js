import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;
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

export const saveToken = (token) => storage.setItem(TOKEN_KEY, token);
export const clearToken = () => storage.deleteItem(TOKEN_KEY);
export const getToken = () => storage.getItem(TOKEN_KEY);
