import { useEffect, useState } from "react";
import { connectSocket, socket } from "./api/socket";
import { getToken } from "./api/client";
import { getMe, logout } from "./api/auth";
import LoginScreen from "./screens/LoginScreen";
import OrdersBoard from "./screens/OrdersBoard";
import StockView from "./screens/StockView";

const TABS = [
  { key: "orders", label: "Orders" },
  { key: "stock",  label: "Stock"  },
];

export default function App() {
  const [user, setUser]           = useState(null);
  const [booting, setBooting]     = useState(true);
  const [connected, setConnected] = useState(false);
  const [tab, setTab]             = useState("orders");

  useEffect(() => {
    if (getToken()) {
      getMe()
        .then(setUser)
        .catch(() => {})
        .finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.storeId) return;
    connectSocket();
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [user?.storeId]);

  function handleLogin(loggedInUser) { setUser(loggedInUser); }

  function handleLogout() {
    logout();
    socket.disconnect();
    setUser(null);
    setConnected(false);
  }

  if (booting) return null;
  if (!user)   return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/Voda Logo.png" alt="Voda" className="h-7 object-contain brightness-0 invert" />
          {/* Tab navigation */}
          <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition
                  ${tab === t.key ? "bg-white text-navy" : "text-cream/60 hover:text-cream"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
            <span className={`text-xs font-medium ${connected ? "text-emerald-400" : "text-gray-400"}`}>
              {connected ? "Live" : "Offline"}
            </span>
          </div>
          <button onClick={handleLogout} className="text-cream/40 hover:text-cream text-xs transition">
            Sign out
          </button>
        </div>
      </header>

      {tab === "orders" && <OrdersBoard storeId={user.storeId} />}
      {tab === "stock"  && <StockView   storeId={user.storeId} />}
    </div>
  );
}
