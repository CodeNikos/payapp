import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Tooltip, IconButton, Checkbox, InputAdornment,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, CheckCircleOutlined, ReceiptLongOutlined,
  BusinessOutlined, GroupsOutlined, SearchOutlined,
  DeleteOutlined, CancelOutlined,
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
  period_start: '',
  period_end: '',
  overtime_hours: '0',
  bonuses: '0',
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

  const targetCount = scopeMode === 'company' ? activeEmployees.length : selectedIds.length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pr, er] = await Promise.all([payrollApi.list(), employeesApi.list({ limit: 200 })])
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

  const handleCreate = async () => {
    const targetIds = scopeMode === 'company'
      ? activeEmployees.map(e => e.id)
      : selectedIds

    if (!form.period_start || !form.period_end) {
      setError('Indica el período de la nómina')
      return
    }
    if (form.period_end < form.period_start) {
      setError('La fecha de fin debe ser posterior al inicio del período')
      return
    }
    if (targetIds.length === 0) {
      setError(scopeMode === 'company'
        ? 'No hay empleados activos para generar nómina'
        : 'Selecciona al menos un empleado')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')
    setSaveProgress({ current: 0, total: targetIds.length })

    const basePayload = {
      period_start: form.period_start,
      period_end: form.period_end,
      overtime_hours: parseFloat(form.overtime_hours) || 0,
      bonuses: parseFloat(form.bonuses) || 0,
      other_deductions: parseFloat(form.other_deductions) || 0,
      notes: form.notes || undefined,
    }

    const failures = []
    let created = 0

    for (let i = 0; i < targetIds.length; i++) {
      const employee_id = targetIds[i]
      setSaveProgress({ current: i + 1, total: targetIds.length })
      try {
        await payrollApi.create({ ...basePayload, employee_id })
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
      setSuccessMsg(`Nómina generada para ${created} empleado${created !== 1 ? 's' : ''}`)
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
  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const canSubmit = form.period_start && form.period_end && targetCount > 0

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Nóminas</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>{payrolls.length} registros</Typography>
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

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['ID', 'Empleado', 'Período', '$/h ordin.', 'Salario Bruto', 'Deducciones', 'Salario Neto', 'Estado', 'Acciones'].map(h => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: COLORS.accent }} />
                </TableCell>
              </TableRow>
            ) : payrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6 }}>
                  <ReceiptLongOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin nóminas generadas</Typography>
                </TableCell>
              </TableRow>
            ) : payrolls.map((p) => {
              const emp = employees.find(e => e.id === p.employee_id)
              const hourlyRate = getHourlyRate(emp)
              const overtimeRate = getOvertimeHourlyRate(emp)
              const overtimeHours = parseFloat(p.overtime_hours) || 0
              const hasOvertime = overtimeHours > 0
              const isRejected = p.status === 'anulado'
              const canApprove = p.status === 'borrador' && user?.role === 'admin'
              const canReject = ['borrador', 'procesado'].includes(p.status) && user?.role === 'admin'
              const canDelete = p.status === 'borrador'
              const hasActions = canApprove || canReject || canDelete

              return (
                <TableRow
                  key={p.id}
                  sx={{
                    opacity: isRejected ? 0.65 : 1,
                    bgcolor: isRejected ? alpha(COLORS.error, 0.03) : 'transparent',
                  }}
                >
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.textMuted }}>#{p.id}</TableCell>
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
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', color: COLORS.error }}>
                    <Tooltip title={
                      <Box sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                        <div>SS (9.75%): {fmt(p.social_security)}</div>
                        <div>Seg. educativo (1.25%): {fmt(p.educational_insurance ?? 0)}</div>
                        <div>ISR: {fmt(p.income_tax)}</div>
                        {parseFloat(p.other_deductions) > 0 && (
                          <div>Otras deducciones: {fmt(p.other_deductions)}</div>
                        )}
                      </Box>
                    }>
                      <span>{fmt(p.total_deductions)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', fontWeight: 700, color: isRejected ? COLORS.textMuted : COLORS.success }}>
                    {fmt(p.net_salary)}
                  </TableCell>
                  <TableCell>
                    <Chip label={statusLabel[p.status] || p.status} size="small" color={statusColor[p.status] || 'default'} />
                  </TableCell>
                  <TableCell>
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
            Período y cálculo
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Inicio período" type="date" value={form.period_start}
                onChange={e => field('period_start', e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Fin período" type="date" value={form.period_end}
                onChange={e => field('period_end', e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Horas extra (confianza)" type="number" value={form.overtime_hours}
                onChange={e => field('overtime_hours', e.target.value)} inputProps={{ min: 0, step: 0.5 }}
                helperText="Solo personal de confianza. Demás: desde marcación (+25% diurno)" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Bonificaciones" type="number" value={form.bonuses}
                onChange={e => field('bonuses', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Otras deducciones" type="number" value={form.other_deductions}
                onChange={e => field('other_deductions', e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notas (opcional)" value={form.notes}
                onChange={e => field('notes', e.target.value)} multiline rows={2} />
            </Grid>
          </Grid>

          <Typography sx={{ mt: 2, fontSize: '0.75rem', color: COLORS.textMuted }}>
            El salario base se prorratea según los días del período. Para empleados sin personal de confianza,
            se validan marcaciones completas (entrada y salida) en días laborables y feriados excluidos.
            Horas extra desde marcación con recargos legales: diurna +25%, nocturna +50%, máx. 3 h/día y 9 h/semana.
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
              : `Generar ${targetCount} nómina${targetCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
