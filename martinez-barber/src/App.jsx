import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Booking from './pages/Booking.jsx'
import AdminLogin from './admin/AdminLogin.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'
import AdminBookings from './admin/AdminBookings.jsx'
import AdminSettings from './admin/AdminSettings.jsx'
import AdminReviews from './admin/AdminReviews.jsx'
import AdminSystem from './admin/AdminSystem.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/reservar" element={<Booking />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="citas" element={<AdminBookings />} />
        <Route path="ajustes" element={<AdminSettings />} />
        <Route path="resenas" element={<AdminReviews />} />
        <Route path="sistema" element={<AdminSystem />} />
      </Route>
    </Routes>
  )
}
