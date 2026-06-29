import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = 'http://localhost:3001/api'

// Build a lookup map: scanCode → { variantId, size, color, productId, productName }
function buildScanMap(order) {
  const map = {}
  for (const item of order.items) {
    for (const v of item.product.allVariants) {
      map[v.scanCode] = {
        variantId: v.id,
        size: v.size,
        color: v.color,
        productId: item.product.id,
        productName: item.product.name,
      }
    }
  }
  return map
}

export default function VerifyScreen({ order, onComplete, onReset }) {
  // Map of orderItemId → 'pending' | 'ok' | 'mismatch'
  const [itemStates, setItemStates] = useState(() =>
    Object.fromEntries(order.items.map(i => [i.id, 'pending']))
  )
  const [scanInput, setScanInput] = useState('')
  const [alert, setAlert] = useState(null) // { type: 'mismatch'|'unknown'|'already', message, detail }
  const [lastOk, setLastOk] = useState(null) // { name, size, color } for flash feedback
  const scanRef = useRef(null)
  const scanMap = buildScanMap(order)

  const allDone = Object.values(itemStates).every(s => s === 'ok')
  const pendingCount = Object.values(itemStates).filter(s => s === 'pending').length
  const [completing, setCompleting] = useState(false)

  async function handleComplete() {
    setCompleting(true)
    try {
      await axios.post(`${API}/kiosk/orders/${order.id}/complete`)
      onComplete({ mode: order.mode })
    } catch {
      setCompleting(false)
    }
  }

  // Keep scan input focused unless alert is showing
  useEffect(() => {
    if (!alert) {
      setTimeout(() => scanRef.current?.focus(), 50)
    }
  }, [alert])

  const processCode = useCallback((raw) => {
    const code = raw.trim().toUpperCase()
    if (!code) return

    // 1. Look up the scanned code
    const scanned = scanMap[code]
    if (!scanned) {
      setAlert({ type: 'unknown', message: 'Unknown item', detail: `Scan code "${code}" not recognised. Check the item and try again.` })
      return
    }

    // 2. Find matching order item (same product)
    const orderItem = order.items.find(i => i.product.id === scanned.productId)
    if (!orderItem) {
      setAlert({ type: 'unknown', message: 'Item not in order', detail: `${scanned.productName} is not part of this order.` })
      return
    }

    // 3. Already verified?
    if (itemStates[orderItem.id] === 'ok') {
      setAlert({ type: 'already', message: 'Already scanned', detail: `${scanned.productName} (${scanned.size}) was already verified.` })
      return
    }

    // 4. Check variant match
    const expected = orderItem.variant
    if (scanned.variantId !== expected.id) {
      const expLabel = [expected.size, expected.color].filter(Boolean).join(' · ')
      const gotLabel = [scanned.size, scanned.color].filter(Boolean).join(' · ')
      const mismatchAlert = {
        type: 'mismatch',
        message: 'Wrong item scanned',
        detail: null,
        expected: { name: orderItem.product.name, label: expLabel },
        scanned:  { name: scanned.productName,    label: gotLabel },
      }
      setAlert(mismatchAlert)
      setItemStates(prev => ({ ...prev, [orderItem.id]: 'mismatch' }))
      // Notify backend → store dashboard + runner app
      axios.post(`${API}/kiosk/orders/${order.id}/mismatch`, {
        expected: { name: orderItem.product.name, variant: expLabel },
        scanned:  { name: scanned.productName,    variant: gotLabel },
      }).catch(() => {})
      return
    }

    // 5. Match!
    setItemStates(prev => ({ ...prev, [orderItem.id]: 'ok' }))
    setLastOk({ name: scanned.productName, size: scanned.size, color: scanned.color })
    setTimeout(() => setLastOk(null), 2000)
  }, [scanMap, itemStates, order.items])

  function handleScanSubmit(e) {
    e.preventDefault()
    processCode(scanInput)
    setScanInput('')
  }

  function dismissAlert() {
    // If mismatch: reset that item back to pending so it can be re-scanned
    if (alert?.type === 'mismatch') {
      const item = order.items.find(i => i.product.name === alert.expected.name)
      if (item) setItemStates(prev => ({ ...prev, [item.id]: 'pending' }))
    }
    setAlert(null)
  }

  const modeLabel = order.mode === 'return' ? 'Return Verification' : 'Collection Verification'
  const modeColor = order.mode === 'return' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Top bar */}
      <div className="bg-navy px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-yellow font-black text-2xl tracking-tight">VODA</span>
          <div className="w-px h-5 bg-white/20" />
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest ${modeColor}`}>
            {modeLabel}
          </span>
        </div>
        <div className="text-right">
          <p className="text-white/50 text-xs uppercase tracking-widest">Order</p>
          <p className="text-yellow font-mono font-black text-lg">#{order.shortId}</p>
        </div>
      </div>

      <div className="flex flex-1 gap-0">
        {/* Left: scan panel */}
        <div className="w-96 bg-white border-r border-navy/8 flex flex-col p-6 gap-5">
          <div>
            <p className="text-navy font-black text-sm uppercase tracking-widest mb-1">Scan Item</p>
            <p className="text-navy/50 text-xs">Point scanner at barcode or type the code below</p>
          </div>

          <form onSubmit={handleScanSubmit} className="flex flex-col gap-3">
            <input
              ref={scanRef}
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value.toUpperCase())}
              placeholder="SCAN CODE"
              className="w-full border-2 border-navy/20 rounded-xl px-4 py-4 text-navy font-mono text-xl font-bold tracking-widest focus:outline-none focus:border-navy placeholder:text-navy/20 text-center"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!scanInput.trim()}
              className="bg-navy text-yellow font-black rounded-xl py-3 disabled:opacity-30 transition-opacity"
            >
              Verify →
            </button>
          </form>

          {/* Success flash */}
          {lastOk && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 text-sm font-semibold text-center animate-pulse">
              ✓ {lastOk.name} · {lastOk.size} verified
            </div>
          )}

          {/* Progress */}
          <div className="mt-auto bg-cream rounded-2xl p-4 text-center">
            <p className="text-navy/50 text-xs uppercase tracking-widest mb-1">Progress</p>
            <p className="text-navy font-black text-3xl">
              {order.items.length - pendingCount}
              <span className="text-navy/30 font-semibold text-xl"> / {order.items.length}</span>
            </p>
            <p className="text-navy/50 text-xs mt-1">items verified</p>
          </div>

          {allDone && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="bg-emerald-500 text-white font-black rounded-xl py-4 text-lg disabled:opacity-60"
            >
              {completing ? 'Confirming…' : 'All Items Verified ✓'}
            </button>
          )}

          <button
            onClick={onReset}
            className="text-navy/30 text-xs underline underline-offset-2 text-center hover:text-navy/60 transition-colors"
          >
            Cancel — Back to start
          </button>
        </div>

        {/* Right: items list */}
        <div className="flex-1 p-8 overflow-y-auto">
          <p className="text-navy font-black text-sm uppercase tracking-widest mb-5">
            {order.mode === 'return' ? 'Expected Return Items' : 'Items to Collect'} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </p>

          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            {order.items.map(item => {
              const state = itemStates[item.id]
              const variantLabel = [item.variant.size, item.variant.color].filter(Boolean).join(' · ')
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  state={state}
                  variantLabel={variantLabel}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Mismatch / alert overlay */}
      {alert && (
        <div className="fixed inset-0 bg-navy/70 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            {alert.type === 'mismatch' ? (
              <>
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="text-2xl font-black text-red-600 mb-2">WRONG ITEM</h2>
                <p className="text-navy/60 text-sm mb-6">This item does not match the order</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-emerald-700 text-xs font-bold uppercase tracking-widest mb-1">Expected</p>
                    <p className="text-emerald-900 font-bold">{alert.expected.name}</p>
                    <p className="text-emerald-700 text-sm font-semibold">{alert.expected.label}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-red-700 text-xs font-bold uppercase tracking-widest mb-1">Scanned</p>
                    <p className="text-red-900 font-bold">{alert.scanned.name}</p>
                    <p className="text-red-700 text-sm font-semibold">{alert.scanned.label}</p>
                  </div>
                </div>
                <p className="text-navy/60 text-sm mb-6">Please locate the correct item and scan again.</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">{alert.type === 'already' ? '✅' : '❓'}</div>
                <h2 className="text-xl font-black text-navy mb-2">{alert.message}</h2>
                <p className="text-navy/60 text-sm mb-6">{alert.detail}</p>
              </>
            )}
            <button
              onClick={dismissAlert}
              className="w-full bg-navy text-yellow font-black rounded-xl py-4 text-lg"
            >
              OK — Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, state, variantLabel }) {
  const [codeVisible, setCodeVisible] = useState(false)
  const stateStyles = {
    pending:  { border: 'border-navy/10',   bg: 'bg-white',         badge: 'bg-gray-100 text-gray-500',   icon: '○' },
    ok:       { border: 'border-emerald-300', bg: 'bg-emerald-50',   badge: 'bg-emerald-100 text-emerald-700', icon: '✓' },
    mismatch: { border: 'border-red-300',    bg: 'bg-red-50',        badge: 'bg-red-100 text-red-700',     icon: '✗' },
  }
  const s = stateStyles[state]

  return (
    <div className={`rounded-2xl border-2 ${s.border} ${s.bg} p-5 flex items-center gap-4 transition-all duration-300`}>
      {/* Status icon */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${s.badge}`}>
        {s.icon}
      </div>

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy text-base leading-tight">{item.product.name}</p>
        <p className="text-navy/60 text-sm mt-0.5">{variantLabel} · ×{item.quantity}</p>
      </div>

      {/* Scan code — hidden by default */}
      <div className="text-right shrink-0">
        <p className="text-navy/30 text-[10px] uppercase tracking-widest mb-1">Barcode</p>
        <div className="flex items-center gap-2 justify-end">
          <p className="font-mono font-bold text-navy/70 text-sm tracking-widest">
            {codeVisible ? item.variant.scanCode : "••••••••"}
          </p>
          <button
            onClick={() => setCodeVisible(v => !v)}
            className="text-navy/30 hover:text-navy/60 transition-colors"
            title={codeVisible ? "Hide" : "Show"}
          >
            {codeVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
