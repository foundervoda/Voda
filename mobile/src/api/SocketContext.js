import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "./client";

const SocketContext = createContext(null);

// One socket connection shared app-wide (Handbook §12 — "What goes where")
export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = io(process.env.EXPO_PUBLIC_API_URL, { autoConnect: false });
  }

  useEffect(() => {
    const socket = socketRef.current;

    getToken().then((token) => {
      if (token) {
        socket.connect();
        socket.emit("authenticate", token);
      }
    });

    return () => socket.disconnect();
  }, []);

  return <SocketContext.Provider value={socketRef.current}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
