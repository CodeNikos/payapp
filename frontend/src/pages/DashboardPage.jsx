import { useEffect, useState } from 'react'
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  LinearProgress, Skeleton, useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material'
import {
  PeopleOutlined, ReceiptLongOutlined, AttachMoneyOutlined,
  TrendingUpOutlined, ArrowUpwardRounded,
} from '@mui/icons-material'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import { alpha } from '@mui/material/styles'
import { useAuthStore } from '../context/authStore'
import { employeesApi, payrollApi } from '../services/api'
import { COLORS } from '../theme/theme'

const mockChartData = [
  { month: 'Ene', nomina: 45000 },
  { month: 'Feb', nomina: 47200 },
  { month: 'Mar', nomina: 46800 },
  { month: 'Abr', nomina: 49100 },
  { month: 'May', nomina: 51300 },
  { month: 'Jun', nomina: 50900 },
  { month: 'Jul', nomina: 53200 },
]

function StatCard({ title, value, subtitle, icon, teal, trend, progress }) {
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {teal && (
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          bgcolor: COLORS.accent,
        }} />
      )}
      <CardContent sx={{ p: { xs: 1.75, sm: 2.5 }, pt: teal ? { xs: 2.25, sm: 3 } : undefined }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2 } }}>
          <Box sx={{
            width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: '10px',
            background: teal ? COLORS.accentMuted : alpha(COLORS.textSecondary, 0.09),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: teal ? COLORS.accent : COLORS.textSecondary,
            flexShrink: 0,
          }}>
            {icon}
          </Box>
          {trend && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.25,
              bgcolor: alpha(COLORS.success, 0.12), px: 0.75, py: 0.25, borderRadius: 10,
            }}>
              <ArrowUpwardRounded sx={{ fontSize: '0.65rem', color: COLORS.success }} />
              <Typography sx={{ color: COLORS.success, fontFamily: '"DM Mono", monospace', fontSize: '0.68rem', fontWeight: 600 }}>
                {trend}
              </Typography>
            </Box>
          )}
        </Box>

        <Typography sx={{
          color: COLORS.textPrimary,
          fontFamily: '"Syne", sans-serif',
          fontWeight: 700,
          fontSize: { xs: '1.35rem', sm: '1.65rem', md: '1.85rem' },
          lineHeight: 1.1,
          mb: 0.5,
          wordBreak: 'break-all',
        }}>
          {value}
        </Typography>

        <Typography sx={{
          color: COLORS.textSecondary,
          fontSize: '0.65rem',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          fontFamily: '"DM Mono", monospace',
          mb: 0.5,
        }}>
          {title}
        </Typography>

        <Typography sx={{ color: COLORS.textMuted, fontSize: { xs: '0.72rem', sm: '0.78rem' }, lineHeight: 1.4 }}>
          {subtitle}
        </Typography>

        {progress !== undefined && (
          <Box sx={{ mt: { xs: 1.25, sm: 1.75 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ color: COLORS.textMuted, fontFamily: '"DM Mono", monospace', fontSize: '0.62rem' }}>
                Ocupación
              </Typography>
              <Typography sx={{ color: COLORS.accent, fontFamily: '"DM Mono", monospace', fontSize: '0.62rem', fontWeight: 600 }}>
                {progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 4, borderRadius: 2 }} />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{
      bgcolor: COLORS.cardBg,
      border: `1px solid ${COLORS.borderSubtle}`,
      borderRadius: 2,
      p: 1.5,
      boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
    }}>
      <Typography variant="caption" sx={{ color: COLORS.textSecondary, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ color: COLORS.accent, fontFamily: '"DM Mono", monospace', fontWeight: 700, fontSize: '0.9rem' }}>
        ${payload[0].value.toLocaleString('es-PA')}
      </Typography>
    </Box>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const muiTheme = useMuiTheme()
  const isMobile  = useMediaQuery(muiTheme.breakpoints.down('sm'))
  const isTablet  = useMediaQuery(muiTheme.breakpoints.down('md'))
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ employees: 0, payrolls: 0, totalNomina: 0 })

  useEffect(() => {
    const load = async () => {
      try {
        const [empRes, payRes] = await Promise.all([
          employeesApi.list({ limit: 200 }),
          payrollApi.list({ limit: 200 }),
        ])
        const payrolls = payRes.data || []
        const total = payrolls.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0)
        setStats({ employees: empRes.data?.length || 0, payrolls: payrolls.length, totalNomina: total })
      } catch { /* use defaults */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const cards = [
    {
      title: 'Empleados activos',
      value: loading ? '—' : stats.employees,
      subtitle: 'En nómina actualmente',
      icon: <PeopleOutlined sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      teal: true,
      progress: 82,
    },
    {
      title: 'Nóminas generadas',
      value: loading ? '—' : stats.payrolls,
      subtitle: 'Período actual',
      icon: <ReceiptLongOutlined sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      trend: '+2',
    },
    {
      title: 'Total nómina',
      value: loading ? '—' : `$${stats.totalNomina.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`,
      subtitle: 'Salarios netos procesados',
      icon: <AttachMoneyOutlined sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      teal: true,
    },
    {
      title: 'Crecimiento',
      value: '+4.5%',
      subtitle: 'Respecto al mes anterior',
      icon: <TrendingUpOutlined sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      trend: '+4.5%',
    },
  ]

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'flex-end' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1.5, sm: 0 },
        mb: { xs: 3, sm: 4, md: 5 },
      }}>
        <Box>
          <Typography sx={{
            color: COLORS.textMuted,
            fontSize: '0.8rem',
            fontFamily: '"DM Mono", monospace',
            letterSpacing: '0.04em',
            mb: 0.5,
          }}>
            {greeting()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap' }}>
            <Typography variant="h3" sx={{
              color: COLORS.textPrimary,
              lineHeight: 1,
              fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' },
            }}>
              {user?.full_name?.split(' ')[0]}.
            </Typography>
            <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
              {new Date().toLocaleDateString('es-PA', {
                weekday: isMobile ? 'short' : 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Typography>
          </Box>
        </Box>

        {/* Status pill */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          bgcolor: alpha(COLORS.success, 0.1),
          border: `1px solid ${alpha(COLORS.success, 0.2)}`,
          px: 1.5, py: 0.6, borderRadius: 10,
          alignSelf: { xs: 'flex-start', sm: 'auto' },
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: COLORS.success }} />
          <Typography sx={{ color: COLORS.success, fontFamily: '"DM Mono", monospace', fontSize: '0.7rem' }}>
            Sistema activo
          </Typography>
        </Box>
      </Box>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5, md: 3 } }}>
        {cards.map((card, i) => (
          <Grid item xs={6} sm={6} lg={3} key={card.title}>
            {loading
              ? <Skeleton variant="rounded" height={isMobile ? 130 : 155} sx={{ borderRadius: 2 }} />
              : <StatCard {...card} />
            }
          </Grid>
        ))}
      </Grid>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Chart header */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 0 },
            mb: { xs: 2, sm: 3 },
          }}>
            <Box>
              <Typography variant="h6" sx={{
                color: COLORS.textPrimary,
                fontWeight: 600,
                fontSize: { xs: '0.95rem', sm: '1.05rem' },
                mb: 0.25,
              }}>
                Evolución de Nómina
              </Typography>
              <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
                Total mensual · 2025
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
              {/* Legend */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 24, height: 3, borderRadius: 2, bgcolor: COLORS.accent }} />
                <Typography sx={{ color: COLORS.textSecondary, fontFamily: '"DM Mono", monospace', fontSize: '0.7rem' }}>
                  Nómina
                </Typography>
              </Box>
              <Chip
                label="En vivo"
                size="small"
                color="success"
                sx={{ fontSize: '0.68rem', height: 22 }}
              />
            </Box>
          </Box>

          {/* Summary stat above chart */}
          {!loading && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2, mb: 2,
              p: { xs: 1.25, sm: 1.5 },
              bgcolor: COLORS.accentMuted,
              borderRadius: 2,
              border: `1px solid ${alpha(COLORS.accent, 0.2)}`,
            }}>
              <Box>
                <Typography sx={{ color: COLORS.textMuted, fontSize: '0.65rem', fontFamily: '"DM Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Último mes registrado
                </Typography>
                <Typography sx={{ color: COLORS.accent, fontFamily: '"DM Mono", monospace', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
                  $53,200
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArrowUpwardRounded sx={{ color: COLORS.success, fontSize: '0.9rem' }} />
                <Typography sx={{ color: COLORS.success, fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                  +4.3%
                </Typography>
              </Box>
            </Box>
          )}

          <ResponsiveContainer width="100%" height={isMobile ? 170 : isTablet ? 210 : 240}>
            <AreaChart data={mockChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="nomGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLORS.accent} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderSubtle} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: COLORS.textMuted, fontSize: isMobile ? 9 : 11, fontFamily: '"DM Mono", monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                hide={isMobile}
                tick={{ fill: COLORS.textMuted, fontSize: 10, fontFamily: '"DM Mono", monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <RechartsTooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="nomina"
                stroke={COLORS.accent}
                strokeWidth={2.5}
                fill="url(#nomGrad)"
                dot={false}
                activeDot={{ r: 5, fill: COLORS.accent, strokeWidth: 2, stroke: COLORS.cardBg }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
