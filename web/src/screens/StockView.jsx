import { useEffect, useRef, useState } from "react";
import { fetchStoreProducts, bulkUpdateStock } from "../api/products";

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
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((p) =>
                p.variants.map((v, vi) => {
                  const level = stockLevel(v.stock);
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
