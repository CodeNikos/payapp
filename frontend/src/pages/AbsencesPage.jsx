import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  MenuItem, CircularProgress, Tooltip, RadioGroup, FormControlLabel,
  Radio, FormLabel, FormControl, Link,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, EventBusyOutlined, EditOutlined, DeleteOutlined,
  CloudUploadOutlined, OpenInNewOutlined, FilterListOutlined,
} from '@mui/icons-material'
import { absencesApi, employeesApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const MONTH_OPTIONS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

const ALL_FILTER = ''

function dateParts(dateStr) {
  if (!dateStr || dateStr.length < 7) return null
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  if (!year || !month) return null
  return { year, month }
}

/** True si el rango de la ausencia solapa el mes/año indicado. */
function absenceOverlapsPeriod(row, year, month) {
  const start = dateParts(row.start_date)
  const end = dateParts(row.end_date) || start
  if (!start) return false

  if (year != null && month != null) {
    const periodStart = year * 12 + month
    const absStart = start.year * 12 + start.month
    const absEnd = end.year * 12 + end.month
    return absStart <= periodStart && absEnd >= periodStart
  }
  if (year != null) {
    return start.year <= year && end.year >= year
  }
  if (month != null) {
    const absStart = start.year * 12 + start.month
    const absEnd = end.year * 12 + end.month
    for (let ym = absStart; ym <= absEnd; ym += 1) {
      if (((ym - 1) % 12) + 1 === month) return true
    }
    return false
  }
  return true
}

const ABSENCE_TYPES = [
  {
    value: 'injustificada',
    label: 'Injustificada',
    hint: 'Se descuenta del salario o de vacaciones acumuladas.',
    justified: false,
    defaultDays: 1,
  },
  {
    value: 'incapacidad',
    label: 'Incapacidad (enfermedad/accidente)',
    hint: 'Evidencia opcional. Pago según fondo acumulado del trabajador.',
    justified: true,
    defaultDays: 1,
  },
  {
    value: 'maternidad',
    label: 'Maternidad',
    hint: '6 semanas antes y 8 después del parto (sugerido 98 días).',
    justified: true,
    defaultDays: 98,
  },
  {
    value: 'paternidad',
    label: 'Paternidad',
    hint: 'Permiso remunerado de 3 días hábiles.',
    justified: true,
    defaultDays: 3,
  },
  {
    value: 'duelo',
    label: 'Duelo',
    hint: 'Permiso pagado por fallecimiento de familiares cercanos (3–5 días).',
    justified: true,
    defaultDays: 3,
  },
  {
    value: 'atencion_discapacidad',
    label: 'Atención a personas con discapacidad',
    hint: 'Ley 15 de 2016: hasta 144 horas anuales.',
    justified: true,
    defaultDays: 1,
  },
  {
    value: 'matrimonio',
    label: 'Matrimonio',
    hint: 'Licencia según reglamento interno.',
    justified: true,
    defaultDays: 3,
  },
  {
    value: 'otros',
    label: 'Otros',
    hint: 'Justificada. Comentarios obligatorios; evidencia opcional.',
    justified: true,
    defaultDays: 1,
  },
]

const statusColor = {
  registrada: 'warning',
  aplicada: 'success',
  anulada: 'error',
}

const emptyForm = {
  employee_id: '',
  absence_type: 'injustificada',
  start_date: '',
  end_date: '',
  days: '1',
  deduction_mode: 'salario',
  comments: '',
}

function daysBetween(start, end) {
  if (!start || !end) return 1
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1
  return Math.floor((b - a) / 86400000) + 1
}

function typeMeta(value) {
  return ABSENCE_TYPES.find(t => t.value === value) || ABSENCE_TYPES[0]
}

export default function AbsencesPage() {
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [filterYear, setFilterYear] = useState(ALL_FILTER)
  const [filterMonth, setFilterMonth] = useState(ALL_FILTER)
  const [filterEmployeeId, setFilterEmployeeId] = useState(ALL_FILTER)

  const hasActiveFilters = filterYear !== ALL_FILTER || filterMonth !== ALL_FILTER || filterEmployeeId !== ALL_FILTER

  const empById = useMemo(
    () => Object.fromEntries(employees.map(e => [e.id, e])),
    [employees],
  )

  const filterYearOptions = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    items.forEach((row) => {
      const start = dateParts(row.start_date)
      const end = dateParts(row.end_date)
      if (start) years.add(start.year)
      if (end) years.add(end.year)
    })
    if (filterYear !== ALL_FILTER) years.add(Number(filterYear))
    return [...years].sort((a, b) => b - a)
  }, [items, filterYear])

  const filterEmployeeOptions = useMemo(() => {
    const byId = new Map()
    employees.forEach((e) => byId.set(e.id, e))
    items.forEach((row) => {
      if (!byId.has(row.employee_id)) {
        byId.set(row.employee_id, {
          id: row.employee_id,
          first_name: row.employee_name || `ID ${row.employee_id}`,
          last_name: '',
          employee_code: '',
        })
      }
    })
    return [...byId.values()].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.trim().toLowerCase()
      const nameB = `${b.first_name} ${b.last_name}`.trim().toLowerCase()
      return nameA.localeCompare(nameB, 'es')
    })
  }, [employees, items])

  const filteredItems = useMemo(() => {
    const year = filterYear === ALL_FILTER ? null : Number(filterYear)
    const month = filterMonth === ALL_FILTER ? null : Number(filterMonth)
    return items.filter((row) => {
      if (filterEmployeeId !== ALL_FILTER && row.employee_id !== Number(filterEmployeeId)) {
        return false
      }
      if (year != null || month != null) {
        return absenceOverlapsPeriod(row, year, month)
      }
      return true
    })
  }, [items, filterYear, filterMonth, filterEmployeeId])

  const clearFilters = () => {
    setFilterYear(ALL_FILTER)
    setFilterMonth(ALL_FILTER)
    setFilterEmployeeId(ALL_FILTER)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [absRes, empRes] = await Promise.all([
        absencesApi.list({ limit: 200 }),
        employeesApi.list({ limit: 200 }),
      ])
      setItems(absRes.data)
      setEmployees(empRes.data.filter(e => e.is_active))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const field = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'absence_type') {
        const meta = typeMeta(value)
        next.days = String(meta.defaultDays)
        if (!meta.justified && !next.deduction_mode) next.deduction_mode = 'salario'
        if (meta.justified) next.deduction_mode = ''
      }
      if (key === 'start_date' || key === 'end_date') {
        const start = key === 'start_date' ? value : next.start_date
        const end = key === 'end_date' ? value : next.end_date
        if (start && end) next.days = String(daysBetween(start, end))
      }
      return next
    })
  }

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setEvidenceFile(null)
    setError('')
    setOpenForm(true)
  }

  const handleOpenEdit = (row) => {
    setEditing(row)
    setForm({
      employee_id: String(row.employee_id),
      absence_type: row.absence_type,
      start_date: row.start_date,
      end_date: row.end_date,
      days: String(row.days),
      deduction_mode: row.deduction_mode || '',
      comments: row.comments || '',
    })
    setEvidenceFile(null)
    setError('')
    setOpenForm(true)
  }

  const handleClose = () => {
    if (saving || uploading) return
    setOpenForm(false)
    setEditing(null)
    setError('')
    setEvidenceFile(null)
  }

  const handleSave = async () => {
    const meta = typeMeta(form.absence_type)
    if (!form.employee_id || !form.start_date || !form.end_date) {
      setError('Completa empleado y fechas')
      return
    }
    if (form.absence_type === 'otros' && !form.comments.trim()) {
      setError('Los comentarios son obligatorios para el tipo Otros')
      return
    }
    if (!meta.justified && !form.deduction_mode) {
      setError('Selecciona el modo de descuento')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        employee_id: Number(form.employee_id),
        absence_type: form.absence_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days: parseFloat(form.days) || daysBetween(form.start_date, form.end_date),
        deduction_mode: meta.justified ? null : form.deduction_mode,
        comments: form.comments.trim() || null,
      }

      let saved
      if (editing) {
        const res = await absencesApi.update(editing.id, payload)
        saved = res.data
      } else {
        const res = await absencesApi.create(payload)
        saved = res.data
      }

      if (evidenceFile) {
        setUploading(true)
        await absencesApi.uploadEvidence(saved.id, evidenceFile)
      }

      setOpenForm(false)
      setEditing(null)
      setForm(emptyForm)
      setEvidenceFile(null)
      load()
    } catch (e) {
      setError(getApiError(e, editing ? 'Error al actualizar ausencia' : 'Error al crear ausencia'))
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleCancel = async (row) => {
    if (!confirm('¿Anular esta ausencia?')) return
    try {
      await absencesApi.remove(row.id)
      load()
    } catch (e) {
      setError(getApiError(e, 'No se pudo anular la ausencia'))
    }
  }

  const meta = typeMeta(form.absence_type)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Ausencias</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            {hasActiveFilters
              ? `${filteredItems.length} de ${items.length} registro${items.length !== 1 ? 's' : ''}`
              : `${items.length} registro${items.length !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
          Nueva ausencia
        </Button>
      </Box>

      {error && !openForm && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')}>{error}</AppAlert>
      )}

      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        mb: 2.5,
        px: 2,
        py: 1.5,
        borderRadius: 2.5,
        bgcolor: COLORS.cardBg,
        border: `1px solid ${COLORS.borderSubtle}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 0.5 }}>
          <FilterListOutlined sx={{ color: COLORS.brand, fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 500 }}>
            Filtros
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Año"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value === ALL_FILTER ? ALL_FILTER : Number(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          <MenuItem value={ALL_FILTER}>Todos</MenuItem>
          {filterYearOptions.map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Mes"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value === ALL_FILTER ? ALL_FILTER : Number(e.target.value))}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value={ALL_FILTER}>Todos</MenuItem>
          {MONTH_OPTIONS.map((m) => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Empleado"
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value === ALL_FILTER ? ALL_FILTER : Number(e.target.value))}
          sx={{ minWidth: 220, flex: 1 }}
        >
          <MenuItem value={ALL_FILTER}>Todos</MenuItem>
          {filterEmployeeOptions.map((emp) => (
            <MenuItem key={emp.id} value={emp.id}>
              {`${emp.first_name} ${emp.last_name}`.trim()}
              {emp.employee_code ? ` · ${emp.employee_code}` : ''}
            </MenuItem>
          ))}
        </TextField>
        {hasActiveFilters && (
          <Button size="small" onClick={clearFilters} sx={{ color: COLORS.textSecondary }}>
            Limpiar
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Empleado', 'Tipo', 'Período', 'Días', 'Justificada', 'Descuento', 'Comentarios', 'Evidencia', 'Estado', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <EventBusyOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin ausencias registradas</Typography>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                    No hay ausencias con esos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredItems.map((row) => (
              <TableRow key={row.id} sx={{ opacity: row.status === 'anulada' ? 0.55 : 1 }}>
                <TableCell sx={{ fontWeight: 500 }}>
                  {row.employee_name
                    || (empById[row.employee_id]
                      ? `${empById[row.employee_id].first_name} ${empById[row.employee_id].last_name}`
                      : `ID ${row.employee_id}`)}
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>
                  {typeMeta(row.absence_type).label}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem' }}>
                  {row.start_date} → {row.end_date}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>
                  {parseFloat(row.days).toLocaleString('es-PA')}
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.is_justified ? 'Sí' : 'No'}
                    size="small"
                    color={row.is_justified ? 'success' : 'warning'}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                  {row.deduction_mode || '—'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', maxWidth: 180, color: COLORS.textSecondary }}>
                  {row.comments
                    ? (row.comments.length > 60 ? `${row.comments.slice(0, 60)}…` : row.comments)
                    : '—'}
                </TableCell>
                <TableCell>
                  {row.evidence_url ? (
                    <Link href={row.evidence_url} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}>
                      Ver <OpenInNewOutlined sx={{ fontSize: 14 }} />
                    </Link>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Chip label={row.status} size="small" color={statusColor[row.status] || 'default'} sx={{ textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    {row.status === 'registrada' && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEdit(row)}
                          sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                          <EditOutlined sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {row.status === 'registrada' && (
                      <Tooltip title="Anular">
                        <IconButton size="small" onClick={() => handleCancel(row)}
                          sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}>
                          <DeleteOutlined sx={{ fontSize: 16 }} />
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

      <Dialog open={openForm} onClose={handleClose} maxWidth="sm" fullWidth scroll="body" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          {editing ? 'Editar ausencia' : 'Nueva ausencia'}
        </DialogTitle>
        <DialogContent>
          {error && <AppAlert severity="error">{error}</AppAlert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth select label="Empleado" value={form.employee_id}
                onChange={e => field('employee_id', e.target.value)}
                disabled={Boolean(editing)}
              >
                {employees.map(e => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {e.first_name} {e.last_name} · {e.employee_code}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth select label="Tipo de ausencia" value={form.absence_type}
                onChange={e => field('absence_type', e.target.value)}
                helperText={meta.hint}
              >
                {ABSENCE_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Inicio" value={form.start_date}
                onChange={e => field('start_date', e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Fin" value={form.end_date}
                onChange={e => field('end_date', e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Días" value={form.days}
                onChange={e => field('days', e.target.value)} inputProps={{ min: 0.5, step: 0.5 }} />
            </Grid>
            {!meta.justified && (
              <Grid item xs={12}>
                <FormControl>
                  <FormLabel sx={{ fontSize: '0.85rem', mb: 0.5 }}>Descontar de</FormLabel>
                  <RadioGroup
                    row
                    value={form.deduction_mode}
                    onChange={e => field('deduction_mode', e.target.value)}
                  >
                    <FormControlLabel value="salario" control={<Radio size="small" />} label="Salario (en la próxima nómina)" />
                    <FormControlLabel value="vacaciones" control={<Radio size="small" />} label="Vacaciones acumuladas" />
                  </RadioGroup>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth multiline minRows={2} label="Comentarios"
                value={form.comments}
                onChange={e => field('comments', e.target.value)}
                required={form.absence_type === 'otros'}
                helperText={form.absence_type === 'otros' ? 'Obligatorio para tipo Otros' : 'Opcional'}
              />
            </Grid>
            {meta.justified && (
              <Grid item xs={12}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadOutlined />}
                  sx={{ mb: 1 }}
                >
                  {evidenceFile ? evidenceFile.name : (editing?.evidence_url ? 'Reemplazar evidencia' : 'Subir evidencia (opcional)')}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                  />
                </Button>
                {editing?.evidence_url && !evidenceFile && (
                  <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                    Evidencia actual:{' '}
                    <Link href={editing.evidence_url} target="_blank" rel="noopener">ver archivo</Link>
                  </Typography>
                )}
                <Typography variant="caption" display="block" sx={{ color: COLORS.textMuted }}>
                  Opcional. Puedes adjuntar una imagen de justificación.
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${COLORS.borderSubtle}`, pt: 2 }}>
          <Button onClick={handleClose} disabled={saving || uploading} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || uploading}>
            {(saving || uploading)
              ? <CircularProgress size={18} sx={{ color: COLORS.white }} />
              : (editing ? 'Guardar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
