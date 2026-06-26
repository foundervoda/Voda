import { useState, useRef } from 'react'
import axios from 'axios'

const API = 'http://localhost:3001/api'

export default function LandingScreen({ onOrderLoaded }) {
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const id = orderId.trim()
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get(`${API}/kiosk/orders/${id}`)
      onOrderLoaded(data.data.order)
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? 'Could not load order. Check the ID and try again.'
      setError(msg)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-8">
      {/* Logo / header */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-3 bg-navy rounded-2xl px-6 py-3 mb-6">
          <span className="text-yellow font-black text-3xl tracking-tight">VODA</span>
          <div className="w-px h-6 bg-white/20" />
          <span className="text-white/80 font-semibold text-sm uppercase tracking-widest">Kiosk</span>
        </div>
        <p className="text-navy/60 text-lg font-medium">Scan &amp; Verify Package Contents</p>
      </div>

      {/* Order ID form */}
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg border border-navy/5 p-8">
          <label className="block text-navy font-bold text-sm uppercase tracking-widest mb-3">
            Enter Order ID
          </label>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={orderId}
            onChange={e => { setOrderId(e.target.value.toUpperCase()); setError(null) }}
            placeholder="e.g. FED9B6 or full UUID"
            className="w-full border-2 border-navy/15 rounded-xl px-4 py-4 text-navy font-mono text-lg focus:outline-none focus:border-navy transition-colors placeholder:text-navy/25 uppercase tracking-widest text-center"
          />

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            className="mt-5 w-full bg-navy text-yellow font-black text-lg rounded-xl py-4 disabled:opacity-40 transition-opacity active:scale-[0.98]"
          >
            {loading ? 'Loading…' : 'Load Order →'}
          </button>
        </form>

        <p className="text-center text-navy/40 text-sm mt-6">
          Enter the 6-character order code shown on the store dashboard (e.g. <span className="font-mono font-bold">FED9B6</span>), or scan the full Order ID barcode.
        </p>
      </div>
    </div>
  )
}
