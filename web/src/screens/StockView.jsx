import { useEffect, useRef, useState } from "react";
import { fetchStoreProducts, bulkUpdateStock, requestProductTbChange } from "../api/products";
import { requestTnbChange } from "../api/tnb";

function parseCSV(text) {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function stockLevel(stock) {
  if (stock === 0) return { label: "Out", cls: "bg-red-100 text-red-700" };
  if (stock <= 5)  return { label: "Low",  cls: "bg-yellow text-navy" };
  return              { label: "OK",   cls: "bg-emerald-100 text-emerald-700" };
}

export default function StockView({ storeId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [preview, setPreview]   = useState(null); // CSV import preview
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [tnbModal, setTnbModal] = useState(null); // { product }
  const [tnbNote, setTnbNote]   = useState("");
  const [tnbSaving, setTnbSaving] = useState(false);
  const fileRef                 = useRef(null);

  useEffect(() => {
    fetchStoreProducts(storeId)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [storeId]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRequestChange(productId, tbRequest) {
    try {
      await requestProductTbChange(productId, tbRequest);
      const fresh = await fetchStoreProducts(storeId);
      setProducts(fresh);
      showToast("Eligibility change request sent to admin.");
    } catch (e) {
      alert("Failed to submit change request.");
    }
  }

  // Export current stock as CSV
  function handleExport() {
    const rows = [["product_name", "size", "color", "variant_id", "stock"]];
    for (const p of products) {
      for (const v of p.variants) {
        rows.push([p.name, v.size, v.color ?? "", v.id, v.stock]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "stock.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Download a blank template CSV with correct headers + one example row
  function handleDownloadTemplate() {
    const csv = [
      ["product_name", "size", "color", "variant_id", "stock"],
      ["Example Product", "M", "Black", "paste-variant-id-here", "0"],
    ].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "stock_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Parse uploaded CSV and build a preview
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      // Match each row to a variant by variant_id or product+size+color
      const variantMap = {};
      for (const p of products) {
        for (const v of p.variants) {
          variantMap[v.id] = { product: p.name, size: v.size, color: v.color, currentStock: v.stock };
          const key = `${p.name.toLowerCase()}|${v.size.toLowerCase()}|${(v.color ?? "").toLowerCase()}`;
          variantMap[key] = { variantId: v.id, product: p.name, size: v.size, color: v.color, currentStock: v.stock };
        }
      }

      const changes = rows.map((row) => {
        const newStock = parseInt(row.stock, 10);
        if (isNaN(newStock)) return null;

        let match = row.variant_id ? variantMap[row.variant_id] : null;
        let variantId = row.variant_id || null;

        if (!match && row.product_name) {
          const key = `${row.product_name.toLowerCase()}|${(row.size ?? "").toLowerCase()}|${(row.color ?? "").toLowerCase()}`;
          match = variantMap[key];
          if (match) variantId = match.variantId;
        }

        if (!match || !variantId) return { error: `No match: ${row.product_name ?? row.variant_id}` };
        return { variantId, product: match.product, size: match.size, color: match.color, currentStock: match.currentStock, newStock };
      }).filter(Boolean);

      setPreview(changes);
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  async function handleTnbRequest() {
    if (!tnbModal) return;
    const { product } = tnbModal;
    const requestedEligible = !product.tryAndBuyEligible;
    setTnbSaving(true);
    try {
      await requestTnbChange(product.id, requestedEligible, tnbNote);
      // Mark pending locally so button flips immediately
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, tnbRequests: [{ id: "pending", requestedEligible }] }
            : p
        )
      );
      showToast(`T&B request submitted for ${product.name}`);
      setTnbModal(null);
      setTnbNote("");
    } catch (err) {
      showToast(err?.response?.data?.error?.message ?? "Request failed");
    } finally {
      setTnbSaving(false);
    }
  }

  async function handleConfirmImport() {
    const updates = preview.filter((r) => !r.error).map(({ variantId, newStock }) => ({ variantId, stock: newStock }));
    if (!updates.length) return;
    setSaving(true);
    try {
      await bulkUpdateStock(updates);
      // Refresh products
      const fresh = await fetchStoreProducts(storeId);
      setProducts(fresh);
      setPreview(null);
      showToast(`Updated ${updates.length} variant${updates.length !== 1 ? "s" : ""}`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalVariants = products.reduce((s, p) => s + p.variants.length, 0);
  const lowStock = products.reduce((s, p) => s + p.variants.filter((v) => v.stock <= 5).length, 0);

  return (
    <div className="p-5 max-w-5xl mx-auto">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Products",      value: products.length },
          { label: "Total Variants", value: totalVariants },
          { label: "Low / Out",     value: lowStock, warn: lowStock > 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn ? "text-red-500" : "text-navy"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-navy
                     placeholder:text-gray-300 focus:outline-none focus:border-navy transition"
        />
        <button
          onClick={handleDownloadTemplate}
          className="text-sm font-medium text-gray-400 border border-dashed border-gray-200
                     bg-white px-4 py-2 rounded-xl hover:bg-gray-50 hover:text-navy transition"
        >
          ↓ Template
        </button>
        <button
          onClick={handleExport}
          className="text-sm font-medium text-navy border border-gray-200
                     bg-white px-4 py-2 rounded-xl hover:bg-gray-50 transition"
        >
          ↓ Export CSV
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="text-sm font-bold bg-navy text-cream px-4 py-2 rounded-xl hover:brightness-110 transition"
        >
          ↑ Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Product table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading stock…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Color</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Try & Buy (Precedence)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Request Toggle</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Try & Buy (Modal)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((p) =>
                p.variants.map((v, vi) => {
                  const level = stockLevel(v.stock);
                  
                  // Compute resolved eligibility for the product
                  const storeOverride = p.store?.tbOverride;
                  let eligible = false;
                  let reason = "";
                  
                  if (storeOverride === "ENABLED") {
                    eligible = true;
                    reason = "Store Override: Enabled";
                  } else if (storeOverride === "DISABLED") {
                    eligible = false;
                    reason = "Store Override: Disabled";
                  } else if (p.tbEligible !== null && p.tbEligible !== undefined) {
                    eligible = p.tbEligible;
                    reason = `Product Override: ${p.tbEligible ? "Yes" : "No"}`;
                  } else {
                    const isCategoryDefault = p.category === "Sneakers" || p.category === "Apparel";
                    eligible = isCategoryDefault;
                    reason = `Category Default: ${isCategoryDefault ? "Yes" : "No"}`;
                  }

                  return (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                      <td className="px-5 py-3 font-medium text-navy">
                        {vi === 0 ? p.name : <span className="text-gray-300">↳</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{v.size}</td>
                      <td className="px-4 py-3 text-gray-500">{v.color || "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-navy">{v.stock}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${level.cls}`}>
                          {level.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {vi === 0 ? (
                          <div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${eligible ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              {eligible ? "Eligible" : "Ineligible"}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-1 italic">({reason})</span>
                            {p.tbRequest && p.tbRequest !== "NONE" && (
                              <span className="text-[10px] bg-yellow text-navy px-1.5 py-0.5 rounded font-semibold block mt-1 w-max mx-auto">
                                Pending: {p.tbRequest === "PENDING_ELIGIBLE" ? "Enable" : "Disable"}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {vi === 0 ? (
                          p.tbRequest && p.tbRequest !== "NONE" ? (
                            <button
                              disabled
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                            >
                              Request Pending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRequestChange(p.id, eligible ? "PENDING_INELIGIBLE" : "PENDING_ELIGIBLE")}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                                eligible
                                  ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                                  : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                              }`}
                            >
                              {eligible ? "Request Disable" : "Request Enable"}
                            </button>
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {vi === 0 ? (() => {
                          const pendingReq = p.tnbRequests?.[0];
                          if (pendingReq) {
                            return (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow text-navy">
                                Pending ({pendingReq.requestedEligible ? "Enable" : "Remove"})
                              </span>
                            );
                          }
                          return (
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                p.tryAndBuyEligible
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-400"
                              }`}>
                                {p.tryAndBuyEligible ? "Eligible" : "Not eligible"}
                              </span>
                              <button
                                onClick={() => { setTnbModal({ product: p }); setTnbNote(""); }}
                                className="text-xs text-navy/50 hover:text-navy underline underline-offset-2 transition"
                              >
                                {p.tryAndBuyEligible ? "Remove" : "Request"}
                              </button>
                            </div>
                          );
                        })() : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No products found</p>
          )}
        </div>
      )}

      {/* T&B request modal */}
      {tnbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setTnbModal(null)} />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-sm p-8">
            <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-yellow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-navy text-center mb-1">
              {tnbModal.product.tryAndBuyEligible ? "Request T&B Removal" : "Request T&B Eligibility"}
            </h2>
            <p className="text-sm text-navy/50 text-center mb-5">
              <span className="font-semibold text-navy">{tnbModal.product.name}</span>
              {" — "}
              {tnbModal.product.tryAndBuyEligible
                ? "Request to remove this product from T&B."
                : "Request to mark this product as Try & Buy eligible."}
              <br />
              <span className="text-xs">An admin will review and approve or reject this request.</span>
            </p>
            <label className="block text-xs font-semibold text-navy mb-1.5">Note (optional)</label>
            <textarea
              value={tnbNote}
              onChange={(e) => setTnbNote(e.target.value)}
              placeholder="Add context for the admin…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-navy
                         placeholder:text-gray-300 focus:outline-none focus:border-navy resize-none transition mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setTnbModal(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-navy border border-navy/20 rounded-xl hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleTnbRequest}
                disabled={tnbSaving}
                className="flex-1 py-2.5 text-sm font-semibold text-navy bg-yellow hover:brightness-95 rounded-xl transition disabled:opacity-50"
              >
                {tnbSaving ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-navy px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <span className="text-cream font-bold">Import Preview — {preview.filter((r) => !r.error).length} changes</span>
              <button onClick={() => setPreview(null)} className="text-cream/50 hover:text-cream text-xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {preview.map((row, i) =>
                row.error ? (
                  <div key={i} className="bg-red-50 text-red-600 text-xs px-4 py-2 rounded-lg">{row.error}</div>
                ) : (
                  <div key={i} className="flex items-center justify-between bg-cream rounded-xl px-4 py-2.5 text-sm">
                    <span className="font-medium text-navy">{row.product} — {row.size}{row.color ? ` / ${row.color}` : ""}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{row.currentStock}</span>
                      <span className="text-gray-300">→</span>
                      <span className={`font-bold ${row.newStock > row.currentStock ? "text-emerald-600" : row.newStock < row.currentStock ? "text-red-500" : "text-gray-400"}`}>
                        {row.newStock}
                      </span>
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setPreview(null)} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={saving}
                className="flex-1 bg-navy text-yellow font-bold py-2.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
