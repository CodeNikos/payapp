import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  InputAdornment, MenuItem, CircularProgress, Tooltip,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, SearchOutlined, ApartmentOutlined, EditOutlined, PersonOffOutlined,
} from '@mui/icons-material'
import { departmentsApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const emptyForm = { name: '', is_active: true }

export default function DepartmentsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await departmentsApi.list({
        search: search || undefined,
        include_inactive: true,
        limit: 200,
      })
      setItems(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setOpenForm(true)
  }

  const handleOpenEdit = (row) => {
    setEditing(row)
    setForm({ name: row.name ?? '', is_active: Boolean(row.is_active) })
    setError('')
    setOpenForm(true)
  }

  const handleCloseForm = () => {
    if (saving) return
    setOpenForm(false)
    setError('')
  }

  const handleSave = async () => {
    const name = form.name.trim()
    if (!name) {
      setError('Indica el nombre del departamento')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await departmentsApi.update(editing.id, {
          name,
          is_active: form.is_active,
        })
        setSuccessMsg('Departamento actualizado')
      } else {
        await departmentsApi.create({ name, is_active: true })
        setSuccessMsg('Departamento creado')
      }
      setOpenForm(false)
      load()
    } catch (e) {
      setError(getApiError(e, 'Error al guardar departamento'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (row) => {
    if (!confirm(`¿Desactivar el departamento "${row.name}"?`)) return
    try {
      await departmentsApi.deactivate(row.id)
      setSuccessMsg(`Departamento "${row.name}" desactivado`)
      load()
    } catch (e) {
      setError(getApiError(e, 'Error al desactivar'))
    }
  }

  const field = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Departamentos</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            Catálogo usado al crear y editar empleados
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
          Nuevo departamento
        </Button>
      </Box>

      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')}>{successMsg}</AppAlert>
      )}
      {error && !openForm && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')}>{error}</AppAlert>
      )}

      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Buscar departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ color: COLORS.textMuted, fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 320 } }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Nombre', 'Estado', 'Acciones'].map((h) => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} sx={{ textAlign: 'center', py: 6 }}>
                  <ApartmentOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin departamentos</Typography>
                </TableCell>
              </TableRow>
            ) : items.map((row) => (
              <TableRow key={row.id} sx={{ opacity: row.is_active ? 1 : 0.55 }}>
                <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                <TableCell>
                  <Chip
                    label={row.is_active ? 'activo' : 'inactivo'}
                    size="small"
                    color={row.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenEdit(row)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                        <EditOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {row.is_active && (
                      <Tooltip title="Desactivar">
                        <IconButton size="small" onClick={() => handleDeactivate(row)}
                          sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}>
                          <PersonOffOutlined sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          {editing ? 'Editar departamento' : 'Nuevo departamento'}
        </DialogTitle>
        <DialogContent>
          {error && <AppAlert severity="error" sx={{ mb: 1 }}>{error}</AppAlert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre"
                value={form.name}
                onChange={(e) => field('name', e.target.value)}
                autoFocus
              />
            </Grid>
            {editing && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Estado"
                  value={form.is_active ? 'activo' : 'inactivo'}
                  onChange={(e) => field('is_active', e.target.value === 'activo')}
                >
                  <MenuItem value="activo">Activo</MenuItem>
                  <MenuItem value="inactivo">Inactivo</MenuItem>
                </TextField>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${COLORS.borderSubtle}`, pt: 2 }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving
              ? <CircularProgress size={18} sx={{ color: COLORS.white }} />
              : (editing ? 'Guardar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
