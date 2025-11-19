import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { TripDetail } from '@/pages/TripDetail'
import { Layout } from '@/components/Layout'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="trip/:tripId" element={<TripDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
