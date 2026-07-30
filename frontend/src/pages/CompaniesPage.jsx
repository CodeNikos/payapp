import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  InputAdornment, MenuItem, CircularProgress, Tooltip,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, SearchOutlined, BusinessOutlined, EditOutlined,
} from '@mui/icons-material'
import { companiesApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const STATUSES = ['activo', 'cancelado']

const statusColor = {
  activo: 'success',
  cancelado: 'error',
}

const emptyForm = {
  commercial_name: '',
  legal_name: '',
  ruc: '',
  dv: '',
  status: 'activo',
}

function companyToForm(company) {
  return {
    commercial_name: company.commercial_name ?? '',
    legal_name: company.legal_name ?? '',
    ruc: company.ruc ?? '',
    dv: company.dv ?? '',
    status: company.status ?? 'activo',
  }
}

function buildPayload(form) {
  return {
    commercial_name: form.commercial_name.trim(),
    legal_name: form.legal_name.trim(),
    ruc: form.ruc.trim(),
    dv: form.dv.trim(),
    status: form.status,
  }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PA')
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await companiesApi.list({ search: search || undefined, limit: 200 })
      setCompanies(res.data)
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

  const handleOpenEdit = (company) => {
    setEditing(company)
    setForm(companyToForm(company))
    setError('')
    setOpenForm(true)
  }

  const handleCloseForm = () => {
    if (saving) return
    setOpenForm(false)
    setEditing(null)
    setError('')
  }

  const handleSave = async () => {
    if (!form.commercial_name.trim() || !form.legal_name.trim() || !form.ruc.trim() || !form.dv.trim()) {
      setError('Completa razón comercial, razón social, RUC y DV')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload(form)
      if (editing) {
        await companiesApi.update(editing.id, payload)
      } else {
        const { status, ...createPayload } = payload
        await companiesApi.create({ ...createPayload, status: status || 'activo' })
      }
      setOpenForm(false)
      setEditing(null)
      setForm(emptyForm)
      load()
    } catch (e) {
      setError(getApiError(e, editing ? 'Error al actualizar empresa' : 'Error al crear empresa'))
    } finally {
      setSaving(false)
    }
  }

  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Empresas</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
          Nueva empresa
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Buscar por nombre, RUC o código..."
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

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Código', 'Razón comercial', 'Razón social', 'RUC', 'DV', 'Estado', 'Creada', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6 }}>
                  <BusinessOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin empresas registradas</Typography>
                </TableCell>
              </TableRow>
            ) : companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.accent }}>
                  {company.company_code}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{company.commercial_name}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{company.legal_name}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{company.ruc}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{company.dv}</TableCell>
                <TableCell>
                  <Chip
                    label={company.status}
                    size="small"
                    color={statusColor[company.status] || 'default'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.textMuted }}>
                  {formatDate(company.created_at)}
                </TableCell>
                <TableCell>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleOpenEdit(company)}
                      sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                      <EditOutlined sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth scroll="body" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          {editing ? 'Editar empresa' : 'Nueva empresa'}
        </DialogTitle>
        <DialogContent>
          {error && <AppAlert severity="error">{error}</AppAlert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {editing && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Código interno"
                  value={editing.company_code}
                  disabled
                  size="small"
                  sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: COLORS.textSecondary } }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Razón comercial / Nombre"
                value={form.commercial_name}
                onChange={e => field('commercial_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Razón social / Dueño"
                value={form.legal_name}
                onChange={e => field('legal_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                fullWidth
                label="RUC"
                value={form.ruc}
                onChange={e => field('ruc', e.target.value)}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="DV"
                value={form.dv}
                onChange={e => field('dv', e.target.value)}
              />
            </Grid>
            {editing && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Estado"
                  value={form.status}
                  onChange={e => field('status', e.target.value)}
                >
                  {STATUSES.map(s => (
                    <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                  ))}
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
