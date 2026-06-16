import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, MenuItem, CircularProgress,
  IconButton, Chip, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import {
  ChevronLeft, ChevronRight, SaveOutlined, ScheduleOutlined,
  ContentCopyOutlined,
} from '@mui/icons-material'
import AppAlert from '../components/common/AppAlert'
import { timesheetsApi, employeesApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'
import { alpha } from '@mui/material/styles'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const ROWS = [
  { key: 'clock_in', label: 'Entrada' },
  { key: 'clock_out', label: 'Salida' },
  { key: 'overtime_start', label: 'Hora Extra Inicio' },
  { key: 'overtime_end', label: 'Hora Extra Fin' },
]

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const SCHEDULE_PRESETS = [
  {
    id: 'office',
    label: 'Oficina 8:00–17:00',
    clock_in: '08:00',
    clock_out: '17:00',
    overtime_start: '',
    overtime_end: '',
  },
  {
    id: 'saturday_half',
    label: 'Medio día 8:00–13:00',
    clock_in: '08:00',
    clock_out: '13:00',
    overtime_start: '',
    overtime_end: '',
  },
  {
    id: 'office_ot1',
    label: 'Oficina + 1h extra',
    clock_in: '08:00',
    clock_out: '17:00',
    overtime_start: '17:00',
    overtime_end: '18:00',
  },
]

const DEFAULT_WEEK_TEMPLATE = {
  clock_in: '08:00',
  clock_out: '17:00',
  overtime_start: '',
  overtime_end: '',
}

const DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]

const now = new Date()

function padDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function toInputTime(value) {
  if (!value) return ''
  return value.slice(0, 5)
}

function buildWeeks(year, month) {
  const lastDay = new Date(year, month, 0).getDate()
  const weeks = []
  let weekDays = []

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    const mondayIndex = dow === 0 ? 6 : dow - 1

    if (weekDays.length === 0 && mondayIndex > 0) {
      for (let i = 0; i < mondayIndex; i++) weekDays.push(null)
    }

    weekDays.push({
      date: padDate(year, month, day),
      dayNum: day,
      dayName: DAY_NAMES[mondayIndex],
      inMonth: true,
    })

    if (weekDays.length === 7) {
      weeks.push(weekDays)
      weekDays = []
    }
  }

  if (weekDays.length > 0) {
    while (weekDays.length < 7) weekDays.push(null)
    weeks.push(weekDays)
  }

  return weeks
}

function emptyDayEntry(date) {
  return {
    work_date: date,
    clock_in: '',
    clock_out: '',
    overtime_start: '',
    overtime_end: '',
  }
}

function defaultSelectedDays(worksSaturdayHalfDay) {
  return worksSaturdayHalfDay ? [...DEFAULT_WORK_DAYS, 5] : [...DEFAULT_WORK_DAYS]
}

function weekRangeLabel(week) {
  const days = week.filter(Boolean)
  if (!days.length) return ''
  if (days.length === 1) return `${days[0].dayNum}`
  return `${days[0].dayNum} – ${days[days.length - 1].dayNum}`
}

