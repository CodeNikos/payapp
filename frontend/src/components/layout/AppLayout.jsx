import { useState } from 'react'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, IconButton, Tooltip,
  useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material'
import {
  DashboardOutlined, PeopleOutlined, ReceiptLongOutlined,
  PersonOutlined, Menu as MenuIcon, LogoutOutlined,
  LockOutlined, ChevronLeft, EventOutlined, ScheduleOutlined,
} from '@mui/icons-material'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../context/authStore'
import { COLORS } from '../../theme/theme'
import { alpha } from '@mui/material/styles'

const DRAWER_WIDTH = 240
const DRAWER_COLLAPSED = 68

const navItems = [
  { label: 'Dashboard',  icon: <DashboardOutlined />,    path: '/dashboard' },
  { label: 'Empleados',  icon: <PeopleOutlined />,        path: '/employees' },
  { label: 'Nóminas',    icon: <ReceiptLongOutlined />,   path: '/payroll' },
  { label: 'Marcación',  icon: <ScheduleOutlined />,      path: '/timesheets' },
  { label: 'Días feriados', icon: <EventOutlined />,      path: '/holidays', adminOnly: true },
  { label: 'Usuarios',   icon: <PersonOutlined />,        path: '/users', adminOnly: true },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const muiTheme = useMuiTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const drawerWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filtered = navItems.filter(item => !item.adminOnly || user?.role === 'admin')

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: 64,
      }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: '8px',
              background: alpha(COLORS.white, 0.14),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <LockOutlined sx={{ color: COLORS.white, fontSize: 15 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '1rem', color: COLORS.textOnDark }}>
              PayApp
            </Typography>
          </Box>
        )}
        {collapsed && (
          <Box sx={{ width: 30, height: 30, borderRadius: '8px', background: alpha(COLORS.white, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockOutlined sx={{ color: COLORS.white, fontSize: 15 }} />
          </Box>
        )}
        {!isMobile && (
          <IconButton size="small" onClick={() => setCollapsed(!collapsed)}
            sx={{ color: COLORS.textMutedOnDark, '&:hover': { color: COLORS.textOnDark } }}>
            {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeft fontSize="small" />}
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: COLORS.sidebarBorder }} />

      {/* Nav items */}
      <List sx={{ flex: 1, pt: 1, px: 0 }}>
        {filtered.map((item) => {
          const active = location.pathname.startsWith(item.path)
          return (
            <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                selected={active}
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false) }}
                sx={{ mx: 1, px: collapsed ? 1 : 1.5, py: 1, justifyContent: collapsed ? 'center' : 'flex-start', minHeight: 42 }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: active ? COLORS.textOnDark : COLORS.textSecondaryOnDark }}>
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: active ? 600 : 400,
                      color: active ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>

      <Divider sx={{ borderColor: COLORS.sidebarBorder }} />

      {/* User info */}
      <Box sx={{ p: 1.5 }}>
        {!collapsed ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, background: COLORS.brandDark }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(COLORS.white, 0.18), color: COLORS.textOnDark, fontSize: '0.85rem', fontWeight: 700 }}>
              {user?.full_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', color: COLORS.textOnDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </Typography>
              <Typography variant="caption" sx={{ color: COLORS.textMutedOnDark, fontSize: '0.7rem', textTransform: 'capitalize' }}>
                {user?.role?.replace('_', ' ')}
              </Typography>
            </Box>
            <Tooltip title="Cerrar sesión">
              <IconButton size="small" onClick={handleLogout}
                sx={{ color: COLORS.textMutedOnDark, '&:hover': { color: COLORS.error } }}>
                <LogoutOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 30, height: 30, bgcolor: alpha(COLORS.white, 0.18), color: COLORS.textOnDark, fontSize: '0.8rem', fontWeight: 700 }}>
              {user?.full_name?.[0]?.toUpperCase()}
            </Avatar>
            <Tooltip title="Cerrar sesión" placement="right">
              <IconButton size="small" onClick={handleLogout}
                sx={{ color: COLORS.textMutedOnDark, '&:hover': { color: COLORS.error } }}>
                <LogoutOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: COLORS.pageBg }}>
      {/* Mobile toggle button */}
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1300 }}>
          <IconButton
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ color: COLORS.textPrimary, bgcolor: COLORS.cardBg, border: `1px solid ${COLORS.borderSubtle}` }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: 'width 0.2s ease',
            '& .MuiDrawer-paper': { width: drawerWidth, overflowX: 'hidden', transition: 'width 0.2s ease' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {drawerContent}
        </Drawer>
      )}

      {/* Main content area */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 }, pt: { xs: 7, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
