import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Tooltip, IconButton, Checkbox, InputAdornment, Collapse, MenuItem,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, CheckCircleOutlined, ReceiptLongOutlined,
  BusinessOutlined, GroupsOutlined, SearchOutlined,
  DeleteOutlined, CancelOutlined, FilterListOutlined,
  KeyboardArrowDownOutlined, KeyboardArrowRightOutlined,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { payrollApi, employeesApi, getApiError } from '../services/api'
import { useAuthStore } from '../context/authStore'
import { COLORS } from '../theme/theme'

const statusColor = {
  borrador: 'warning',
  procesado: 'default',
  pagado: 'success',
  anulado: 'error',
}

const statusLabel = {
  borrador: 'Borrador',
  procesado: 'Procesado',
  pagado: 'Pagado',
  anulado: 'Rechazada',
}

const PAYROLL_TYPES = [
  { value: 'regular', label: 'Nómina regular' },
  { value: 'decimo', label: 'Décimo tercer mes' },
]

const CUATRIMESTRE_OPTIONS = [
  { value: 1, label: '1.ª cuota — Dic a Mar (pago 15 abr)' },
  { value: 2, label: '2.ª cuota — Abr a Jul (pago 15 ago)' },
  { value: 3, label: '3.ª cuota — Ago a Nov (pago 15 dic)' },
]

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

function periodParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 7) return null
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  if (!year || !month) return null
  return { year, month }
}

function getSuggestedPaymentDate(year, cuatrimestre) {
  const paymentMonths = { 1: 4, 2: 8, 3: 12 }
  const month = paymentMonths[cuatrimestre]
  return `${year}-${String(month).padStart(2, '0')}-15`
}

const SCOPE_OPTIONS = [
  {
    value: 'company',
    label: 'Toda la compañía',
    description: 'Genera la nómina para todos los empleados activos del período.',
    icon: BusinessOutlined,
  },
  {
    value: 'selected',
    label: 'Empleados seleccionados',
    description: 'Elige manualmente quiénes recibirán nómina en este período.',
    icon: GroupsOutlined,
  },
]

const emptyForm = {
  payroll_type: 'regular',
  period_start: '',
  period_end: '',
  cuatrimestre_year: String(new Date().getFullYear()),
  cuatrimestre: '1',
  payment_date: getSuggestedPaymentDate(new Date().getFullYear(), 1),
  overtime_hours: '0',
  bonuses: '0',
  commissions: '0',
  other_deductions: '0',
  notes: '',
}

/** Misma fórmula que el backend: salario mensual / horas mensuales equivalentes */
function getEffectiveWeeklyHours(employee) {
  if (!employee) return 40
  const weekly = parseFloat(employee.weekly_contract_hours ?? 40)
  return weekly + (employee.works_saturday_half_day ? 4 : 0)
}

function getHourlyRate(employee) {
  if (!employee?.base_salary) return null
  const monthlyHours = getEffectiveWeeklyHours(employee) * 52 / 12
  if (!monthlyHours) return null
  return parseFloat(employee.base_salary) / monthlyHours
}

function getOvertimeHourlyRate(employee) {
  const hourly = getHourlyRate(employee)
  return hourly != null ? hourly * 1.5 : null
}