function WeekQuickFill({ week, worksSaturdayHalfDay, onApply }) {
  const [template, setTemplate] = useState(DEFAULT_WEEK_TEMPLATE)
  const [selectedDays, setSelectedDays] = useState(() => defaultSelectedDays(worksSaturdayHalfDay))
  const [presetKey, setPresetKey] = useState('')

  useEffect(() => {
    setSelectedDays(defaultSelectedDays(worksSaturdayHalfDay))
  }, [worksSaturdayHalfDay])

  const setField = (key, value) => setTemplate(prev => ({ ...prev, [key]: value }))

  const handlePreset = (presetId) => {
    const preset = SCHEDULE_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setPresetKey(presetId)
    setTemplate({
      clock_in: preset.clock_in,
      clock_out: preset.clock_out,
      overtime_start: preset.overtime_start,
      overtime_end: preset.overtime_end,
    })
    if (preset.id === 'saturday_half') {
      setSelectedDays([5])
    } else {
      setSelectedDays(defaultSelectedDays(worksSaturdayHalfDay))
    }
  }

  const handleApply = () => {
    const daysInWeek = week
      .map((day, index) => ({ day, index }))
      .filter(({ day, index }) => day?.inMonth && selectedDays.includes(index))

    if (!daysInWeek.length) return
    if (!template.clock_in || !template.clock_out) return

    onApply(daysInWeek.map(({ day }) => day.date), { ...template })
  }

  const daysInMonthCount = week.filter(d => d?.inMonth).length

  return (
    <Box sx={{
      px: 2,
      py: 1.5,
      bgcolor: alpha(COLORS.brand, 0.03),
      borderBottom: `1px solid ${COLORS.borderSubtle}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textPrimary }}>
          Relleno rápido · semana {weekRangeLabel(week)}
        </Typography>
        <TextField
          select
          size="small"
          label="Plantilla"
          value={presetKey}
          onChange={e => handlePreset(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200, '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
          SelectProps={{
            displayEmpty: true,
            renderValue: (v) => SCHEDULE_PRESETS.find(p => p.id === v)?.label ?? 'Elegir plantilla…',
          }}
        >
          <MenuItem value="" sx={{ fontSize: '0.85rem', color: COLORS.textMuted }}>
            Elegir plantilla…
          </MenuItem>
          {SCHEDULE_PRESETS.map(p => (
            <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.85rem' }}>{p.label}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          {ROWS.map(row => (
            <TextField
              key={row.key}
              type="time"
              size="small"
              label={row.label}
              value={template[row.key]}
              onChange={e => setField(row.key, e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              sx={{
                width: 130,
                '& .MuiInputBase-input': { fontFamily: '"DM Mono", monospace', fontSize: '0.78rem' },
              }}
            />
          ))}
        </Box>

        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" display="block" sx={{ fontSize: '0.65rem', color: COLORS.textMuted, mb: 0.5, letterSpacing: '0.04em' }}>
              DÍAS A RELLENAR
            </Typography>
            <ToggleButtonGroup
              size="small"
              multiple
              value={selectedDays}
              onChange={(_, value) => { if (value.length) setSelectedDays(value) }}
              sx={{ flexWrap: 'wrap' }}
            >
              {week.map((day, index) => (
                <ToggleButton
                  key={index}
                  value={index}
                  disabled={!day?.inMonth}
                  sx={{
                    minWidth: 34,
                    px: 0.75,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    opacity: day?.inMonth ? 1 : 0.35,
                  }}
                >
                  {WEEKDAY_SHORT[index]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyOutlined />}
            onClick={handleApply}
            disabled={!template.clock_in || !template.clock_out || !selectedDays.some(i => week[i]?.inMonth)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
          >
            Aplicar a la semana
          </Button>
        </Box>
      </Box>

      <Typography sx={{ mt: 1, fontSize: '0.68rem', color: COLORS.textMuted }}>
        Define un horario y aplícalo a los días seleccionados ({daysInMonthCount} días en esta semana).
        Luego puedes ajustar cualquier celda manualmente.
      </Typography>
    </Box>
  )
}

function WeekTimesheetGrid({ week, monthName, grid, setGrid, worksSaturdayHalfDay }) {
  const setCell = (date, key, value) => {
    setGrid(prev => ({
      ...prev,
      [date]: { ...(prev[date] || emptyDayEntry(date)), [key]: value },
    }))
  }

  const applyWeekSchedule = (dates, template) => {
    setGrid(prev => {
      const next = { ...prev }
      dates.forEach(date => {
        next[date] = {
          work_date: date,
          clock_in: template.clock_in,
          clock_out: template.clock_out,
          overtime_start: template.overtime_start,
          overtime_end: template.overtime_end,
        }
      })
      return next
    })
  }

  return (
    <TableContainer
      component={Paper}
      sx={{ borderRadius: 2, mb: 3, overflowX: 'auto', border: `1px solid ${COLORS.borderSubtle}` }}
    >
      <WeekQuickFill
        week={week}
        worksSaturdayHalfDay={worksSaturdayHalfDay}
        onApply={applyWeekSchedule}
      />
      <Table size="small" sx={{ minWidth: 720, tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell
              colSpan={8}
              align="center"
              sx={{
                fontFamily: '"Syne", sans-serif',
                fontWeight: 700,
                fontSize: '0.95rem',
                bgcolor: alpha(COLORS.brand, 0.06),
                borderBottom: `2px solid ${COLORS.borderSubtle}`,
              }}
            >
              {monthName}
            </TableCell>
          </TableRow>
          <TableRow sx={{ bgcolor: alpha(COLORS.brand, 0.03) }}>
            <TableCell sx={{ width: 130, fontWeight: 600, fontSize: '0.75rem' }} />
            {week.map((day, di) => (
              <TableCell
                key={di}
                align="center"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  color: day?.inMonth ? COLORS.textPrimary : COLORS.textMuted,
                  opacity: day?.inMonth ? 1 : 0.35,
                  px: 0.5,
                }}
              >
                {day ? `${day.dayName} ${day.dayNum}` : '—'}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map(row => (
            <TableRow key={row.key}>
              <TableCell sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: COLORS.pageBg,
                borderRight: `1px solid ${COLORS.borderSubtle}`,
              }}>
                {row.label}
              </TableCell>
              {week.map((day, di) => (
                <TableCell key={di} align="center" sx={{ p: 0.5, opacity: day?.inMonth ? 1 : 0.3 }}>
                  {day?.inMonth ? (
                    <TextField
                      type="time"
                      size="small"
                      value={grid[day.date]?.[row.key] || ''}
                      onChange={e => setCell(day.date, row.key, e.target.value)}
                      inputProps={{ step: 60 }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: '"DM Mono", monospace',
                          fontSize: '0.72rem',
                          py: 0.75,
                          px: 0.5,
                          textAlign: 'center',
                        },
                        '& .MuiOutlinedInput-root': { borderRadius: 1 },
                      }}
                    />
                  ) : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function TimesheetsPage() {
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === Number(employeeId)),
    [employees, employeeId],
  )

  const weeks = useMemo(() => buildWeeks(year, month), [year, month])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await employeesApi.list({ limit: 200 })
      const active = res.data.filter(e => e.is_active && e.status === 'activo')
      setEmployees(active)
      if (active.length && !employeeId) setEmployeeId(String(active[0].id))
    } catch { /* ignore */ }
  }, [employeeId])

  const loadTimesheets = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    setError('')
    try {
      const res = await timesheetsApi.list({
        employee_id: Number(employeeId),
        year,
        month,
      })
      const monthWeeks = buildWeeks(year, month)
      const next = {}
      monthWeeks.flat().filter(Boolean).forEach(d => {
        next[d.date] = emptyDayEntry(d.date)
      })
      res.data.forEach(entry => {
        next[entry.work_date] = {
          work_date: entry.work_date,
          clock_in: toInputTime(entry.clock_in),
          clock_out: toInputTime(entry.clock_out),
          overtime_start: toInputTime(entry.overtime_start),
          overtime_end: toInputTime(entry.overtime_end),
        }
      })
      setGrid(next)
    } catch (e) {
      setError(getApiError(e, 'Error al cargar marcaciones'))
    } finally {
      setLoading(false)
    }
  }, [employeeId, year, month])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => { loadTimesheets() }, [loadTimesheets])

  const handleSave = async () => {
    if (!employeeId) return
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const entries = Object.values(grid).map(day => ({
        work_date: day.work_date,
        clock_in: day.clock_in || null,
        clock_out: day.clock_out || null,
        overtime_start: day.overtime_start || null,
        overtime_end: day.overtime_end || null,
      }))
      await timesheetsApi.bulkUpsert({
        employee_id: Number(employeeId),
        entries,
      })
      setSuccessMsg('Marcaciones guardadas correctamente')
      loadTimesheets()
    } catch (e) {
      setError(getApiError(e, 'Error al guardar marcaciones'))
    } finally {
      setSaving(false)
    }
  }

  const shiftMonth = (delta) => {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m)
    setYear(y)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Marcación</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            Registro diario de entrada, salida y horas extra
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? null : <SaveOutlined />}
          onClick={handleSave}
          disabled={saving || !employeeId || loading}
          size="small"
        >
          {saving ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Guardar mes'}
        </Button>
      </Box>

      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </AppAlert>
      )}
      {error && (
        <AppAlert severity="error" variant="banner" onClose={() => setError('')}>
          {error}
        </AppAlert>
      )}

      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        p: 2,
        borderRadius: 3,
        bgcolor: COLORS.cardBg,
        border: `1px solid ${COLORS.borderSubtle}`,
        alignItems: 'center',
      }}>
        <TextField
          select
          size="small"
          label="Empleado"
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {employees.map(emp => (
            <MenuItem key={emp.id} value={String(emp.id)}>
              {emp.first_name} {emp.last_name}
              {emp.is_trusted_staff ? ' · Confianza' : ''}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => shiftMonth(-1)}
            sx={{ border: `1px solid ${COLORS.borderSubtle}` }}>
            <ChevronLeft />
          </IconButton>
          <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </Typography>
          <IconButton size="small" onClick={() => shiftMonth(1)}
            sx={{ border: `1px solid ${COLORS.borderSubtle}` }}>
            <ChevronRight />
          </IconButton>
        </Box>

        {selectedEmployee?.is_trusted_staff && (
          <Chip
            size="small"
            label="Personal de confianza — sin validación de marcación en nómina"
            sx={{ bgcolor: alpha(COLORS.warning, 0.12), color: COLORS.warning }}
          />
        )}
      </Box>

      <AppAlert severity="info" sx={{ mb: 3 }}>
        Usa el <strong>relleno rápido</strong> en cada semana para aplicar un horario a varios días a la vez.
        Horas extra: recargo diurno +25%, nocturno +50%. Máx. 3 h/día y 9 h/semana.
      </AppAlert>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={28} sx={{ color: COLORS.brand }} />
        </Box>
      ) : !employeeId ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ScheduleOutlined sx={{ fontSize: 48, color: COLORS.textMuted, mb: 1 }} />
          <Typography sx={{ color: COLORS.textMuted }}>Selecciona un empleado</Typography>
        </Box>
      ) : (
        weeks.map((week, wi) => (
          <WeekTimesheetGrid
            key={`week-${wi}`}
            week={week}
            monthName={MONTH_NAMES[month - 1]}
            grid={grid}
            setGrid={setGrid}
            worksSaturdayHalfDay={Boolean(selectedEmployee?.works_saturday_half_day)}
          />
        ))
      )}
    </Box>
  )
}
