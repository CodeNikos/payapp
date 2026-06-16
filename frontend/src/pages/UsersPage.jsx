import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, CircularProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, InputAdornment,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  BlockOutlined, CheckCircleOutlined, AddOutlined,
  AdminPanelSettingsOutlined, BadgeOutlined, PersonAddOutlined,
  Visibility, VisibilityOff,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { usersApi, authApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const emptyForm = { email: '', username: '', full_name: '', role: 'operador_nomina', password: '' }

const ROLE_OPTIONS = [
  {
    value: 'operador_nomina',
    label: 'Operador de Nómina',
    description: 'Gestiona empleados y procesa nóminas del período.',
    icon: BadgeOutlined,
  },
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acceso completo: usuarios, configuración y aprobaciones.',
    icon: AdminPanelSettingsOutlined,
  },
]

function RoleOptionCard({ option, selected, onSelect }) {
  const Icon = option.icon
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(option.value)}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.75,
        m: 0,
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 2,
        border: `1.5px solid ${selected ? COLORS.brand : COLORS.borderSubtle}`,
        bgcolor: selected ? COLORS.brandMuted : COLORS.cardBg,
        font: 'inherit',
        color: 'inherit',
        appearance: 'none',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: selected ? `0 0 0 3px ${alpha(COLORS.brand, 0.12)}` : 'none',
        '&:hover': {
          borderColor: selected ? COLORS.brand : alpha(COLORS.brand, 0.45),
          bgcolor: selected ? COLORS.brandMuted : alpha(COLORS.brand, 0.03),
        },
        '&:focus-visible': {
          outline: `2px solid ${alpha(COLORS.brand, 0.55)}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box sx={{
        width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: selected ? alpha(COLORS.brand, 0.14) : alpha(COLORS.textSecondary, 0.08),
        color: selected ? COLORS.brand : COLORS.textSecondary,
      }}>
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pr: 0.5 }}>
        <Typography component="span" display="block" sx={{ fontWeight: 600, fontSize: '0.9rem', color: COLORS.textPrimary, mb: 0.5, lineHeight: 1.35 }}>
          {option.label}
        </Typography>
        <Typography component="span" display="block" sx={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: 1.45 }}>
          {option.description}
        </Typography>
      </Box>
      <Box sx={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, mt: 0.25,
        border: `2px solid ${selected ? COLORS.brand : COLORS.borderSubtle}`,
        bgcolor: selected ? COLORS.brand : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.white }} />}
      </Box>
    </Box>
  )
}

export default function UsersPage() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [form, setForm]         = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await usersApi.list(); setUsers(res.data) } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpenForm = () => {
    setError('')
    setShowPwd(false)
    setForm(emptyForm)
    setOpenForm(true)
  }

  const handleCloseForm = () => {
    if (saving) return
    setOpenForm(false)
    setError('')
    setShowPwd(false)
  }

  const handleToggle = async (id) => {
    try { await usersApi.toggleActive(id); load() } catch { /* ignore */ }
  }

  const handleCreate = async () => {
    setSaving(true); setError('')
    try {
      await authApi.register(form)
      setOpenForm(false)
      setForm(emptyForm)
      load()
    } catch (e) { setError(getApiError(e, 'Error al crear usuario')) }
    finally { setSaving(false) }
  }

  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const canSubmit = form.full_name.trim() && form.username.trim() && form.email.trim() && form.password.length >= 8

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Usuarios del Sistema</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>{users.length} usuarios registrados</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenForm} size="small">
          Nuevo usuario
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Usuario', 'Nombre completo', 'Correo', 'Rol', 'Último acceso', 'Estado', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id}>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.accent }}>{u.username}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{u.full_name}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem', color: COLORS.textSecondary }}>{u.email}</TableCell>
                <TableCell>
                  <Chip
                    label={u.role === 'admin' ? 'Admin' : 'Operador'}
                    size="small"
                    color={u.role === 'admin' ? 'primary' : 'default'}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.78rem', fontFamily: '"DM Mono", monospace', color: COLORS.textMuted }}>
                  {u.last_login ? new Date(u.last_login).toLocaleString('es-PA') : 'Nunca'}
                </TableCell>
                <TableCell>
                  <Chip label={u.is_active ? 'Activo' : 'Inactivo'} size="small" color={u.is_active ? 'success' : 'error'} />
                </TableCell>
                <TableCell>
                  <Tooltip title={u.is_active ? 'Desactivar' : 'Activar'}>
                    <IconButton size="small" onClick={() => handleToggle(u.id)}
                      sx={{ color: COLORS.textMuted, '&:hover': { color: u.is_active ? COLORS.error : COLORS.success } }}>
                      {u.is_active ? <BlockOutlined sx={{ fontSize: 16 }} /> : <CheckCircleOutlined sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={openForm}
        onClose={handleCloseForm}
        maxWidth="sm"
        fullWidth
        scroll="body"
        PaperProps={{ sx: { borderRadius: 3, overflow: 'visible' } }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2.5, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '10px',
              bgcolor: COLORS.brandMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.brand,
            }}>
              <PersonAddOutlined />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '1.15rem', color: COLORS.textPrimary, lineHeight: 1.2 }}>
                Nuevo usuario
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary, mt: 0.25 }}>
                Registra un acceso autorizado al sistema
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 1, pb: 1, overflow: 'visible' }}>
          {error && <AppAlert severity="error">{error}</AppAlert>}

          <Typography sx={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
            mb: 1.5,
          }}>
            Datos de identidad
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre completo"
                value={form.full_name}
                onChange={e => field('full_name', e.target.value)}
                placeholder="Ej. María González"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Usuario"
                value={form.username}
                onChange={e => field('username', e.target.value)}
                placeholder="nombre.apellido"
                helperText="Identificador de inicio de sesión"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Correo electrónico"
                value={form.email}
                onChange={e => field('email', e.target.value)}
                type="email"
                placeholder="usuario@empresa.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Contraseña temporal"
                value={form.password}
                onChange={e => field('password', e.target.value)}
                type={showPwd ? 'text' : 'password'}
                helperText="Mín. 8 caracteres, una mayúscula y un número"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPwd(!showPwd)}
                        edge="end"
                        size="small"
                        sx={{ color: COLORS.textMuted }}
                        aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>

          <Typography sx={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
            mt: 3,
            mb: 1.5,
          }}>
            Rol y permisos
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {ROLE_OPTIONS.map((option) => (
              <RoleOptionCard
                key={option.value}
                option={option}
                selected={form.role === option.value}
                onSelect={(value) => field('role', value)}
              />
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1, borderTop: `1px solid ${COLORS.borderSubtle}` }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !canSubmit}>
            {saving ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
