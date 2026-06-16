import { useState } from 'react'
import {
  Box, Button, TextField, Typography,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import { Visibility, VisibilityOff, LockOutlined } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuthStore } from '../context/authStore'
import { COLORS } from '../theme/theme'
import { alpha } from '@mui/material/styles'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) { setError('Complete todos los campos'); return }
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(username, password)
      const { access_token, refresh_token, user } = res.data
      setTokens(access_token, refresh_token)
      setUser(user)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error de conexión'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: COLORS.pageBg,
    }}>
      {/* Left panel - branding (azul petróleo) */}
      <Box sx={{
        width: { xs: 0, md: '45%' },
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 6,
        background: `linear-gradient(160deg, ${COLORS.brand} 0%, ${COLORS.brandDark} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <Box sx={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(COLORS.white, 0.08)} 0%, transparent 70%)`,
        }} />
        <Box sx={{
          position: 'absolute', bottom: -60, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(COLORS.white, 0.06)} 0%, transparent 70%)`,
        }} />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              background: alpha(COLORS.white, 0.14),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LockOutlined sx={{ color: COLORS.textOnDark, fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '1.1rem', color: COLORS.textOnDark }}>
              PayApp
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography variant="h2" sx={{ color: COLORS.textOnDark, mb: 2, fontSize: { md: '2.4rem', lg: '2.8rem' }, lineHeight: 1.15 }}>
            Nómina empresarial
            <br />
            <Box component="span" sx={{ color: COLORS.textOnDark, fontWeight: 800 }}>para PYMES.</Box>
          </Typography>
          <Typography sx={{ color: COLORS.textSecondaryOnDark, maxWidth: 360, lineHeight: 1.7, fontSize: '0.95rem' }}>
            Gestiona empleados, calcula nóminas y mantén el control de tu empresa con total seguridad.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 4 }}>
          {[['Empleados', 'Gestión completa'], ['Nómina', 'Cálculo automático'], ['Seguridad', 'Acceso controlado']].map(([label, sub]) => (
            <Box key={label}>
              <Typography sx={{ color: COLORS.textSecondaryOnDark, fontFamily: '"DM Mono", monospace', fontSize: '0.68rem', letterSpacing: '0.1em', mb: 0.5 }}>
                {label.toUpperCase()}
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.textMutedOnDark }}>{sub}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right panel - form */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, md: 6 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '8px', background: COLORS.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LockOutlined sx={{ color: COLORS.textOnDark, fontSize: 16 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, color: COLORS.textPrimary }}>PayApp</Typography>
          </Box>

          <Typography variant="h4" sx={{ mb: 0.75, color: COLORS.textPrimary }}>
            Iniciar sesión
          </Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 4 }}>
            Ingresa tus credenciales para continuar
          </Typography>

          {error && (
            <AppAlert severity="error" sx={{ mb: 3 }}>
              {error}
            </AppAlert>
          )}

          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <Typography variant="caption" sx={{ color: COLORS.textSecondary, mb: 0.75, display: 'block', letterSpacing: '0.05em' }}>
                USUARIO
              </Typography>
              <TextField
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                autoComplete="username"
                disabled={loading}
                sx={{ '& input': { fontSize: '0.9rem' } }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: COLORS.textSecondary, mb: 0.75, display: 'block', letterSpacing: '0.05em' }}>
                CONTRASEÑA
              </Typography>
              <TextField
                fullWidth
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small" sx={{ color: COLORS.textMuted }}>
                        {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ '& input': { fontSize: '0.9rem' } }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              size="large"
              sx={{ mt: 1, py: 1.5, fontSize: '0.9rem' }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: COLORS.white }} /> : 'Ingresar'}
            </Button>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', mt: 4, color: COLORS.textMuted, textAlign: 'center' }}>
            Plataforma de uso interno. Acceso solo personal autorizado.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
