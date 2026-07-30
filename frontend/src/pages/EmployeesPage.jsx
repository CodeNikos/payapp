import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  InputAdornment, MenuItem, CircularProgress, Tooltip, Switch,
  FormControlLabel, RadioGroup, Radio, FormControl, FormLabel, Divider,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, SearchOutlined, PersonOffOutlined, PeopleOutlined, EditOutlined,
  CalculateOutlined, CloudUploadOutlined, BeachAccessOutlined,
} from '@mui/icons-material'
import { employeesApi, companiesApi, reportsApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'
import { alpha } from '@mui/material/styles'

const CONTRACT_TYPES = ['indefinido', 'temporal', 'obra_labor']
const DEPARTMENTS = ['Administración', 'Ventas', 'Operaciones', 'Tecnología', 'RRHH', 'Finanzas', 'Producción']
const STATUSES = ['activo', 'inactivo', 'suspendido']

const SETTLEMENT_REASONS = [
  {
    value: 'despido_injustificado',
    label: 'Despido injustificado',
    hint: 'Incluye prima, vacaciones, décimo, indemnización y preaviso del empleador si aplica.',
  },
  {
    value: 'despido_justificado',
    label: 'Despido justificado',
    hint: 'Prima, vacaciones y décimo. Sin indemnización ni preaviso pagadero.',
  },
  {
    value: 'renuncia_voluntaria',
    label: 'Renuncia voluntaria',
    hint: 'Prima, vacaciones y décimo. Si no hay preaviso de 15 días, se descuenta 1 semana.',
  },
]

const statusColor = {
  activo: 'success',
  inactivo: 'error',
  suspendido: 'warning',
}

const SATURDAY_HALF_DAY_HOURS = 4

function effectiveWeeklyHours(employeeOrForm) {
  const weekly = parseFloat(employeeOrForm?.weekly_contract_hours ?? 40)
  return weekly + (employeeOrForm?.works_saturday_half_day ? SATURDAY_HALF_DAY_HOURS : 0)
}

const emptyForm = {
  first_name: '', last_name: '', document_id: '', email: '', phone: '',
  position: '', department: '', base_salary: '', weekly_contract_hours: '40',
  works_saturday_half_day: false,
  is_trusted_staff: false,
  hire_date: '', contract_type: 'indefinido', status: 'activo', termination_date: '',
  vacation_opening_balance: '0',
  company_code: '',
}

const emptySettlementForm = {
  termination_date: new Date().toISOString().slice(0, 10),
  reason: 'despido_injustificado',
  employer_gave_notice: '',
  employee_gave_notice: '',
  apply_termination: true,
  notes: '',
}

function money(v) {
  return `$${parseFloat(v || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calcVacationPayment(salary, days) {
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

function employeeToForm(emp) {
  return {
    first_name: emp.first_name ?? '',
    last_name: emp.last_name ?? '',
    document_id: emp.document_id ?? '',
    email: emp.email ?? '',
    phone: emp.phone ?? '',
    position: emp.position ?? '',
    department: emp.department ?? '',
    base_salary: String(emp.base_salary ?? ''),
    weekly_contract_hours: String(emp.weekly_contract_hours ?? 40),
    works_saturday_half_day: Boolean(emp.works_saturday_half_day),
    is_trusted_staff: Boolean(emp.is_trusted_staff),
    hire_date: emp.hire_date ?? '',
    contract_type: emp.contract_type ?? 'indefinido',
    status: emp.status ?? 'activo',
    termination_date: emp.termination_date ?? '',
    vacation_opening_balance: String(emp.vacation_opening_balance ?? '0'),
    company_code: emp.company_code ?? '',
  }
}

function buildPayload(form) {
  return {
    first_name: form.first_name,
    last_name: form.last_name,
    document_id: form.document_id,
    email: form.email || null,
    phone: form.phone || null,
    position: form.position,
    department: form.department,
    base_salary: parseFloat(form.base_salary),
    weekly_contract_hours: parseFloat(form.weekly_contract_hours),
    works_saturday_half_day: Boolean(form.works_saturday_half_day),
    is_trusted_staff: Boolean(form.is_trusted_staff),
    hire_date: form.hire_date,
    contract_type: form.contract_type,
    status: form.status,
    termination_date: form.termination_date || null,
    vacation_opening_balance: parseFloat(form.vacation_opening_balance) || 0,
    company_code: form.company_code || null,
  }
}

function EmployeeFormFields({ form, field, editing, companies = [] }) {
  return (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      {editing && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Código de empleado"
            value={editing.employee_code}
            disabled
            size="small"
            sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: COLORS.textSecondary } }}
          />
        </Grid>
      )}
      <Grid item xs={12}>
        <TextField
          fullWidth
          select
          label="Empresa"
          value={form.company_code}
          onChange={e => field('company_code', e.target.value)}
          helperText="Opcional. Solo empresas activas."
        >
          <MenuItem value="">Sin empresa</MenuItem>
          {companies.map(c => (
            <MenuItem key={c.company_code} value={c.company_code}>
              {c.company_code} · {c.commercial_name}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={6}><TextField fullWidth label="Nombre" value={form.first_name} onChange={e => field('first_name', e.target.value)} /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Apellido" value={form.last_name} onChange={e => field('last_name', e.target.value)} /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Cédula / Doc." value={form.document_id} onChange={e => field('document_id', e.target.value)} /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Correo" value={form.email} onChange={e => field('email', e.target.value)} type="email" /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Teléfono" value={form.phone} onChange={e => field('phone', e.target.value)} /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Cargo" value={form.position} onChange={e => field('position', e.target.value)} /></Grid>
      <Grid item xs={6}><TextField fullWidth label="Salario Base" value={form.base_salary} onChange={e => field('base_salary', e.target.value)} type="number" inputProps={{ min: 0, step: 0.01 }} /></Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Horas contratadas semanales"
          value={form.weekly_contract_hours}
          onChange={e => field('weekly_contract_hours', e.target.value)}
          type="number"
          inputProps={{ min: 1, max: 168, step: 0.5 }}
          helperText={`Lun–vie · Total efectivo: ${effectiveWeeklyHours(form)} h/sem`}
        />
      </Grid>
      <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'flex-start', pt: { xs: 0, sm: 1 } }}>
        <Box sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mt: { xs: 0, sm: 2.5 },
          px: 1.25,
          py: 0.75,
          minHeight: 40,
          borderRadius: 1.5,
          border: `1px solid ${form.works_saturday_half_day ? alpha(COLORS.brand, 0.35) : COLORS.borderSubtle}`,
          bgcolor: form.works_saturday_half_day ? COLORS.brandMuted : COLORS.inputBg,
        }}>
          <Typography sx={{ fontSize: '0.8125rem', color: COLORS.textPrimary, lineHeight: 1.35 }}>
            Sábado medio día
            <Typography component="span" sx={{ display: 'block', fontSize: '0.68rem', color: COLORS.textMuted }}>
              +{SATURDAY_HALF_DAY_HOURS} h/semana
            </Typography>
          </Typography>
          <Switch
            size="small"
            checked={form.works_saturday_half_day}
            onChange={e => field('works_saturday_half_day', e.target.checked)}
            sx={{
              m: 0,
              '& .MuiSwitch-switchBase.Mui-checked': { color: COLORS.brand },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(COLORS.brand, 0.55) },
            }}
          />
        </Box>
      </Grid>
      <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <Box sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mt: { xs: 0, sm: 2.5 },
          px: 1.25,
          py: 0.75,
          minHeight: 40,
          borderRadius: 1.5,
          border: `1px solid ${form.is_trusted_staff ? alpha(COLORS.warning, 0.4) : COLORS.borderSubtle}`,
          bgcolor: form.is_trusted_staff ? alpha(COLORS.warning, 0.08) : COLORS.inputBg,
        }}>
          <Typography sx={{ fontSize: '0.8125rem', color: COLORS.textPrimary, lineHeight: 1.35 }}>
            Personal de confianza
            <Typography component="span" sx={{ display: 'block', fontSize: '0.68rem', color: COLORS.textMuted }}>
              Exento de validación de marcación
            </Typography>
          </Typography>
          <Switch
            size="small"
            checked={form.is_trusted_staff}
            onChange={e => field('is_trusted_staff', e.target.checked)}
            sx={{
              m: 0,
              '& .MuiSwitch-switchBase.Mui-checked': { color: COLORS.warning },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(COLORS.warning, 0.55) },
            }}
          />
        </Box>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth label="Fecha ingreso" value={form.hire_date} onChange={e => field('hire_date', e.target.value)} type="date" InputLabelProps={{ shrink: true }} />
      </Grid>
      {editing && (
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Fecha de cese"
            value={form.termination_date}
            onChange={e => field('termination_date', e.target.value)}
            type="date"
            InputLabelProps={{ shrink: true }}
            helperText="Si se indica, el empleado pasa a inactivo. Al reactivar (estado activo) se limpia."
          />
        </Grid>
      )}
      <Grid item xs={6}>
        <TextField fullWidth select label="Departamento" value={form.department} onChange={e => field('department', e.target.value)}>
          {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={6}>
        <TextField fullWidth select label="Tipo contrato" value={form.contract_type} onChange={e => field('contract_type', e.target.value)}>
          {CONTRACT_TYPES.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace('_', ' ')}</MenuItem>)}
        </TextField>
      </Grid>
      {editing && (
        <Grid item xs={6}>
          <TextField fullWidth select label="Estado" value={form.status} onChange={e => field('status', e.target.value)}>
            {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
          </TextField>
        </Grid>
      )}
      {editing && (
        <>
          <Grid item xs={12}>
            <Typography sx={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: COLORS.textMuted,
              mt: 1,
            }}>
              Vacaciones — carga inicial
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Días acumulados (carga inicial)"
              value={form.vacation_opening_balance}
              onChange={e => field('vacation_opening_balance', e.target.value)}
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
        </>
      )}
    </Grid>
  )
}

function SettlementLine({ label, value, muted, emphasize }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.6 }}>
      <Typography sx={{ fontSize: '0.82rem', color: muted ? COLORS.textMuted : COLORS.textSecondary }}>
        {label}
      </Typography>
      <Typography sx={{
        fontFamily: '"DM Mono", monospace',
        fontSize: emphasize ? '0.95rem' : '0.82rem',
        fontWeight: emphasize ? 700 : 500,
        color: emphasize ? COLORS.brand : COLORS.textPrimary,
      }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [openForm, setOpenForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState(emptyForm)

  const [settlementTarget, setSettlementTarget] = useState(null)
  const [settlementForm, setSettlementForm] = useState(emptySettlementForm)
  const [settlementPreview, setSettlementPreview] = useState(null)
  const [settlementError, setSettlementError] = useState('')
  const [settlementSuccess, setSettlementSuccess] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [savingSettlement, setSavingSettlement] = useState(false)
  const [noticeFile, setNoticeFile] = useState(null)

  const [vacationTarget, setVacationTarget] = useState(null)
  const [vacationBalance, setVacationBalance] = useState(null)
  const [vacationForm, setVacationForm] = useState({ days: '', start_date: '', notes: '' })
  const [vacationLoading, setVacationLoading] = useState(false)
  const [vacationSaving, setVacationSaving] = useState(false)
  const [vacationError, setVacationError] = useState('')
  const [vacationSuccess, setVacationSuccess] = useState('')

  const companyByCode = Object.fromEntries(companies.map(c => [c.company_code, c]))
  const activeCompanies = companies.filter(c => c.status === 'activo')
  const companyOptions = editing?.company_code && !activeCompanies.some(c => c.company_code === editing.company_code)
    ? [...activeCompanies, companyByCode[editing.company_code]].filter(Boolean)
    : activeCompanies

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, companyRes] = await Promise.all([
        employeesApi.list({ search: search || undefined, limit: 200, include_inactive: true }),
        companiesApi.list({ limit: 200 }),
      ])
      setEmployees(empRes.data)
      setCompanies(companyRes.data)
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

  const handleOpenEdit = (emp) => {
    setEditing(emp)
    setForm(employeeToForm(emp))
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
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload(form)
      if (editing) {
        await employeesApi.update(editing.id, payload)
      } else {
        const { status, vacation_opening_balance, ...createPayload } = payload
        await employeesApi.create(createPayload)
      }
      setOpenForm(false)
      setEditing(null)
      setForm(emptyForm)
      load()
    } catch (e) {
      setError(getApiError(e, editing ? 'Error al actualizar empleado' : 'Error al crear empleado'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id) => {
    if (!confirm('¿Desactivar este empleado?')) return
    try { await employeesApi.deactivate(id); load() } catch { /* ignore */ }
  }

  const settlementField = (key, value) => {
    setSettlementForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'reason') {
        next.employer_gave_notice = ''
        next.employee_gave_notice = ''
        setNoticeFile(null)
      }
      return next
    })
    setSettlementPreview(null)
  }

  const handleOpenSettlement = (emp) => {
    setSettlementTarget(emp)
    setSettlementForm({
      ...emptySettlementForm,
      termination_date: emp.termination_date || new Date().toISOString().slice(0, 10),
    })
    setSettlementPreview(null)
    setSettlementError('')
    setSettlementSuccess('')
    setNoticeFile(null)
  }

  const handleOpenVacation = async (emp) => {
    setVacationTarget(emp)
    setVacationForm({
      days: '',
      start_date: new Date().toISOString().slice(0, 10),
      notes: '',
    })
    setVacationBalance(null)
    setVacationError('')
    setVacationSuccess('')
    setVacationLoading(true)
    try {
      const res = await reportsApi.vacationDetail(emp.id)
      setVacationBalance(res.data)
    } catch (e) {
      setVacationError(getApiError(e, 'Error al consultar saldo de vacaciones'))
    } finally {
      setVacationLoading(false)
    }
  }

  const handleCloseVacation = () => {
    if (vacationSaving) return
    setVacationTarget(null)
    setVacationBalance(null)
    setVacationError('')
  }

  const vacationDays = vacationForm.days ? parseFloat(vacationForm.days) : null
  const vacationEndDate = vacationDays
    ? addVacationDaysToDate(vacationForm.start_date, vacationDays)
    : ''
  const vacationPreviewAmount = vacationTarget && vacationDays
    ? calcVacationPayment(vacationTarget.base_salary, vacationDays)
    : null
  const accumulatedDays = parseFloat(vacationBalance?.accumulated_days ?? 0)

  const handleRegisterVacation = async () => {
    if (!vacationTarget) return
    if (!vacationForm.start_date) {
      setVacationError('Indica la fecha de inicio')
      return
    }
    if (!vacationDays || vacationDays <= 0) {
      setVacationError('Indica los días de vacaciones')
      return
    }
    if (vacationDays > accumulatedDays) {
      setVacationError(`Solo hay ${accumulatedDays.toLocaleString('es-PA', { minimumFractionDigits: 2 })} días acumulados`)
      return
    }

    setVacationSaving(true)
    setVacationError('')
    try {
      await reportsApi.registerVacationUsage({
        employee_id: vacationTarget.id,
        start_date: vacationForm.start_date,
        days: vacationDays,
        notes: vacationForm.notes || undefined,
      })
      setVacationSuccess(`Vacaciones registradas para ${vacationTarget.first_name} ${vacationTarget.last_name}`)
      setVacationTarget(null)
      setVacationBalance(null)
    } catch (e) {
      setVacationError(getApiError(e, 'Error al registrar vacaciones'))
    } finally {
      setVacationSaving(false)
    }
  }

  const handleCloseSettlement = () => {
    if (calculating || savingSettlement) return
    setSettlementTarget(null)
    setSettlementPreview(null)
    setSettlementError('')
    setNoticeFile(null)
  }

  const buildSettlementPayload = () => {
    const payload = {
      termination_date: settlementForm.termination_date,
      reason: settlementForm.reason,
      notes: settlementForm.notes.trim() || undefined,
    }
    if (settlementForm.reason === 'despido_injustificado' && settlementForm.employer_gave_notice !== '') {
      payload.employer_gave_notice = settlementForm.employer_gave_notice === 'true'
    }
    if (settlementForm.reason === 'renuncia_voluntaria' && settlementForm.employee_gave_notice !== '') {
      payload.employee_gave_notice = settlementForm.employee_gave_notice === 'true'
    }
    return payload
  }

  const handleCalculateSettlement = async () => {
    if (!settlementTarget) return
    if (!settlementForm.termination_date) {
      setSettlementError('Indica la fecha de cese')
      return
    }
    if (
      settlementForm.reason === 'renuncia_voluntaria'
      && settlementTarget.contract_type === 'indefinido'
      && settlementForm.employee_gave_notice === ''
    ) {
      setSettlementError('Indica si el trabajador dio preaviso de 15 días')
      return
    }
    if (
      settlementForm.reason === 'despido_injustificado'
      && settlementTarget.contract_type === 'indefinido'
      && settlementForm.employer_gave_notice === ''
    ) {
      setSettlementError('Indica si el empleador dio preaviso')
      return
    }

    setCalculating(true)
    setSettlementError('')
    setSettlementSuccess('')
    try {
      const res = await employeesApi.previewSettlement(settlementTarget.id, buildSettlementPayload())
      setSettlementPreview(res.data)
    } catch (e) {
      setSettlementError(getApiError(e, 'Error al calcular la liquidación'))
      setSettlementPreview(null)
    } finally {
      setCalculating(false)
    }
  }

  const handleSaveSettlement = async () => {
    if (!settlementTarget) return
    if (!settlementPreview) {
      setSettlementError('Calcula la liquidación antes de guardarla')
      return
    }

    setSavingSettlement(true)
    setSettlementError('')
    setSettlementSuccess('')
    try {
      const res = await employeesApi.createSettlement(settlementTarget.id, {
        ...buildSettlementPayload(),
        apply_termination: Boolean(settlementForm.apply_termination),
      })
      if (noticeFile && settlementForm.reason === 'renuncia_voluntaria') {
        await employeesApi.uploadSettlementNotice(res.data.id, noticeFile)
      }
      setSettlementSuccess('Liquidación guardada correctamente')
      setSettlementTarget(null)
      setSettlementPreview(null)
      setNoticeFile(null)
      load()
    } catch (e) {
      setSettlementError(getApiError(e, 'Error al guardar la liquidación'))
    } finally {
      setSavingSettlement(false)
    }
  }

  const field = (key, value) => setForm((prev) => {
    const next = { ...prev, [key]: value }
    if (key === 'status' && value === 'activo') {
      next.termination_date = ''
    }
    if (key === 'termination_date' && value) {
      next.status = 'inactivo'
    }
    return next
  })

  const companyLabel = (code) => {
    if (!code) return '—'
    const company = companyByCode[code]
    return company ? company.commercial_name : code
  }

  const reasonMeta = SETTLEMENT_REASONS.find(r => r.value === settlementForm.reason) || SETTLEMENT_REASONS[0]
  const isResignation = settlementForm.reason === 'renuncia_voluntaria'
  const isUnjustified = settlementForm.reason === 'despido_injustificado'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Empleados</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            {employees.length} empleado{employees.length !== 1 ? 's' : ''}
            {employees.some(e => !e.is_active) && (
              <> · {employees.filter(e => e.is_active).length} activos · {employees.filter(e => !e.is_active).length} inactivos</>
            )}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
          Nuevo empleado
        </Button>
      </Box>

      {settlementSuccess && !settlementTarget && (
        <AppAlert severity="success" variant="banner" onClose={() => setSettlementSuccess('')}>{settlementSuccess}</AppAlert>
      )}
      {vacationSuccess && !vacationTarget && (
        <AppAlert severity="success" variant="banner" onClose={() => setVacationSuccess('')}>{vacationSuccess}</AppAlert>
      )}

      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Buscar por nombre, cédula o código..."
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
              {['Código', 'Nombre', 'Empresa', 'Cédula', 'Cargo', 'Departamento', 'Salario Base', 'Horas/sem', 'Contrato', 'Estado', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6 }}>
                  <PeopleOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin empleados registrados</Typography>
                </TableCell>
              </TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id} sx={{ opacity: emp.is_active ? 1 : 0.55 }}>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.accent }}>
                  {emp.employee_code}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem', color: COLORS.textSecondary }}>
                  {companyLabel(emp.company_code)}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{emp.document_id}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{emp.position}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{emp.department}</TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.success }}>
                  ${parseFloat(emp.base_salary).toLocaleString('es-PA', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.textSecondary }}>
                  {effectiveWeeklyHours(emp).toLocaleString('es-PA', { maximumFractionDigits: 1 })}
                  {emp.works_saturday_half_day && (
                    <Chip label="Sáb ½" size="small" sx={{ ml: 0.75, height: 18, fontSize: '0.62rem' }} />
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={emp.contract_type} size="small"
                    sx={{ fontSize: '0.68rem', height: 20, bgcolor: alpha(COLORS.textMuted, 0.1), color: COLORS.textSecondary }} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={!emp.is_active ? 'inactivo' : emp.status}
                    size="small"
                    color={!emp.is_active ? 'error' : (statusColor[emp.status] || 'default')}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Tooltip title="Registrar vacaciones">
                      <IconButton size="small" onClick={() => handleOpenVacation(emp)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                        <BeachAccessOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Calcular cese">
                      <IconButton size="small" onClick={() => handleOpenSettlement(emp)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.accent } }}>
                        <CalculateOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenEdit(emp)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                        <EditOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {emp.is_active && (
                      <Tooltip title="Desactivar">
                        <IconButton size="small" onClick={() => handleDeactivate(emp.id)}
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

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth scroll="body" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          {editing ? 'Editar empleado' : 'Nuevo empleado'}
        </DialogTitle>
        <DialogContent>
          {error && <AppAlert severity="error">{error}</AppAlert>}
          <EmployeeFormFields form={form} field={field} editing={editing} companies={companyOptions} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${COLORS.borderSubtle}`, pt: 2 }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving
              ? <CircularProgress size={18} sx={{ color: COLORS.white }} />
              : editing ? 'Guardar cambios' : 'Crear empleado'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(settlementTarget)}
        onClose={handleCloseSettlement}
        maxWidth="sm"
        fullWidth
        scroll="body"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Calcular cese / liquidación
        </DialogTitle>
        <DialogContent>
          {settlementError && <AppAlert severity="error">{settlementError}</AppAlert>}
          {settlementTarget && (
            <>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2 }}>
                <strong>{settlementTarget.first_name} {settlementTarget.last_name}</strong>
                {' · '}Salario {money(settlementTarget.base_salary)}
                {' · '}Ingreso {settlementTarget.hire_date}
                {' · '}Contrato {settlementTarget.contract_type}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Fecha de cese"
                    value={settlementForm.termination_date}
                    onChange={(e) => settlementField('termination_date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Motivo de cese"
                    value={settlementForm.reason}
                    onChange={(e) => settlementField('reason', e.target.value)}
                    helperText={reasonMeta.hint}
                  >
                    {SETTLEMENT_REASONS.map((r) => (
                      <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {isUnjustified && settlementTarget.contract_type === 'indefinido' && (
                  <Grid item xs={12}>
                    <FormControl>
                      <FormLabel sx={{ fontSize: '0.85rem', mb: 0.5 }}>
                        ¿El empleador dio preaviso?
                      </FormLabel>
                      <RadioGroup
                        row
                        value={settlementForm.employer_gave_notice}
                        onChange={(e) => settlementField('employer_gave_notice', e.target.value)}
                      >
                        <FormControlLabel value="true" control={<Radio size="small" />} label="Sí" />
                        <FormControlLabel value="false" control={<Radio size="small" />} label="No (pagar 1 mes)" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                )}

                {isResignation && (
                  <>
                    {settlementTarget.contract_type === 'indefinido' && (
                      <Grid item xs={12}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.85rem', mb: 0.5 }}>
                            ¿El trabajador dio preaviso de 15 días?
                          </FormLabel>
                          <RadioGroup
                            row
                            value={settlementForm.employee_gave_notice}
                            onChange={(e) => settlementField('employee_gave_notice', e.target.value)}
                          >
                            <FormControlLabel value="true" control={<Radio size="small" />} label="Sí" />
                            <FormControlLabel value="false" control={<Radio size="small" />} label="No (descontar 1 semana)" />
                          </RadioGroup>
                        </FormControl>
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUploadOutlined />}
                        sx={{ mb: 0.5 }}
                      >
                        {noticeFile ? noticeFile.name : 'Cargar carta de preaviso (opcional)'}
                        <input
                          type="file"
                          hidden
                          accept="image/*,application/pdf,.pdf"
                          onChange={(e) => setNoticeFile(e.target.files?.[0] || null)}
                        />
                      </Button>
                      <Typography variant="caption" display="block" sx={{ color: COLORS.textMuted }}>
                        Imagen o PDF. Se adjunta al guardar la liquidación.
                      </Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Notas (opcional)"
                    value={settlementForm.notes}
                    onChange={(e) => settlementField('notes', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={settlementForm.apply_termination}
                        onChange={(e) => settlementField('apply_termination', e.target.checked)}
                      />
                    )}
                    label="Al guardar, aplicar cese (fecha + inactivar empleado)"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, mb: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={calculating ? <CircularProgress size={16} /> : <CalculateOutlined />}
                  onClick={handleCalculateSettlement}
                  disabled={calculating || savingSettlement}
                >
                  Calcular liquidación
                </Button>
              </Box>

              {settlementPreview && (
                <Box sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: COLORS.accentMuted,
                  border: `1px solid ${alpha(COLORS.accent, 0.2)}`,
                }}>
                  <Typography sx={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '0.68rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLORS.textMuted,
                    mb: 1,
                  }}>
                    Detalle · {parseFloat(settlementPreview.years_of_service).toFixed(2)} años de servicio
                  </Typography>
                  <SettlementLine label="Prima de antigüedad" value={money(settlementPreview.seniority_bonus)} />
                  <SettlementLine
                    label={`Vacaciones (${parseFloat(settlementPreview.vacation_days).toFixed(2)} días)`}
                    value={money(settlementPreview.vacation_amount)}
                  />
                  <SettlementLine
                    label={`Décimo proporcional (${settlementPreview.decimo_period_label})`}
                    value={money(settlementPreview.decimo_amount)}
                  />
                  {parseFloat(settlementPreview.indemnity_amount) > 0 && (
                    <SettlementLine label="Indemnización" value={money(settlementPreview.indemnity_amount)} />
                  )}
                  {parseFloat(settlementPreview.employer_notice_amount) > 0 && (
                    <SettlementLine label="Preaviso (empleador)" value={money(settlementPreview.employer_notice_amount)} />
                  )}
                  {parseFloat(settlementPreview.employee_notice_deduction) > 0 && (
                    <SettlementLine
                      label="Descuento preaviso (trabajador)"
                      value={`-${money(settlementPreview.employee_notice_deduction).slice(1)}`}
                      muted
                    />
                  )}
                  <Divider sx={{ my: 1 }} />
                  <SettlementLine label="Total bruto" value={money(settlementPreview.gross_total)} />
                  <SettlementLine label="Total neto a pagar" value={money(settlementPreview.net_total)} emphasize />
                  {settlementPreview.notes?.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      {settlementPreview.notes.map((n) => (
                        <Typography key={n} variant="caption" display="block" sx={{ color: COLORS.textMuted }}>
                          • {n}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${COLORS.borderSubtle}`, pt: 2 }}>
          <Button onClick={handleCloseSettlement} disabled={calculating || savingSettlement} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettlement}
            disabled={!settlementPreview || calculating || savingSettlement}
          >
            {savingSettlement
              ? <CircularProgress size={18} sx={{ color: COLORS.white }} />
              : 'Guardar liquidación'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(vacationTarget)}
        onClose={handleCloseVacation}
        maxWidth="xs"
        fullWidth
        scroll="body"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Registrar vacaciones
        </DialogTitle>
        <DialogContent>
          {vacationError && <AppAlert severity="error">{vacationError}</AppAlert>}
          {vacationTarget && (
            <>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2 }}>
                <strong>{vacationTarget.first_name} {vacationTarget.last_name}</strong>
                {vacationLoading
                  ? ' · Consultando saldo…'
                  : ` · Saldo: ${accumulatedDays.toLocaleString('es-PA', { minimumFractionDigits: 2 })} días`}
              </Typography>
              {vacationLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </Box>
              ) : (
                <>
                  <TextField
                    fullWidth
                    label="Fecha inicio"
                    type="date"
                    value={vacationForm.start_date}
                    onChange={(e) => setVacationForm((f) => ({ ...f, start_date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Días a tomar"
                    type="number"
                    value={vacationForm.days}
                    onChange={(e) => setVacationForm((f) => ({ ...f, days: e.target.value }))}
                    inputProps={{ min: 0.01, max: Math.max(accumulatedDays, 0.01), step: 0.01 }}
                    disabled={accumulatedDays <= 0}
                    helperText={accumulatedDays <= 0 ? 'Sin días acumulados disponibles' : undefined}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Fecha fin"
                    type="date"
                    value={vacationEndDate}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ readOnly: true }}
                    helperText="Calculada: inicio + días de vacaciones"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Notas (opcional)"
                    value={vacationForm.notes}
                    onChange={(e) => setVacationForm((f) => ({ ...f, notes: e.target.value }))}
                    multiline
                    rows={2}
                    sx={{ mb: 1 }}
                  />
                  {vacationPreviewAmount != null && (
                    <Box sx={{
                      p: 1.5, borderRadius: 2,
                      bgcolor: COLORS.brandMuted,
                      border: `1px solid ${alpha(COLORS.brand, 0.2)}`,
                    }}>
                      <Typography sx={{ fontSize: '0.82rem', color: COLORS.textSecondary }}>Monto estimado a pagar</Typography>
                      <Typography sx={{ fontFamily: '"DM Mono", monospace', fontWeight: 700, color: COLORS.brand }}>
                        {money(vacationPreviewAmount)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: COLORS.textMuted, mt: 0.5 }}>
                        {vacationDays} × ({money(vacationTarget.base_salary)} ÷ 30)
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${COLORS.borderSubtle}`, pt: 2 }}>
          <Button onClick={handleCloseVacation} disabled={vacationSaving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleRegisterVacation}
            disabled={vacationSaving || vacationLoading || accumulatedDays <= 0}
          >
            {vacationSaving
              ? <CircularProgress size={18} sx={{ color: COLORS.white }} />
              : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
