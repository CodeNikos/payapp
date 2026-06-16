import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../context/authStore'

export default function ProtectedRoute({ children, adminOnly }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
