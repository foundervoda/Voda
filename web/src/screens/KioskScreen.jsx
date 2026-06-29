import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../api/client";

// Derive scan code from variant UUID (same formula as backend)
function scanCode(variantId) {
  return variantId.replace(/-/g, "").toUpperCase().slice(0, 8);
}

function buildScanMap(order) {
  const map = {};
  for (const item of order.items) {
    for (const v of item.product.allVariants) {
      map[v.scanCode] = { variantId: v.id, size: v.size, color: v.color, productId: item.product.id, productName: item.product.name };
    }
  }
  return map;
}

// ── Landing ────────────────────────────────────────────────────────────────────
function Landing({ onOrder }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    const id = input.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/kiosk/orders/${id}`);
      onOrder(res.data.data.order);
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Order not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-6 py-12">
      <div className="text-center">
        <p className="text-navy font-black text-2xl mb-1">Return Kiosk</p>
        <p className="text-navy/50 text-sm">Enter an order ID to begin verification</p>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="ORDER ID (e.g. FED9B6)"
          className="w-full border-2 border-navy/20 rounded-xl px-4 py-3 text-navy font-mono font-bold text-center text-xl tracking-widest focus:outline-none focus:border-navy placeholder:text-navy/20"
          autoFocus
        />
        {error && <p className="text-red-600 text-sm text-center font-semibold">{error}</p>}
        <button
          onClick={lookup}
          disabled={loading || !input.trim()}
          className="bg-navy text-yellow font-black rounded-xl py-3 disabled:opacity-40 transition-opacity"
        >
          {loading ? "Looking up…" : "Find Order →"}
        </button>
      </div>
    </div>
  );
}

// ── Item card ──────────────────────────────────────────────────────────────────
function ItemCard({ item, state }) {
  const [codeVisible, setCodeVisible] = useState(false);

  const styles = {
    pending:  { border: "border-navy/10", bg: "bg-white", badge: "bg-gray-100 text-gray-500", icon: "○" },
    ok:       { border: "border-emerald-300", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", icon: "✓" },
    mismatch: { border: "border-red-300", bg: "bg-red-50", badge: "bg-red-100 text-red-700", icon: "✗" },
  };
  const s = styles[state];
  const variantLabel = [item.variant.size, item.variant.color].filter(Boolean).join(" · ");
  return (
    <div className={`rounded-2xl border-2 ${s.border} ${s.bg} p-4 flex items-center gap-4 transition-all duration-300`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black ${s.badge}`}>{s.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy text-sm leading-tight">{item.product.name}</p>
        <p className="text-navy/60 text-xs mt-0.5">{variantLabel} · ×{item.quantity}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-navy/30 text-[9px] uppercase tracking-widest mb-0.5">Code</p>
        <div className="flex items-center gap-1 justify-end">
          <p className="font-mono font-bold text-navy/60 text-xs tracking-widest">
            {codeVisible ? item.variant.scanCode : "••••••••"}
          </p>
          <button
            onClick={() => setCodeVisible((v) => !v)}
            className="text-navy/30 hover:text-navy/60 transition-colors ml-1"
            title={codeVisible ? "Hide code" : "Show code"}
          >
            {codeVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verify ─────────────────────────────────────────────────────────────────────
function Verify({ order, onComplete, onReset }) {
  const [itemStates, setItemStates] = useState(() =>
    Object.fromEntries(order.items.map((i) => [i.id, "pending"]))
  );
  const [scanInput, setScanInput] = useState("");
  const [alert, setAlert] = useState(null);
  const [lastOk, setLastOk] = useState(null);
  const [completing, setCompleting] = useState(false);
  const scanRef = useRef(null);
  const scanMap = buildScanMap(order);

  const allDone = Object.values(itemStates).every((s) => s === "ok");
  const doneCount = Object.values(itemStates).filter((s) => s === "ok").length;

  useEffect(() => {
    if (!alert) setTimeout(() => scanRef.current?.focus(), 50);
  }, [alert]);

  const processCode = useCallback(
    (raw) => {
      const code = raw.trim().toUpperCase();
      if (!code) return;
      const scanned = scanMap[code];
      if (!scanned) {
        setAlert({ type: "unknown", message: "Unknown item", detail: `Scan code "${code}" not recognised.` });
        return;
      }
      const orderItem = order.items.find((i) => i.product.id === scanned.productId);
      if (!orderItem) {
        setAlert({ type: "unknown", message: "Item not in order", detail: `${scanned.productName} is not part of this order.` });
        return;
      }
      if (itemStates[orderItem.id] === "ok") {
        setAlert({ type: "already", message: "Already scanned", detail: `${scanned.productName} already verified.` });
        return;
      }
      const expected = orderItem.variant;
      if (scanned.variantId !== expected.id) {
        const expLabel = [expected.size, expected.color].filter(Boolean).join(" · ");
        const gotLabel = [scanned.size, scanned.color].filter(Boolean).join(" · ");
        setAlert({ type: "mismatch", message: "Wrong item", expected: { name: orderItem.product.name, label: expLabel }, scanned: { name: scanned.productName, label: gotLabel } });
        setItemStates((prev) => ({ ...prev, [orderItem.id]: "mismatch" }));
        api.post(`/kiosk/orders/${order.id}/mismatch`, {
          expected: { name: orderItem.product.name, variant: expLabel },
          scanned:  { name: scanned.productName, variant: gotLabel },
        }).catch(() => {});
        return;
      }
      setItemStates((prev) => ({ ...prev, [orderItem.id]: "ok" }));
      setLastOk({ name: scanned.productName, size: scanned.size });
      setTimeout(() => setLastOk(null), 2000);
    },
    [scanMap, itemStates, order.items, order.id]
  );

  async function handleComplete() {
    setCompleting(true);
    try {
      await api.post(`/kiosk/orders/${order.id}/complete`);
      onComplete(order.mode);
    } catch {
      setCompleting(false);
    }
  }

  function dismissAlert() {
    if (alert?.type === "mismatch") {
      const item = order.items.find((i) => i.product.name === alert.expected.name);
      if (item) setItemStates((prev) => ({ ...prev, [item.id]: "pending" }));
    }
    setAlert(null);
  }

  const modeLabel = order.mode === "return" ? "Return Verification" : "Collection Verification";

  return (
    <div className="flex flex-col gap-4">
      {/* Mode badge + order */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
          order.mode === "return" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
        }`}>{modeLabel}</span>
        <span className="font-mono font-black text-navy text-sm">#{order.shortId}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Scan panel */}
        <div className="flex flex-col gap-3">
          <form onSubmit={(e) => { e.preventDefault(); processCode(scanInput); setScanInput(""); }} className="flex flex-col gap-2">
            <input
              ref={scanRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value.toUpperCase())}
              placeholder="SCAN CODE"
              className="w-full border-2 border-navy/20 rounded-xl px-4 py-3 text-navy font-mono text-lg font-bold tracking-widest focus:outline-none focus:border-navy placeholder:text-navy/20 text-center"
              autoComplete="off"
            />
            <button type="submit" disabled={!scanInput.trim()} className="bg-navy text-yellow font-black rounded-xl py-2.5 disabled:opacity-30">
              Verify →
            </button>
          </form>

          {lastOk && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-emerald-800 text-sm font-semibold text-center">
              ✓ {lastOk.name} verified
            </div>
          )}

          <div className="bg-cream rounded-xl p-4 text-center">
            <p className="text-navy/50 text-xs uppercase tracking-widest mb-1">Progress</p>
            <p className="text-navy font-black text-2xl">{doneCount}<span className="text-navy/30 font-semibold text-base"> / {order.items.length}</span></p>
          </div>

          {allDone && (
            <button onClick={handleComplete} disabled={completing} className="bg-emerald-500 text-white font-black rounded-xl py-3 disabled:opacity-60">
              {completing ? "Confirming…" : "All Items Verified ✓"}
            </button>
          )}

          <button onClick={onReset} className="text-navy/30 text-xs underline text-center hover:text-navy/60">
            Cancel
          </button>
        </div>

        {/* Items list */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-80">
          {order.items.map((item) => (
            <ItemCard key={item.id} item={item} state={itemStates[item.id]} />
          ))}
        </div>
      </div>

      {/* Alert overlay */}
      {alert && (
        <div className="fixed inset-0 bg-navy/70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            {alert.type === "mismatch" ? (
              <>
                <div className="text-4xl mb-3">⚠️</div>
                <h2 className="text-xl font-black text-red-600 mb-4">Wrong Item</h2>
                <div className="grid grid-cols-2 gap-3 mb-4 text-left">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-emerald-700 text-[10px] font-bold uppercase tracking-widest mb-1">Expected</p>
                    <p className="text-emerald-900 font-bold text-sm">{alert.expected.name}</p>
                    <p className="text-emerald-700 text-xs">{alert.expected.label}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-700 text-[10px] font-bold uppercase tracking-widest mb-1">Scanned</p>
                    <p className="text-red-900 font-bold text-sm">{alert.scanned.name}</p>
                    <p className="text-red-700 text-xs">{alert.scanned.label}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">{alert.type === "already" ? "✅" : "❓"}</div>
                <h2 className="text-lg font-black text-navy mb-2">{alert.message}</h2>
                <p className="text-navy/60 text-sm mb-4">{alert.detail}</p>
              </>
            )}
            <button onClick={dismissAlert} className="w-full bg-navy text-yellow font-black rounded-xl py-3">
              OK — Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Done ───────────────────────────────────────────────────────────────────────
function Done({ mode, onReset }) {
  const isReturn = mode === "return";
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="text-5xl">{isReturn ? "📦" : "✅"}</div>
      <p className="text-navy font-black text-xl">
        {isReturn ? "Return Logged" : "Collection Verified"}
      </p>
      <p className="text-navy/50 text-sm text-center max-w-xs">
        {isReturn
          ? "All items have been scanned back into store inventory. The customer's refund has been finalised."
          : "The runner can now mark this order as collected."}
      </p>
      <button onClick={onReset} className="mt-4 bg-navy text-yellow font-black rounded-xl px-8 py-3">
        New Order →
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function KioskScreen() {
  const [order, setOrder] = useState(null);
  const [doneMode, setDoneMode] = useState(null);

  function reset() { setOrder(null); setDoneMode(null); }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-navy/8 p-6">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-navy/10">
          <span className="text-navy font-black text-lg">Kiosk</span>
          <span className="text-navy/30 text-xs font-semibold uppercase tracking-widest">/ Scan Station</span>
        </div>

        {doneMode   ? <Done   mode={doneMode} onReset={reset} /> :
         order      ? <Verify order={order}   onComplete={setDoneMode} onReset={reset} /> :
                      <Landing onOrder={setOrder} />}
      </div>
    </div>
  );
}
