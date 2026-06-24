import { useState } from 'react'
import LandingScreen from './screens/LandingScreen'
import VerifyScreen from './screens/VerifyScreen'
import DoneScreen from './screens/DoneScreen'

export default function App() {
  const [screen, setScreen] = useState('landing') // 'landing' | 'verify' | 'done'
  const [order, setOrder] = useState(null)

  function handleOrderLoaded(loadedOrder) {
    setOrder(loadedOrder)
    setScreen('verify')
  }

  function handleVerifyComplete(result) {
    setOrder(prev => ({ ...prev, verifyResult: result }))
    setScreen('done')
  }

  function handleReset() {
    setOrder(null)
    setScreen('landing')
  }

  return (
    <div className="min-h-screen bg-cream font-sans">
      {screen === 'landing' && <LandingScreen onOrderLoaded={handleOrderLoaded} />}
      {screen === 'verify'  && <VerifyScreen  order={order} onComplete={handleVerifyComplete} onReset={handleReset} />}
      {screen === 'done'    && <DoneScreen    order={order} onReset={handleReset} />}
    </div>
  )
}
