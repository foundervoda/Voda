import { api, saveToken, clearToken } from "./client";

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  saveToken(data.data.token);
  return data.data.user;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data.data.user;
}

export function logout() {
  clearToken();
}
