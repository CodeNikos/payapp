import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress,
  MenuItem, Chip, FormControlLabel, Switch, InputAdornment,
} from '@mui/material'
import {
  AddOutlined, EditOutlined, DeleteOutlined, SearchOutlined, MoneyOffOutlined,
} from '@mui/icons-material'
import AppAlert from '../components/common/AppAlert'
import { recurringDeductionsApi, employeesApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const emptyForm = {
  employee_id: '',
  concept: '',
  amount: '',
  frequency: 'mensual',
  monthly_quincena: '1',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  is_active: true,
}

function money(v) {
  return `$${parseFloat(v || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`
}

export default function RecurringDeductionsPage() {
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dedRes, empRes] = await Promise.all([
        recurringDeductionsApi.list({ active_only: activeOnly || undefined }),
        employeesApi.list({ limit: 200 }),
      ])
      setItems(dedRes.data.items || [])
      const list = Array.isArray(empRes.data) ? empRes.data : []
      setEmployees(list.filter((e) => e.is_active !== false && e.status !== 'inactivo'))
    } catch (e) {
      setError(getApiError(e, 'Error al cargar descuentos'))
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((row) =>
      (row.employee_name || '').toLowerCase().includes(q)
      || (row.document_id || '').toLowerCase().includes(q)
      || (row.concept || '').toLowerCase().includes(q),
    )
  }, [items, search])

  const field = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpenForm(true)
    setError('')
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      employee_id: String(row.employee_id),
      concept: row.concept || '',
      amount: String(row.amount ?? ''),
      frequency: row.frequency || 'mensual',
      monthly_quincena: String(row.monthly_quincena || 1),
      start_date: row.start_date || '',
      end_date: row.end_date || '',
      is_active: Boolean(row.is_active),
    })
    setOpenForm(true)
    setError('')
  }

  const handleSave = async () => {
    if (!form.employee_id) {
      setError('Selecciona un empleado')
      return
    }
    if (!form.concept.trim()) {
      setError('Indica el concepto')
      return
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Indica un monto válido')
      return
    }
    if (!form.start_date) {
      setError('Indica la fecha de inicio')
      return
    }
    if (form.frequency === 'mensual' && !form.monthly_quincena) {
      setError('Selecciona la quincena para descuento mensual')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        employee_id: parseInt(form.employee_id, 10),
        concept: form.concept.trim(),
        amount: parseFloat(form.amount),
        frequency: form.frequency,
        monthly_quincena: form.frequency === 'mensual' ? parseInt(form.monthly_quincena, 10) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: form.is_active,
      }
      if (editing) {
        const { employee_id: _omit, ...updatePayload } = payload
        await recurringDeductionsApi.update(editing.id, updatePayload)
        setSuccessMsg('Descuento actualizado')
      } else {
        await recurringDeductionsApi.create(payload)
        setSuccessMsg('Descuento creado')
      }
      setOpenForm(false)
      await load()
    } catch (e) {
      setError(getApiError(e, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await recurringDeductionsApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      setSuccessMsg('Descuento eliminado')
      await load()
    } catch (e) {
      setError(getApiError(e, 'Error al eliminar'))
    } finally {
      setDeleting(false)
    }
  }

  const activeEmployees = employees

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>
            Descuentos recurrentes
          </Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            Conceptos que se aplican automáticamente al generar la nómina según frecuencia
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate} size="small">
          Nuevo descuento
        </Button>
      </Box>

      {error && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </AppAlert>
      )}
      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>
          {successMsg}
        </AppAlert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar empleado o concepto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 18, color: COLORS.textMuted }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              size="small"
            />
          }
          label="Solo activos"
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Empleado</TableCell>
                <TableCell>Concepto</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell>Frecuencia</TableCell>
                <TableCell>Vigencia</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: COLORS.textMuted }}>
                    <MoneyOffOutlined sx={{ fontSize: 36, mb: 1, opacity: 0.4, display: 'block', mx: 'auto' }} />
                    No hay descuentos configurados
                  </TableCell>
                </TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.employee_name}</Typography>
                    <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.72rem', color: COLORS.textMuted }}>
                      {row.document_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.concept}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: '"DM Mono", monospace' }}>{money(row.amount)}</TableCell>
                  <TableCell>
                    {row.frequency === 'mensual'
                      ? `Mensual · ${row.monthly_quincena === 2 ? '2.ª' : '1.ª'} quincena`
                      : 'Quincenal (÷ 2)'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {row.start_date}{row.end_date ? ` → ${row.end_date}` : ' → vigente'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.is_active ? 'Activo' : 'Inactivo'}
                      color={row.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(row)}>
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" onClick={() => setDeleteTarget(row)}>
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openForm} onClose={() => !saving && setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar descuento' : 'Nuevo descuento recurrente'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Empleado"
                value={form.employee_id}
                onChange={(e) => field('employee_id', e.target.value)}
                disabled={Boolean(editing)}
              >
                {activeEmployees.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {e.first_name} {e.last_name} · {e.document_id}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Concepto"
                value={form.concept}
                onChange={(e) => field('concept', e.target.value)}
                placeholder="Ej. Préstamo personal, Seguro médico…"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monto"
                type="number"
                value={form.amount}
                onChange={(e) => field('amount', e.target.value)}
                inputProps={{ min: 0.01, step: 0.01 }}
                helperText={form.frequency === 'quincenal' ? 'Se divide entre 2 por quincena' : 'Monto completo en la quincena elegida'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Frecuencia"
                value={form.frequency}
                onChange={(e) => field('frequency', e.target.value)}
              >
                <MenuItem value="mensual">Mensual</MenuItem>
                <MenuItem value="quincenal">Quincenal</MenuItem>
              </TextField>
            </Grid>
            {form.frequency === 'mensual' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Quincena de aplicación"
                  value={form.monthly_quincena}
                  onChange={(e) => field('monthly_quincena', e.target.value)}
                >
                  <MenuItem value="1">1.ª quincena (período que termina el día 1–15)</MenuItem>
                  <MenuItem value="2">2.ª quincena (período que termina el día 16–fin de mes)</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Inicio vigencia"
                type="date"
                value={form.start_date}
                onChange={(e) => field('start_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fin vigencia (opcional)"
                type="date"
                value={form.end_date}
                onChange={(e) => field('end_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => field('is_active', e.target.checked)}
                  />
                }
                label="Activo"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Eliminar descuento</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el descuento <strong>{deleteTarget?.concept}</strong> de{' '}
            <strong>{deleteTarget?.employee_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={18} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
