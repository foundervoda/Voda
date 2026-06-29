import { useEffect, useState } from "react";
import { connectSocket, socket } from "./api/socket";
import { getToken } from "./api/client";
import { getMe, logout } from "./api/auth";
import LoginScreen from "./screens/LoginScreen";
import OrdersBoard, { StoreTbTab } from "./screens/OrdersBoard";
import StockView from "./screens/StockView";
import AdminPanel from "./screens/AdminPanel";
import OnboardingPage from "./screens/OnboardingPage";
const TABS = [
  { key: "orders", label: "Orders"    },
  { key: "stock",  label: "Stock"     },
  { key: "trybuy", label: "Try & Buy" },
];

function SignOutButton({ onConfirm }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cream/70 hover:text-cream
                   border border-white/20 hover:border-white/40 rounded-lg transition"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
        </svg>
        Sign out
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-yellow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-navy mb-1">Sign out?</h2>
            <p className="text-sm text-navy/50 mb-6">You'll need to sign in again to access the dashboard.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-navy border border-navy/20 rounded-xl hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 text-sm font-semibold text-navy bg-yellow hover:brightness-95 rounded-xl transition"
              >
                Yes, sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MainApp() {
  const [user, setUser]           = useState(null);
  const [booting, setBooting]     = useState(true);
  const [connected, setConnected] = useState(false);
  const [tab, setTab]             = useState("orders");
  const [mismatchAlert, setMismatchAlert] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("voda_store_token", urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

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
    const onMismatch = (payload) => setMismatchAlert(payload);
    socket.on("connect",        onConnect);
    socket.on("disconnect",     onDisconnect);
    socket.on("kiosk_mismatch", onMismatch);
    return () => {
      socket.off("connect",        onConnect);
      socket.off("disconnect",     onDisconnect);
      socket.off("kiosk_mismatch", onMismatch);
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

  if (user.role === "ADMIN") {
    return (
      <div className="min-h-screen bg-cream">
        <header className="bg-navy px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/Voda Logo.png" alt="Voda" className="h-7 object-contain brightness-0 invert" />
            <span className="text-cream/50 text-xs font-semibold uppercase tracking-widest">Admin</span>
          </div>
          <SignOutButton onConfirm={handleLogout} />
        </header>
        <AdminPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/Voda Logo.png" alt="Voda" className="h-7 object-contain brightness-0 invert" />
          {user.storeName && (
            <span className="text-cream/60 text-xs font-semibold uppercase tracking-widest border-l border-white/20 pl-4">
              {user.storeName}
            </span>
          )}
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
          <SignOutButton onConfirm={handleLogout} />
        </div>
      </header>

      {tab === "orders" && <OrdersBoard storeId={user.storeId} />}
      {tab === "stock"  && <StockView   storeId={user.storeId} />}
      {tab === "trybuy" && <div className="p-5 max-w-6xl mx-auto"><StoreTbTab /></div>}

      {/* Kiosk mismatch alert — shown over any tab */}
      {mismatchAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-black text-red-600 mb-1">Kiosk Mismatch</h2>
            <p className="text-navy/60 text-sm mb-1">Order <span className="font-mono font-bold">#{mismatchAlert.shortId}</span> · {mismatchAlert.mode}</p>
            <p className="text-navy/50 text-xs mb-6">Wrong item scanned at the return kiosk</p>
            <div className="grid grid-cols-2 gap-4 mb-6 text-left">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-emerald-700 text-xs font-bold uppercase tracking-widest mb-1">Expected</p>
                <p className="text-emerald-900 font-bold text-sm">{mismatchAlert.expected?.name}</p>
                <p className="text-emerald-700 text-sm">{mismatchAlert.expected?.variant}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-red-700 text-xs font-bold uppercase tracking-widest mb-1">Scanned</p>
                <p className="text-red-900 font-bold text-sm">{mismatchAlert.scanned?.name}</p>
                <p className="text-red-700 text-sm">{mismatchAlert.scanned?.variant}</p>
              </div>
            </div>
            <button
              onClick={() => setMismatchAlert(null)}
              className="w-full bg-navy text-yellow font-black rounded-xl py-4"
            >
              Acknowledged — Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const onboardToken = window.location.pathname.match(/^\/onboard\/([a-f0-9]{32})$/)?.[1];
  if (onboardToken) return <OnboardingPage token={onboardToken} />;
  return <MainApp />;
}
