import { useEffect } from "react";

const STATUS_META = {
  PENDING:          { label: "New Order",        bg: "bg-yellow",      text: "text-navy" },
  RUNNER_ASSIGNED:  { label: "Runner Assigned",  bg: "bg-blue-100",    text: "text-blue-800" },
  COLLECTED:        { label: "Collected",         bg: "bg-indigo-100",  text: "text-indigo-800" },
  HANDED_TO_RIDER:  { label: "With Rider",        bg: "bg-indigo-100",  text: "text-indigo-800" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery",  bg: "bg-indigo-200",  text: "text-indigo-900" },
  ARRIVED:          { label: "Arrived",           bg: "bg-emerald-100", text: "text-emerald-800" },
  DELIVERED:        { label: "Delivered",         bg: "bg-emerald-200", text: "text-emerald-900" },
  RETURNING:        { label: "Returning",         bg: "bg-gray-100",    text: "text-gray-600" },
  RETURNED:         { label: "Returned",          bg: "bg-gray-100",    text: "text-gray-600" },
  REFUNDED:         { label: "Refunded",          bg: "bg-gray-100",    text: "text-gray-600" },
};

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OrderModal({ order, onClose }) {
  const meta = STATUS_META[order.status] ?? { label: order.status, bg: "bg-gray-100", text: "text-gray-600" };
  const shortId = order.id.slice(-6).toUpperCase();
  const total = order.items.reduce((sum, i) => sum + (i.product?.price ?? 0) * i.quantity, 0);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-navy px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
          <div className="flex items-center gap-3">
            <span className="text-cream font-mono font-bold tracking-widest">#{shortId}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
              {meta.label}
            </span>
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-cream text-xl leading-none transition">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* Items */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Items</h3>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 bg-cream rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="font-semibold text-navy text-sm">{item.product?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[item.variant?.size, item.variant?.color].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-navy font-bold text-sm">×{item.quantity}</p>
                    {item.product?.price && (
                      <p className="text-xs text-gray-400">
                        ₹{(Number(item.product.price) * item.quantity).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-navy">Total</span>
                <span className="text-sm font-bold text-navy">₹{Number(total).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Delivery */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Delivery</h3>
            <div className="bg-cream rounded-xl px-4 py-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 w-16 shrink-0">Address</span>
                <span className="text-navy font-medium">{order.deliveryAddr}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-16 shrink-0">ETA</span>
                <span className="text-navy font-medium">{order.etaMinutes} min</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-16 shrink-0">Placed</span>
                <span className="text-navy font-medium">{fmt(order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          {order.customer && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Customer</h3>
              <div className="bg-cream rounded-xl px-4 py-3 space-y-2 text-sm">
                {order.customer.email && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Email</span>
                    <span className="text-navy font-medium">{order.customer.email}</span>
                  </div>
                )}
                {order.customer.phone && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Phone</span>
                    <span className="text-navy font-medium">{order.customer.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Runner */}
          {order.runner && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Assigned Runner</h3>
              <div className="bg-cream rounded-xl px-4 py-3 space-y-2 text-sm">
                {order.runner.phone && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Phone</span>
                    <span className="text-navy font-medium">{order.runner.phone}</span>
                  </div>
                )}
                {order.runner.email && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Email</span>
                    <span className="text-navy font-medium">{order.runner.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
