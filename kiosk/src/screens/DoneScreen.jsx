export default function DoneScreen({ order, onReset }) {
  const isReturn = order.mode === 'return'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-8 text-center">
      <div className="bg-white rounded-3xl shadow-xl border border-navy/5 p-12 w-full max-w-lg">
        <div className="text-7xl mb-6">{isReturn ? '📦' : '✅'}</div>

        <h1 className="text-3xl font-black text-navy mb-2">
          {isReturn ? 'Return Accepted' : 'Collection Verified'}
        </h1>
        <p className="text-navy/50 text-base mb-8">
          {isReturn
            ? 'All returned items match the order. Proceed to confirm in the runner app.'
            : 'All items have been verified and match the order. Proceed with pickup.'}
        </p>

        <div className="bg-cream rounded-2xl p-5 mb-8 text-left space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-navy/50 text-sm font-medium">Order</span>
            <span className="text-navy font-mono font-black">#{order.shortId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-navy/50 text-sm font-medium">Items verified</span>
            <span className="text-navy font-bold">{order.items.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-navy/50 text-sm font-medium">Mode</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isReturn ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
              {isReturn ? 'Return' : 'Collection'}
            </span>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full bg-navy text-yellow font-black rounded-xl py-4 text-lg"
        >
          Start New Scan
        </button>
      </div>
    </div>
  )
}
