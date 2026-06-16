import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  InputAdornment, MenuItem, CircularProgress, Tooltip, Switch,
} from '@mui/material'
import AppAlert from '../components/common/AppAlert'
import {
  AddOutlined, SearchOutlined, PersonOffOutlined, PeopleOutlined, EditOutlined,
} from '@mui/icons-material'
import { employeesApi, getApiError } from '../services/api'
import { COLORS } from '../theme/theme'
import { alpha } from '@mui/material/styles'

const CONTRACT_TYPES = ['indefinido', 'temporal', 'obra_labor']
const DEPARTMENTS = ['Administración', 'Ventas', 'Operaciones', 'Tecnología', 'RRHH', 'Finanzas', 'Producción']
const STATUSES = ['activo', 'inactivo', 'suspendido']

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
  hire_date: '', contract_type: 'indefinido', status: 'activo',
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
  }
}

function EmployeeFormFields({ form, field, editing }) {
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
    </Grid>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [openForm, setOpenForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await employeesApi.list({ search: search || undefined, limit: 200 })
      setEmployees(res.data)
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
        const { status, ...createPayload } = payload
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

  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: COLORS.textPrimary, mb: 0.5 }}>Empleados</Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>{employees.length} empleados registrados</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenCreate} size="small">
          Nuevo empleado
        </Button>
      </Box>

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
              {['Código', 'Nombre', 'Cédula', 'Cargo', 'Departamento', 'Salario Base', 'Horas/sem', 'Contrato', 'Estado', 'Acciones'].map(h => (
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
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <PeopleOutlined sx={{ fontSize: 40, color: COLORS.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography variant="body2" sx={{ color: COLORS.textMuted }}>Sin empleados registrados</Typography>
                </TableCell>
              </TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell sx={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: COLORS.accent }}>
                  {emp.employee_code}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</TableCell>
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
                  <Chip label={emp.status} size="small" color={statusColor[emp.status] || 'default'} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenEdit(emp)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.brand } }}>
                        <EditOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Desactivar">
                      <IconButton size="small" onClick={() => handleDeactivate(emp.id)}
                        sx={{ color: COLORS.textMuted, '&:hover': { color: COLORS.error } }}>
                        <PersonOffOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
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
          <EmployeeFormFields form={form} field={field} editing={editing} />
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
    </Box>
  )
}
