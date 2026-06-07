import { useEffect, useState } from "react";
import { connectSocket, socket } from "./api/socket";
import { getToken } from "./api/client";
import OrdersBoard from "./screens/OrdersBoard";

// TODO: replace with real auth — for now, read the logged-in store staff's storeId from /auth/me
const DEV_STORE_ID = "dev-store-id";

export default function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (getToken()) connectSocket();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">Voda — Store Dashboard</h1>
        <span className={`text-sm ${connected ? "text-emerald-600" : "text-gray-400"}`}>
          {connected ? "● live" : "○ offline"}
        </span>
      </header>

      <OrdersBoard storeId={DEV_STORE_ID} />
    </div>
  );
}
