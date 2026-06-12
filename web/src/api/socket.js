import { io } from "socket.io-client";
import { getToken } from "./client";

// One shared connection for the whole dashboard (Handbook §11 — room strategy)
export const socket = io(import.meta.env.VITE_API_URL, { autoConnect: false });

export function connectSocket() {
  socket.connect();

  const token = getToken();
  if (token) socket.emit("authenticate", token);
}
