import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, TextField,
  Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, IconButton, Tooltip,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  SearchOutlined, BeachAccessOutlined, EventNoteOutlined, HistoryOutlined, EditOutlined, DeleteOutlined,
} from '@mui/icons-material'
import { reportsApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'
import { alpha } from '@mui/material/styles'

const VACATION_RATE = 30 / 11

function calcPayment(salary, days) {
  if (!salary || !days) return 0
  return parseFloat(days) * (parseFloat(salary) / 30)
}

function addVacationDaysToDate(start, days) {
  if (!start || !days || parseFloat(days) <= 0) return ''
  const calendarDays = Math.max(1, Math.ceil(parseFloat(days)))
  const d = new Date(`${start}T00:00:00`)
  d.setDate(d.getDate() + calendarDays - 1)
  return d.toISOString().slice(0, 10)
}

function VacationsReportTab() {
  const [items, setItems] = useState([])
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await reportsApi.vacations({ as_of: asOf || undefined })
      setItems(res.data.items)
    } catch (e) {
      setError(getApiError(e, 'Error al cargar reporte'))
    } finally {
      setLoading(false)
    }
  }, [asOf])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((row) =>
      row.employee_name.toLowerCase().includes(q)
      || row.document_id.toLowerCase().includes(q),
    )
  }, [items, search])

  const fmt = (v) => parseFloat(v).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtMoney = (v) => `$${parseFloat(v).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`

  return (
    <Box>
      {error && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </AppAlert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <TextField
          size="small"
          label="Fecha de consulta"
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: '100%', sm: 200 } }}
        />
        <TextField
          size="small"
          placeholder="Buscar por nombre o cédula"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 18, color: COLORS.textMuted }} />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontSize: '0.8rem' }}>
          Acumulación: meses × ({fmt(VACATION_RATE)} días/mes) · Pago: días × (salario ÷ 30)
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Nombre', 'Cédula', 'Fecha de ingreso', 'Días acumulados', 'Salario base'].map((h) => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                  <BeachAccessOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin empleados en el reporte</Typography>
                </TableCell>
              </TableRow>
            ) : filtered.map((row) => (
              <TableRow key={row.employee_id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{row.employee_name}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{row.document_id}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem' }}>{row.hire_date}</TableCell>
                <TableCell sx={{
                  fontFamily: '"DM Mono", monospace',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: COLORS.brand,
                }}>
                  {fmt(row.accumulated_days)}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>
                  {fmtMoney(row.base_salary)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function VacationsTakenReportTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ days: '', start_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      const res = await reportsApi.vacationsTaken(params)
      setItems(res.data.items)
    } catch (e) {
      setError(getApiError(e, 'Error al cargar reporte'))
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((row) =>
      row.employee_name.toLowerCase().includes(q)
      || row.document_id.toLowerCase().includes(q),
    )
  }, [items, search])

  const fmt = (v) => parseFloat(v).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtMoney = (v) => `$${parseFloat(v).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`

  const openEdit = (row) => {
    setEditing(row)
    setEditForm({
      days: String(row.days ?? ''),
      start_date: row.start_date || '',
      notes: row.notes || '',
    })
    setError('')
  }

  const closeEdit = () => {
    if (saving) return
    setEditing(null)
    setError('')
  }

  const effectiveDays = editForm.days ? parseFloat(editForm.days) : null
  const computedEndDate = effectiveDays
    ? addVacationDaysToDate(editForm.start_date, effectiveDays)
    : ''
  const previewAmount = editing && effectiveDays
    ? calcPayment(editing.base_salary, effectiveDays)
    : null

  const handleSaveEdit = async () => {
    if (!editing) return
    const days = editForm.days ? parseFloat(editForm.days) : null
    if (!editForm.start_date) {
      setError('Indica la fecha de inicio')
      return
    }
    if (!days || days <= 0) {
      setError('Indica los días de vacaciones')
      return
    }

    setSaving(true)
    setError('')
    try {
      await reportsApi.updateVacationUsage(editing.id, {
        start_date: editForm.start_date,
        days,
        notes: editForm.notes || null,
      })
      setEditing(null)
      setSuccessMsg(`Vacaciones actualizadas para ${editing.employee_name}`)
      await load()
    } catch (e) {
      setError(getApiError(e, 'Error al actualizar vacaciones'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`¿Eliminar las vacaciones de ${row.employee_name} (${fmt(row.days)} días)?`)) return
    setError('')
    try {
      await reportsApi.deleteVacationUsage(row.id)
      if (editing?.id === row.id) setEditing(null)
      setSuccessMsg(`Vacaciones eliminadas para ${row.employee_name}`)
      await load()
    } catch (e) {
      setError(getApiError(e, 'Error al eliminar vacaciones'))
    }
  }

  return (
    <Box>
      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>
          {successMsg}
        </AppAlert>
      )}
      {error && !editing && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </AppAlert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <TextField
          size="small"
          label="Desde"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: '100%', sm: 170 } }}
        />
        <TextField
          size="small"
          label="Hasta"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: '100%', sm: 170 } }}
        />
        <TextField
          size="small"
          placeholder="Buscar por nombre o cédula"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 18, color: COLORS.textMuted }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Empleado', 'Cédula', 'Fecha inicio', 'Fecha fin', 'Días', 'Monto pagado', 'Acciones'].map((h) => (
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                  <HistoryOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin vacaciones registradas</Typography>
                </TableCell>
              </TableRow>
            ) : filtered.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{row.employee_name}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{row.document_id}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem' }}>{row.start_date}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem' }}>{row.end_date}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', fontWeight: 700, color: COLORS.brand }}>
                  {fmt(row.days)}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>
                  {fmtMoney(row.amount)}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => openEdit(row)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}
                      >
                        <EditOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(row)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}
                      >
                        <DeleteOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(editing)} onClose={closeEdit} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Editar vacaciones tomadas
        </DialogTitle>
        <DialogContent>
          {error && editing && <AppAlert severity="error">{error}</AppAlert>}
          {editing && (
            <>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2 }}>
                <strong>{editing.employee_name}</strong>
              </Typography>
              <TextField
                fullWidth
                label="Fecha inicio"
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Días tomados"
                type="number"
                value={editForm.days}
                onChange={(e) => setEditForm((f) => ({ ...f, days: e.target.value }))}
                inputProps={{ min: 0.01, step: 0.01 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Fecha fin"
                type="date"
                value={computedEndDate}
                InputLabelProps={{ shrink: true }}
                InputProps={{ readOnly: true }}
                helperText="Calculada: inicio + días de vacaciones"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Notas (opcional)"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                multiline
                rows={2}
                sx={{ mb: 1 }}
              />
              {previewAmount != null && (
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: COLORS.brandMuted,
                  border: `1px solid ${alpha(COLORS.brand, 0.2)}`,
                }}>
                  <Typography sx={{ fontSize: '0.82rem', color: COLORS.textSecondary }}>Monto recalculado</Typography>
                  <Typography sx={{ fontFamily: '"DM Mono", monospace', fontWeight: 700, color: COLORS.brand }}>
                    {fmtMoney(previewAmount)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: COLORS.textMuted, mt: 0.5 }}>
                    {effectiveDays} × ({fmtMoney(editing.base_salary)} ÷ 30)
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeEdit} disabled={saving} sx={{ color: COLORS.textSecondary }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving}>
            {saving ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Reportería</Typography>
        <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
          Consultas y reportes del sistema de nómina
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            borderBottom: `1px solid ${COLORS.borderSubtle}`,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
          }}
        >
          <Tab icon={<BeachAccessOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Días acumulados" />
          <Tab icon={<HistoryOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Vacaciones tomadas" />
          <Tab icon={<EventNoteOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Más reportes" disabled />
        </Tabs>
      </Paper>

      {tab === 0 && <VacationsReportTab />}
      {tab === 1 && <VacationsTakenReportTab />}
      {tab === 2 && (
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <Typography sx={{ color: COLORS.textMuted }}>Más reportes próximamente</Typography>
        </Paper>
      )}
    </Box>
  )
}