function ScopeOptionCard({ option, selected, onSelect }) {
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

function DeductionBreakdown({ payroll, fmt }) {
  const other = parseFloat(payroll.other_deductions) || 0
  const legalTotal = parseFloat(payroll.total_deductions) || 0
  const grandTotal = legalTotal + other
  const isDecimo = payroll.payroll_type === 'decimo'

  const rows = [
    { label: 'Seguro Social', rate: '9.75%', value: payroll.social_security },
    { label: 'Seguro educativo', rate: '1.25%', value: payroll.educational_insurance ?? 0 },
    { label: 'Impuesto sobre la renta (ISR)', rate: null, value: payroll.income_tax },
  ]

  const earningsRows = isDecimo ? [
    { label: 'Salario base acumulado', value: payroll.base_salary },
    { label: 'Horas extra acumuladas', value: payroll.overtime_amount },
    { label: 'Bonificaciones acumuladas', value: payroll.bonuses },
    { label: 'Comisiones acumuladas', value: payroll.commissions },
    { label: 'Total devengado del cuatrimestre', value: payroll.decimo_accrued_total, highlight: true },
    { label: 'Monto décimo (÷ 12)', value: payroll.gross_salary, highlight: true },
  ] : [
    { label: 'Salario base', value: payroll.base_salary },
    { label: 'Horas extra', value: payroll.overtime_amount },
    { label: 'Bonificaciones', value: payroll.bonuses },
    { label: 'Comisiones', value: payroll.commissions },
    { label: 'Salario bruto', value: payroll.gross_salary, highlight: true },
  ]

  return (
    <Box sx={{
      py: 2,
      px: 2.5,
      bgcolor: alpha(COLORS.error, 0.04),
      borderTop: `1px solid ${COLORS.borderSubtle}`,
    }}>
      <Typography sx={{
        fontFamily: '"DM Mono", monospace',
        fontSize: '0.68rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: COLORS.textMuted,
        mb: 1.5,
      }}>
        {isDecimo ? 'Desglose del décimo' : 'Desglose de ingresos'}
      </Typography>

      <Box sx={{ mb: 2 }}>
        {earningsRows.map(row => (
          <Box
            key={row.label}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 0.75,
              borderBottom: `1px dashed ${alpha(COLORS.borderSubtle, 0.8)}`,
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', color: row.highlight ? COLORS.textPrimary : COLORS.textSecondary, fontWeight: row.highlight ? 600 : 400 }}>
              {row.label}
            </Typography>
            <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8125rem', color: COLORS.brand, fontWeight: row.highlight ? 700 : 600 }}>
              {fmt(row.value)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography sx={{
        fontFamily: '"DM Mono", monospace',
        fontSize: '0.68rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: COLORS.textMuted,
        mb: 1.5,
      }}>
        Desglose de deducciones
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <Box>
          {rows.map(row => (
            <Box
              key={row.label}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 0.75,
                borderBottom: `1px dashed ${alpha(COLORS.borderSubtle, 0.8)}`,
                '&:last-of-type': { borderBottom: other > 0 ? `1px dashed ${alpha(COLORS.borderSubtle, 0.8)}` : 'none' },
              }}
            >
              <Typography sx={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}>
                {row.label}
                {row.rate && (
                  <Typography component="span" sx={{ ml: 0.75, fontSize: '0.72rem', color: COLORS.textMuted }}>
                    ({row.rate})
                  </Typography>
                )}
              </Typography>
              <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8125rem', color: COLORS.error, fontWeight: 600 }}>
                {fmt(row.value)}
              </Typography>
            </Box>
          ))}
          {other > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
              <Typography sx={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}>
                Otras deducciones
              </Typography>
              <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8125rem', color: COLORS.error, fontWeight: 600 }}>
                {fmt(other)}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: COLORS.cardBg,
          border: `1px solid ${COLORS.borderSubtle}`,
          alignSelf: { sm: 'start' },
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', color: COLORS.textSecondary }}>Deducciones legales</Typography>
            <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem', color: COLORS.error }}>{fmt(legalTotal)}</Typography>
          </Box>
          {other > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '0.78rem', color: COLORS.textSecondary }}>Otras deducciones</Typography>
              <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem', color: COLORS.error }}>{fmt(other)}</Typography>
            </Box>
          )}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            pt: 1,
            mt: 0.5,
            borderTop: `1px solid ${COLORS.borderSubtle}`,
          }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: COLORS.textPrimary }}>Total retenido</Typography>
            <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.9rem', fontWeight: 700, color: COLORS.error }}>
              {fmt(grandTotal)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.25 }}>
            <Typography sx={{ fontSize: '0.78rem', color: COLORS.textSecondary }}>Salario neto</Typography>
            <Typography sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', fontWeight: 700, color: COLORS.success }}>
              {fmt(payroll.net_salary)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default function PayrollPage() {
  const { user } = useAuthStore()
  const [payrolls, setPayrolls]         = useState([])
  const [employees, setEmployees]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [openForm, setOpenForm]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 })
  const [error, setError]               = useState('')
  const [actionError, setActionError]   = useState('')
  const [successMsg, setSuccessMsg]     = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [scopeMode, setScopeMode]       = useState('company')
  const [selectedIds, setSelectedIds]   = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [form, setForm]                 = useState(emptyForm)
  const [expandedId, setExpandedId]     = useState(null)
  const [decimoPreview, setDecimoPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [filterYear, setFilterYear] = useState(ALL_FILTER)
  const [filterMonth, setFilterMonth] = useState(ALL_FILTER)
  const [filterEmployeeId, setFilterEmployeeId] = useState(ALL_FILTER)

  const isDecimoMode = form.payroll_type === 'decimo'
  const hasActiveFilters = filterYear !== ALL_FILTER || filterMonth !== ALL_FILTER || filterEmployeeId !== ALL_FILTER

  const activeEmployees = useMemo(
    () => employees.filter(e => e.is_active && e.status === 'activo'),
    [employees],
  )

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return activeEmployees
    return activeEmployees.filter((e) => {
      const full = `${e.first_name} ${e.last_name}`.toLowerCase()
      return full.includes(q) || e.employee_code.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)
    })
  }, [activeEmployees, employeeSearch])

  const filterYearOptions = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    payrolls.forEach((p) => {
      const parts = periodParts(p.period_start)
      if (parts) years.add(parts.year)
      if (p.cuatrimestre_year) years.add(Number(p.cuatrimestre_year))
    })
    if (filterYear !== ALL_FILTER) years.add(Number(filterYear))
    return [...years].sort((a, b) => b - a)
  }, [payrolls, filterYear])

  const filterEmployeeOptions = useMemo(() => {
    const byId = new Map()
    employees.forEach((e) => byId.set(e.id, e))
    payrolls.forEach((p) => {
      if (!byId.has(p.employee_id)) {
        byId.set(p.employee_id, {
          id: p.employee_id,
          first_name: `ID ${p.employee_id}`,
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
  }, [employees, payrolls])

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      if (filterEmployeeId !== ALL_FILTER && p.employee_id !== Number(filterEmployeeId)) {
        return false
      }
      const parts = periodParts(p.period_start)
      if (filterYear !== ALL_FILTER) {
        const year = parts?.year ?? (p.cuatrimestre_year ? Number(p.cuatrimestre_year) : null)
        if (year !== Number(filterYear)) return false
      }
      if (filterMonth !== ALL_FILTER) {
        if (!parts || parts.month !== Number(filterMonth)) return false
      }
      return true
    })
  }, [payrolls, filterYear, filterMonth, filterEmployeeId])

  const targetCount = isDecimoMode && decimoPreview?.items?.length
    ? (scopeMode === 'company' ? decimoPreview.items.length : selectedIds.filter(id => decimoPreview.items.some(i => i.employee_id === id)).length)
    : (scopeMode === 'company' ? activeEmployees.length : selectedIds.length)

  const clearFilters = () => {
    setFilterYear(ALL_FILTER)
    setFilterMonth(ALL_FILTER)
    setFilterEmployeeId(ALL_FILTER)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pr, er] = await Promise.all([
        payrollApi.list({ limit: 200 }),
        employeesApi.list({ limit: 200 }),
      ])
      setPayrolls(pr.data)
      setEmployees(er.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpenForm = () => {
    setError('')
    setSuccessMsg('')
    setScopeMode('company')
    setSelectedIds([])
    setEmployeeSearch('')
    setDecimoPreview(null)
    setForm(emptyForm)
    setOpenForm(true)
  }

  const handleCloseForm = () => {
    if (saving) return
    setOpenForm(false)
    setError('')
    setSuccessMsg('')
  }

  const toggleEmployee = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleAllFiltered = () => {
    const filteredIds = filteredEmployees.map(e => e.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])])
    }
  }

  const handlePreviewDecimo = async () => {
    const year = parseInt(form.cuatrimestre_year, 10)
    const cuatrimestre = parseInt(form.cuatrimestre, 10)
    if (!year || !cuatrimestre) {
      setError('Indica el año y cuatrimestre')
      return
    }

    const targetIds = scopeMode === 'company'
      ? activeEmployees.map(e => e.id)
      : selectedIds

    setPreviewLoading(true)
    setError('')
    try {
      const res = await payrollApi.previewDecimo({
        year,
        cuatrimestre,
        employee_ids: scopeMode === 'selected' ? targetIds : undefined,
      })
      setDecimoPreview(res.data)
      if (!form.payment_date) {
        field('payment_date', res.data.suggested_payment_date)
      }
    } catch (e) {
      setError(getApiError(e, 'Error al calcular vista previa'))
      setDecimoPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCreate = async () => {
    let decimoItems = decimoPreview?.items

    if (isDecimoMode) {
      const year = parseInt(form.cuatrimestre_year, 10)
      const cuatrimestre = parseInt(form.cuatrimestre, 10)
      if (!year || !cuatrimestre) {
        setError('Indica el año y cuatrimestre')
        return
      }
      if (!form.payment_date) {
        setError('Indica la fecha de pago del décimo')
        return
      }
      if (!decimoItems?.length) {
        try {
          const res = await payrollApi.previewDecimo({
            year,
            cuatrimestre,
            employee_ids: scopeMode === 'selected' ? selectedIds : undefined,
          })
          decimoItems = res.data.items
          setDecimoPreview(res.data)
        } catch (e) {
          setError(getApiError(e, 'Error al calcular el décimo'))
          return
        }
      }
    }

    const targetIds = isDecimoMode
      ? (scopeMode === 'company'
        ? decimoItems.map(i => i.employee_id)
        : selectedIds.filter(id => decimoItems.some(i => i.employee_id === id)))
      : (scopeMode === 'company'
        ? activeEmployees.map(e => e.id)
        : selectedIds)

    if (!isDecimoMode) {
      if (!form.period_start || !form.period_end) {
        setError('Indica el período de la nómina')
        return
      }
      if (form.period_end < form.period_start) {
        setError('La fecha de fin debe ser posterior al inicio del período')
        return
      }
    }

    if (targetIds.length === 0) {
      setError(scopeMode === 'company'
        ? (isDecimoMode ? 'No hay empleados con décimo calculable en este cuatrimestre' : 'No hay empleados activos para generar nómina')
        : 'Selecciona al menos un empleado')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')
    setSaveProgress({ current: 0, total: targetIds.length })

    const failures = []
    let created = 0

    for (let i = 0; i < targetIds.length; i++) {
      const employee_id = targetIds[i]
      setSaveProgress({ current: i + 1, total: targetIds.length })
      try {
        const payload = isDecimoMode
          ? {
              employee_id,
              payroll_type: 'decimo',
              cuatrimestre_year: parseInt(form.cuatrimestre_year, 10),
              cuatrimestre: parseInt(form.cuatrimestre, 10),
              payment_date: form.payment_date,
              other_deductions: parseFloat(form.other_deductions) || 0,
              notes: form.notes || undefined,
            }
          : {
              employee_id,
              payroll_type: 'regular',
              period_start: form.period_start,
              period_end: form.period_end,
              overtime_hours: parseFloat(form.overtime_hours) || 0,
              bonuses: parseFloat(form.bonuses) || 0,
              commissions: parseFloat(form.commissions) || 0,
              other_deductions: parseFloat(form.other_deductions) || 0,
              notes: form.notes || undefined,
            }
        await payrollApi.create(payload)
        created++
      } catch (e) {
        const emp = activeEmployees.find(x => x.id === employee_id)
        failures.push({
          name: emp ? `${emp.first_name} ${emp.last_name}` : `ID ${employee_id}`,
          message: getApiError(e, 'Error al generar'),
        })
      }
    }

    setSaving(false)
    setSaveProgress({ current: 0, total: 0 })

    if (created > 0) {
      await load()
    }

    if (failures.length === 0) {
      setOpenForm(false)
      setForm(emptyForm)
      setSelectedIds([])
      setDecimoPreview(null)
      setSuccessMsg(
        isDecimoMode
          ? `Décimo generado para ${created} empleado${created !== 1 ? 's' : ''}`
          : `Nómina generada para ${created} empleado${created !== 1 ? 's' : ''}`,
      )
      return
    }

    if (created > 0) {
      setError(
        `Se generaron ${created} de ${targetIds.length} nóminas. Fallos: ${failures.map(f => `${f.name} (${f.message})`).join(' · ')}`,
      )
      return
    }

    setError(failures.map(f => `${f.name}: ${f.message}`).join(' · '))
  }

  const handleApprove = async (id) => {
    if (!confirm('¿Aprobar esta nómina?')) return
    setActionError('')
    try {
      await payrollApi.approve(id)
      setSuccessMsg('Nómina aprobada correctamente')
      load()
    } catch (e) {
      setActionError(getApiError(e, 'Error al aprobar la nómina'))
    }
  }

  const handleOpenDelete = (payroll) => {
    setDeleteTarget(payroll)
    setActionError('')
  }

  const handleCloseDelete = () => {
    if (deletingId) return
    setDeleteTarget(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setActionError('')
    setDeletingId(deleteTarget.id)
    try {
      await payrollApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      setSuccessMsg('Nómina eliminada correctamente')
      load()
    } catch (e) {
      setActionError(getApiError(e, 'Error al eliminar la nómina'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenReject = (payroll) => {
    setRejectTarget(payroll)
    setRejectReason('')
    setActionError('')
  }

  const handleCloseReject = () => {
    if (rejecting) return
    setRejectTarget(null)
    setRejectReason('')
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    setActionError('')
    try {
      await payrollApi.reject(rejectTarget.id, rejectReason.trim() || undefined)
      setRejectTarget(null)
      setRejectReason('')
      setSuccessMsg('Nómina rechazada correctamente')
      load()
    } catch (e) {
      setActionError(getApiError(e, 'Error al rechazar la nómina'))
    } finally {
      setRejecting(false)
    }
  }

  const fmt = (v) => `$${parseFloat(v).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`
  const fmtHourly = (v) => v == null ? '—' : `$${v.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  const field = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'payroll_type') setDecimoPreview(null)
      if (key === 'cuatrimestre' || key === 'cuatrimestre_year') {
        const year = parseInt(key === 'cuatrimestre_year' ? value : next.cuatrimestre_year, 10)
        const q = parseInt(key === 'cuatrimestre' ? value : next.cuatrimestre, 10)
        if (year && q) next.payment_date = getSuggestedPaymentDate(year, q)
        setDecimoPreview(null)
      }
      return next
    })
  }
  const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id))

  const canSubmit = isDecimoMode
    ? form.cuatrimestre_year && form.cuatrimestre && form.payment_date && targetCount > 0
    : form.period_start && form.period_end && targetCount > 0

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Nóminas</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
            {hasActiveFilters
              ? `${filteredPayrolls.length} de ${payrolls.length} registros`
              : `${payrolls.length} registros`}
            {' · '}clic en una fila para ver el desglose de deducciones
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenForm} size="small">
          Generar nómina
        </Button>
      </Box>

      {successMsg && (
        <AppAlert severity="success" variant="banner" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </AppAlert>
      )}

      {actionError && (
        <AppAlert severity="error" variant="banner" onClose={() => setActionError('')}>
          {actionError}
        </AppAlert>
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
              {['ID', 'Tipo', 'Empleado', 'Período', '$/h ordin.', 'Salario Bruto', 'Deducciones', 'Salario Neto', 'Estado', 'Acciones'].map(h => (
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
            ) : payrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <ReceiptLongOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin nóminas generadas</Typography>
                </TableCell>
              </TableRow>
            ) : filteredPayrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <FilterListOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted, mb: 1.5 }}>
                    Ninguna nómina coincide con los filtros
                  </Typography>
                  <Button size="small" onClick={clearFilters}>Limpiar filtros</Button>
                </TableCell>
              </TableRow>
            ) : filteredPayrolls.map((p) => {
              const emp = employees.find(e => e.id === p.employee_id)
              const hourlyRate = getHourlyRate(emp)
              const overtimeRate = getOvertimeHourlyRate(emp)
              const overtimeHours = parseFloat(p.overtime_hours) || 0
              const hasOvertime = overtimeHours > 0
              const isDecimoPayroll = p.payroll_type === 'decimo'
              const isRejected = p.status === 'anulado'
              const canApprove = p.status === 'borrador' && user?.role === 'admin'
              const canReject = ['borrador', 'procesado'].includes(p.status) && user?.role === 'admin'
              const canDelete = p.status === 'borrador'
              const hasActions = canApprove || canReject || canDelete
              const isExpanded = expandedId === p.id

              return (
                <Fragment key={p.id}>
                <TableRow
                  hover
                  onClick={() => toggleExpand(p.id)}
                  sx={{
                    cursor: 'pointer',
                    opacity: isRejected ? 0.65 : 1,
                    bgcolor: isExpanded
                      ? alpha(COLORS.brand, 0.04)
                      : isRejected ? alpha(COLORS.error, 0.03) : 'transparent',
                  }}
                >
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.textMuted, width: 48 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isExpanded
                        ? <KeyboardArrowDownOutlined sx={{ fontSize: 18, color: COLORS.brand }} />
                        : <KeyboardArrowRightOutlined sx={{ fontSize: 18, color: COLORS.textMuted }} />}
                      #{p.id}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={isDecimoPayroll ? 'Décimo' : 'Regular'}
                      size="small"
                      color={isDecimoPayroll ? 'info' : 'default'}
                      variant={isDecimoPayroll ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, color: isRejected ? COLORS.textSecondary : COLORS.textPrimary }}>
                    {emp ? `${emp.first_name} ${emp.last_name}` : `ID ${p.employee_id}`}
                  </TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem' }}>
                    {p.period_start} → {p.period_end}
                  </TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.78rem', color: COLORS.brand }}>
                    <Tooltip title={
                      hourlyRate != null ? (
                        <Box sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                          <div>Hora ordinaria: {fmtHourly(hourlyRate)}</div>
                          <div style={{ opacity: 0.85, marginTop: 4 }}>
                            Salario base ÷ horas mensuales del contrato
                            {emp?.works_saturday_half_day ? ' (incluye sábado medio día)' : ''}
                          </div>
                          {hasOvertime && overtimeRate != null && (
                            <div style={{ marginTop: 6 }}>
                              Hora extra en esta nómina (×1.5): {fmtHourly(overtimeRate)} · {overtimeHours} h
                            </div>
                          )}
                        </Box>
                      ) : ''
                    }>
                      <span>{fmtHourly(hourlyRate)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>{fmt(p.gross_salary)}</TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.error, fontWeight: 600 }}>
                    {fmt(p.total_deductions)}
                    {parseFloat(p.other_deductions) > 0 && (
                      <Typography component="span" sx={{ display: 'block', fontSize: '0.65rem', color: COLORS.textMuted, fontWeight: 400 }}>
                        + {fmt(p.other_deductions)} otras
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', fontWeight: 700, color: isRejected ? COLORS.textMuted : COLORS.success }}>
                    {fmt(p.net_salary)}
                  </TableCell>
                  <TableCell>
                    <Chip label={statusLabel[p.status] || p.status} size="small" color={statusColor[p.status] || 'default'} />
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    {hasActions ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        {canApprove && (
                          <Tooltip title="Aprobar nómina">
                            <IconButton size="small" onClick={() => handleApprove(p.id)}
                              sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.success } }}>
                              <CheckCircleOutlined sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canReject && (
                          <Tooltip title="Rechazar nómina">
                            <IconButton size="small" onClick={() => handleOpenReject(p)}
                              sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}>
                              <CancelOutlined sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title="Eliminar nómina">
                            <IconButton size="small" onClick={() => handleOpenDelete(p)} disabled={deletingId === p.id}
                              sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}>
                              {deletingId === p.id
                                ? <CircularProgress size={15} sx={{ color: COLORS.brand }} />
                                : <DeleteOutlined sx={{ fontSize: 17 }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem', color: COLORS.textMuted }}>—</Typography>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow key={`${p.id}-detail`}>
                  <TableCell colSpan={10} sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <DeductionBreakdown payroll={p} fmt={fmt} />
                    </Collapse>
                  </TableCell>
                </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(rejectTarget)}
        onClose={handleCloseReject}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Rechazar nómina
        </DialogTitle>
        <DialogContent>
          {rejectTarget && (() => {
            const emp = employees.find(e => e.id === rejectTarget.employee_id)
            const name = emp ? `${emp.first_name} ${emp.last_name}` : `ID ${rejectTarget.employee_id}`
            return (
              <>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2 }}>
                  La nómina de <strong>{name}</strong> ({rejectTarget.period_start} → {rejectTarget.period_end}) quedará marcada como rechazada y no podrá procesarse ni pagarse.
                </Typography>
                <TextField
                  fullWidth
                  label="Motivo del rechazo (opcional)"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  multiline
                  rows={3}
                  placeholder="Ej. Período incorrecto, datos duplicados..."
                />
              </>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseReject} disabled={rejecting} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={rejecting}
            startIcon={rejecting ? null : <CancelOutlined />}
          >
            {rejecting ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Rechazar nómina'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={handleCloseDelete}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Syne", sans-serif', pb: 1 }}>
          Eliminar nómina
        </DialogTitle>
        <DialogContent>
          {deleteTarget && (() => {
            const emp = employees.find(e => e.id === deleteTarget.employee_id)
            const name = emp ? `${emp.first_name} ${emp.last_name}` : `ID ${deleteTarget.employee_id}`
            return (
              <>
                <AppAlert severity="warning" showTitle sx={{ mb: 2 }}>
                  Esta acción no se puede deshacer. La nómina se borrará permanentemente del sistema.
                </AppAlert>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                  ¿Deseas eliminar la nómina de <strong>{name}</strong> ({deleteTarget.period_start} → {deleteTarget.period_end})?
                </Typography>
              </>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDelete} disabled={Boolean(deletingId)} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={Boolean(deletingId)}
            startIcon={deletingId ? null : <DeleteOutlined />}
          >
            {deletingId ? <CircularProgress size={18} sx={{ color: COLORS.white }} /> : 'Eliminar nómina'}
          </Button>
        </DialogActions>
      </Dialog>

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
              <ReceiptLongOutlined />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '1.15rem', color: COLORS.textPrimary, lineHeight: 1.2 }}>
                Generar nómina
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary, mt: 0.25 }}>
                Define el alcance, período y valores del cálculo
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
            Tipo de nómina
          </Typography>

          <TextField
            fullWidth
            select
            label="Tipo"
            value={form.payroll_type}
            onChange={e => field('payroll_type', e.target.value)}
            sx={{ mb: 2.5 }}
          >
            {PAYROLL_TYPES.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          <Typography sx={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
            mb: 1.5,
          }}>
            Alcance de generación
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
            {SCOPE_OPTIONS.map((option) => (
              <ScopeOptionCard
                key={option.value}
                option={option}
                selected={scopeMode === option.value}
                onSelect={setScopeMode}
              />
            ))}
          </Box>

          {scopeMode === 'company' ? (
            <Box sx={{
              mb: 2.5, p: 1.75, borderRadius: 2,
              bgcolor: COLORS.brandMuted,
              border: `1px solid ${alpha(COLORS.brand, 0.18)}`,
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: COLORS.textPrimary, fontWeight: 600, mb: 0.35 }}>
                {activeEmployees.length} empleado{activeEmployees.length !== 1 ? 's' : ''} activo{activeEmployees.length !== 1 ? 's' : ''}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: 1.45 }}>
                Se generará una nómina individual para cada empleado activo de la compañía.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: '0.82rem', color: COLORS.textSecondary }}>
                  {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
                </Typography>
                <Button size="small" onClick={toggleAllFiltered} disabled={filteredEmployees.length === 0}
                  sx={{ fontSize: '0.75rem', color: COLORS.brand }}>
                  {filteredEmployees.every(e => selectedIds.includes(e.id)) && filteredEmployees.length > 0
                    ? 'Quitar todos'
                    : 'Seleccionar todos'}
                </Button>
              </Box>

              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por nombre, código o departamento"
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                sx={{ mb: 1.25 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined sx={{ fontSize: 18, color: COLORS.textMuted }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{
                maxHeight: 220,
                overflowY: 'auto',
                border: `1px solid ${COLORS.borderSubtle}`,
                borderRadius: 2,
                bgcolor: COLORS.cardBg,
              }}>
                {filteredEmployees.length === 0 ? (
                  <Typography sx={{ p: 2, fontSize: '0.82rem', color: COLORS.textMuted, textAlign: 'center' }}>
                    No hay empleados activos que coincidan
                  </Typography>
                ) : filteredEmployees.map((emp) => {
                  const checked = selectedIds.includes(emp.id)
                  const hourlyRate = getHourlyRate(emp)
                  return (
                    <Box
                      key={emp.id}
                      onClick={() => toggleEmployee(emp.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        px: 1.25, py: 1,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${COLORS.borderSubtle}`,
                        bgcolor: checked ? COLORS.brandMuted : 'transparent',
                        '&:hover': { bgcolor: checked ? COLORS.brandMuted : alpha(COLORS.brand, 0.03) },
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        size="small"
                        sx={{ p: 0.5, color: COLORS.textMuted, '&.Mui-checked': { color: COLORS.brand } }}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleEmployee(emp.id)}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: COLORS.textPrimary }}>
                          {emp.first_name} {emp.last_name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: COLORS.textSecondary }}>
                          {emp.employee_code} · {emp.department}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{
                          fontFamily: '"DM Mono", monospace',
                          fontSize: '0.72rem',
                          color: COLORS.textMuted,
                        }}>
                          {fmt(emp.base_salary)}
                        </Typography>
                        <Typography sx={{
                          fontFamily: '"DM Mono", monospace',
                          fontSize: '0.65rem',
                          color: COLORS.brand,
                        }}>
                          {fmtHourly(hourlyRate)}/h
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}

          <Typography sx={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
            mb: 1.5,
          }}>
            {isDecimoMode ? 'Cuatrimestre y pago' : 'Período y cálculo'}
          </Typography>

          <Grid container spacing={2}>
            {isDecimoMode ? (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Año de pago" type="number" value={form.cuatrimestre_year}
                    onChange={e => field('cuatrimestre_year', e.target.value)} inputProps={{ min: 2000, max: 2100 }}
                    helperText="Año en que se paga la cuota (ej. 2026 para pago 15 abr 2026)" />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField fullWidth select label="Cuota" value={form.cuatrimestre}
                    onChange={e => field('cuatrimestre', e.target.value)}>
                    {CUATRIMESTRE_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={String(opt.value)}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Fecha de pago" type="date" value={form.payment_date}
                    onChange={e => field('payment_date', e.target.value)} InputLabelProps={{ shrink: true }}
                    helperText="Sugerido: 15 abr, 15 ago o 15 dic" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Otras deducciones" type="number" value={form.other_deductions}
                    onChange={e => field('other_deductions', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    onClick={handlePreviewDecimo}
                    disabled={previewLoading || targetCount === 0}
                    sx={{ mb: 1 }}
                  >
                    {previewLoading ? <CircularProgress size={18} /> : 'Vista previa del décimo'}
                  </Button>
                </Grid>
                {decimoPreview?.items?.length > 0 && (
                  <Grid item xs={12}>
                    <TableContainer sx={{ border: `1px solid ${COLORS.borderSubtle}`, borderRadius: 2, maxHeight: 240 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {['Empleado', 'Devengado', 'Décimo', 'Notas'].map(h => (
                              <TableCell key={h}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {decimoPreview.items.map(item => (
                            <TableRow key={item.employee_id}>
                              <TableCell>{item.employee_name}</TableCell>
                              <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem' }}>{fmt(item.accrued_total)}</TableCell>
                              <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: COLORS.brand }}>{fmt(item.decimo_amount)}</TableCell>
                              <TableCell sx={{ fontSize: '0.72rem', color: COLORS.textSecondary }}>
                                {item.is_proportional ? 'Proporcional' : 'Completo'}
                                {item.notes ? ` · ${item.notes}` : ''}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                )}
              </>
            ) : (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Inicio período" type="date" value={form.period_start}
                    onChange={e => field('period_start', e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Fin período" type="date" value={form.period_end}
                    onChange={e => field('period_end', e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Horas extras" type="number" value={form.overtime_hours}
                    onChange={e => field('overtime_hours', e.target.value)} inputProps={{ min: 0, step: 0.5 }}
                     />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Bonificaciones" type="number" value={form.bonuses}
                    onChange={e => field('bonuses', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Comisiones" type="number" value={form.commissions}
                    onChange={e => field('commissions', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Otras deducciones" type="number" value={form.other_deductions}
                    onChange={e => field('other_deductions', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Notas (opcional)" value={form.notes}
                onChange={e => field('notes', e.target.value)} multiline rows={2} />
            </Grid>
          </Grid>

          <Typography sx={{ mt: 2, fontSize: '0.75rem', color: COLORS.textMuted }}>
            {isDecimoMode
              ? 'El décimo suma el devengado bruto del período de la cuota (1.ª: dic–mar, 2.ª: abr–jul, 3.ª: ago–nov) y lo divide entre 12. La 1.ª cuota incluye diciembre del año anterior. Si faltan nóminas regulares, se proyecta el salario base.'
              : 'El salario base se prorratea según los días del período. Para empleados sin personal de confianza, se validan marcaciones completas (entrada y salida) en días laborables y feriados excluidos. Horas extra desde marcación con recargos legales: diurna +25%, nocturna +50%, máx. 3 h/día y 9 h/semana.'}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1, borderTop: `1px solid ${COLORS.borderSubtle}` }}>
          <Button onClick={handleCloseForm} disabled={saving} sx={{ color: COLORS.textSecondary }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !canSubmit}>
            {saving
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} sx={{ color: COLORS.white }} />
                  <span>{saveProgress.total > 1 ? `${saveProgress.current}/${saveProgress.total}` : 'Generando…'}</span>
                </Box>
              : isDecimoMode
                ? `Generar décimo (${targetCount})`
                : `Generar ${targetCount} nómina${targetCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
