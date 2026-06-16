import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress,
  MenuItem,
} from '@mui/material'
import {
  AddOutlined, EditOutlined, DeleteOutlined, EventOutlined,
  ChevronLeft, ChevronRight, CalendarMonthOutlined,
  UploadFileOutlined, DownloadOutlined,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import AppAlert from '../components/common/AppAlert'
import { holidaysApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'

const CURRENT_YEAR = new Date().getFullYear()

const CSV_TEMPLATE = `fecha,nombre,descripción
2026-01-01,Año Nuevo,
2026-01-09,Día de los Mártires,
2026-11-03,Separación de Panamá de Colombia,
2026-11-10,Grito de Independencia de La Villa de Los Santos,
2026-11-28,Independencia de Panamá de España,
2026-12-08,Día de las Madres,
`

function downloadCsvTemplate() {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'feriados_plantilla.csv'
  link.click()
  URL.revokeObjectURL(url)
}

const emptyForm = {
  holiday_date: '',
  name: '',
  description: '',
}

function holidayToForm(h) {
  return {
    holiday_date: h.holiday_date ?? '',
    name: h.name ?? '',
    description: h.description ?? '',
  }
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-PA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function weekdayLabel(value) {
  if (!value) return '—'
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-PA', { weekday: 'long' })
}

export default function HolidaysPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const yearOptions = useMemo(() => {
    const options = new Set([CURRENT_YEAR, year])
    holidays.forEach(h => options.add(h.year))
    return Array.from(options).sort((a, b) => b - a)
  }, [holidays, year])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await holidaysApi.list({ year, limit: 366 })
      setHolidays(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [year])

  useEffect(() => { load() }, [load])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setOpenForm(true)
  }

  const handleOpenEdit = (holiday) => {
    setEditing(holiday)
    setForm(holidayToForm(holiday))
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
    if (!form.holiday_date || !form.name.trim()) {
      setError('La fecha y el nombre son obligatorios')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        holiday_date: form.holiday_date,
        name: form.name.trim(),
        description: form.description.trim() || null,
      }
      if (editing) {
        await holidaysApi.update(editing.id, payload)
        setSuccessMsg('Feriado actualizado correctamente')
      } else {
        await holidaysApi.create(payload)
        setSuccessMsg('Feriado registrado correctamente')
      }
      const savedYear = parseInt(form.holiday_date.slice(0, 4), 10)
      if (savedYear !== year) setYear(savedYear)
      setOpenForm(false)
      setEditing(null)
      setForm(emptyForm)
      load()
    } catch (e) {
      setError(getApiError(e, editing ? 'Error al actualizar feriado' : 'Error al registrar feriado'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setSuccessMsg('')
    try {
      await holidaysApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      setSuccessMsg('Feriado eliminado correctamente')
      load()
    } catch (e) {
      setError(getApiError(e, 'Error al eliminar feriado'))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleCloseDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
  }

  const handleOpenImport = () => {
    setImportError('')
    setImportResult(null)
    setSelectedFile(null)
    setOpenImport(true)
  }

  const handleCloseImport = () => {
    if (importing) return
    setOpenImport(false)
    setImportError('')
    setImportResult(null)
    setSelectedFile(null)
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setSelectedFile(file ?? null)
    setImportError('')
    setImportResult(null)
    event.target.value = ''
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError('Selecciona un archivo CSV')
      return
    }
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setImportError('El archivo debe tener extensión .csv')
      return
    }

    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const res = await holidaysApi.importCsv(selectedFile, { skip_duplicates: true })
      setImportResult(res.data)
      if (res.data.created > 0) {
        setSuccessMsg(
          `${res.data.created} feriado${res.data.created !== 1 ? 's' : ''} importado${res.data.created !== 1 ? 's' : ''}`
          + (res.data.skipped ? ` · ${res.data.skipped} omitido${res.data.skipped !== 1 ? 's' : ''} (ya existían)` : ''),
        )
        load()
      }
    } catch (e) {
      setImportError(getApiError(e, 'Error al importar el archivo'))
    } finally {
      setImporting(false)
    }
  }

  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Días feriados</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            Calendario de feriados por año · base para timesheets
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={handleOpenImport} size="small">
            Importar CSV
          </Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
            Nuevo feriado
          </Button>
        </Box>
      </Box>

      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </AppAlert>
      )}

      {error && !openForm && !deleteTarget && !openImport && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')}>
          {error}
        </AppAlert>
      )}

      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
        p: 2,
        borderRadius: 3,
        bgcolor: COLORS.cardBg,
        border: `1px solid ${COLORS.borderSubtle}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthOutlined sx={{ color: COLORS.brand, fontSize: 22 }} />
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            Año seleccionado
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setYear(y => y - 1)}
            sx={{ color: COLORS.textSecondary, border: `1px solid ${COLORS.borderSubtle}` }}>
            <ChevronLeft />
          </IconButton>
          <TextField
            select
            size="small"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            sx={{ minWidth: 100, '& .MuiInputBase-input': { fontFamily: '"DM Mono", monospace', fontWeight: 600 } }}
          >
            {yearOptions.map(y => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={() => setYear(y => y + 1)}
            sx={{ color: COLORS.textSecondary, border: `1px solid ${COLORS.borderSubtle}` }}>
            <ChevronRight />
          </IconButton>
        </Box>
        <Typography variant="body2" sx={{ color: COLORS.textMuted, fontFamily: '"DM Mono", monospace' }}>
          {holidays.length} feriado{holidays.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Fecha', 'Día', 'Nombre', 'Descripción', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.brand }} />
                </TableCell>
              </TableRow>
            ) : holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                  <EventOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                    Sin feriados registrados para {year}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : holidays.map(h => (
              <TableRow key={h.id}>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.brand, fontWeight: 600 }}>
                  {h.holiday_date}
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize', color: COLORS.textSecondary, fontSize: '0.85rem' }}>
                  {weekdayLabel(h.holiday_date)}
                </TableCell>
                <TableCell sx={{ fontWeight: 500, color: COLORS.textPrimary }}>{h.name}</TableCell>
                <TableCell sx={{ color: COLORS.textSecondary, fontSize: '0.85rem', maxWidth: 280 }}>
                  {h.description || '—'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenEdit(h)}>
                        <EditOutlined sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" onClick={() => { setDeleteTarget(h); setError('') }}
                        sx={{ color: COLORS.error, '&:hover': { bgcolor: alpha(COLORS.error, 0.08) } }}>
                        <DeleteOutlined sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif' }}>
          {editing ? 'Editar feriado' : 'Nuevo feriado'}
        </DialogTitle>
        <DialogContent>
          {error && <AppAlert severity="error">{error}</AppAlert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Fecha"
                type="date"
                value={form.holiday_date}
                onChange={e => field('holiday_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: `${year}-01-01`, max: `${year}-12-31` }}
                helperText={`Se registrará en el año ${form.holiday_date ? form.holiday_date.slice(0, 4) : year}`}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre del feriado"
                value={form.name}
                onChange={e => field('name', e.target.value)}
                placeholder="Ej. Día de la Independencia"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción (opcional)"
                value={form.description}
                onChange={e => field('description', e.target.value)}
                multiline
                rows={2}
                placeholder="Notas adicionales sobre el feriado"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : (editing ? 'Guardar' : 'Registrar')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openImport} onClose={handleCloseImport} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif' }}>
          Importar feriados desde CSV
        </DialogTitle>
        <DialogContent>
          <AppAlert severity="info" sx={{ mb: 2 }}>
            El archivo debe incluir encabezados. Columnas: <strong>fecha</strong> (YYYY-MM-DD o DD/MM/YYYY),{' '}
            <strong>nombre</strong> y <strong>descripción</strong> (opcional). Se admiten tildes y la letra ñ.
            Formatos de archivo: UTF-8 (recomendado), Excel en español (Windows) o UTF-16. Las fechas ya registradas se omiten.
          </AppAlert>

          {importError && <AppAlert severity="error">{importError}</AppAlert>}

          {importResult && (
            <AppAlert
              severity={importResult.errors?.length ? 'warning' : 'success'}
              sx={{ mb: 2 }}
            >
              {importResult.created} creado{importResult.created !== 1 ? 's' : ''}
              {importResult.skipped > 0 && ` · ${importResult.skipped} omitido${importResult.skipped !== 1 ? 's' : ''}`}
              {importResult.errors?.length > 0 && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5, fontSize: '0.8125rem' }}>
                  {importResult.errors.map(err => (
                    <li key={`${err.row}-${err.message}`}>
                      {err.row > 0 ? `Fila ${err.row}: ` : ''}{err.message}
                    </li>
                  ))}
                </Box>
              )}
            </AppAlert>
          )}

          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            p: 2,
            borderRadius: 2,
            border: `1px dashed ${COLORS.borderSubtle}`,
            bgcolor: alpha(COLORS.brand, 0.02),
          }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} disabled={importing}>
              {selectedFile ? 'Cambiar archivo' : 'Seleccionar CSV'}
              <input type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
            </Button>
            <Typography variant="body2" sx={{ color: COLORS.textSecondary, flex: 1, wordBreak: 'break-all' }}>
              {selectedFile ? selectedFile.name : 'Ningún archivo seleccionado'}
            </Typography>
            <Button size="small" startIcon={<DownloadOutlined />} onClick={downloadCsvTemplate} sx={{ color: COLORS.brand }}>
              Plantilla
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseImport} disabled={importing} sx={{ color: COLORS.textSecondary }}>
            Cerrar
          </Button>
          <Button variant="contained" onClick={handleImport} disabled={importing || !selectedFile}
            startIcon={importing ? null : <UploadFileOutlined />}>
            {importing ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Importar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={handleCloseDelete} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Eliminar feriado
        </DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <>
              <AppAlert severity="warning" showTitle sx={{ mb: 2 }}>
                Este feriado se eliminará del calendario. Las marcaciones futuras de timesheets ya no lo considerarán.
              </AppAlert>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                ¿Eliminar <strong>{deleteTarget.name}</strong> ({formatDate(deleteTarget.holiday_date)})?
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDelete} disabled={deleting} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleting}
            startIcon={deleting ? null : <DeleteOutlined />}>
            {deleting ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
