import { useState, useEffect } from 'react'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, IconButton, Tooltip, Collapse,
  useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material'
import {
  DashboardOutlined, PeopleOutlined, ReceiptLongOutlined,
  PersonOutlined, Menu as MenuIcon, LogoutOutlined,
  LockOutlined, ChevronLeft, EventOutlined, ScheduleOutlined, AssessmentOutlined,
  BusinessOutlined, SettingsOutlined, ExpandLess, ExpandMore, EventBusyOutlined,
} from '@mui/icons-material'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../context/authStore'
import { COLORS } from '../../theme/theme'
import { alpha } from '@mui/material/styles'

const DRAWER_WIDTH = 240
const DRAWER_COLLAPSED = 68

const navItems = [
  { label: 'Dashboard',  icon: <DashboardOutlined />,  path: '/dashboard' },
  { label: 'Empleados',  icon: <PeopleOutlined />,     path: '/employees' },
  { label: 'Nóminas',    icon: <ReceiptLongOutlined />, path: '/payroll' },
  { label: 'Marcación',  icon: <ScheduleOutlined />,   path: '/timesheets' },
  { label: 'Ausencias',  icon: <EventBusyOutlined />,  path: '/absences', adminOnly: true },
  { label: 'Reportería', icon: <AssessmentOutlined />, path: '/reports' },
  {
    label: 'Configuración',
    icon: <SettingsOutlined />,
    adminOnly: true,
    children: [
      { label: 'Empresas',      icon: <BusinessOutlined />, path: '/companies' },
      { label: 'Días feriados', icon: <EventOutlined />,    path: '/holidays' },
      { label: 'Usuarios',      icon: <PersonOutlined />,   path: '/users' },
    ],
  },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const muiTheme = useMuiTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const drawerWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH
  const isAdmin = user?.role === 'admin'

  const configPaths = ['/companies', '/holidays', '/users']
  const configActive = configPaths.some(p => location.pathname.startsWith(p))

  useEffect(() => {
    if (configActive) setConfigOpen(true)
  }, [configActive])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const goTo = (path) => {
    navigate(path)
    if (isMobile) setMobileOpen(false)
  }

  const filtered = navItems.filter(item => !item.adminOnly || isAdmin)

  const renderNavItem = (item) => {
    if (item.children) {
      const childActive = item.children.some(c => location.pathname.startsWith(c.path))
      return (
        <Box key={item.label}>
          <Tooltip title={collapsed ? item.label : ''} placement="right">
            <ListItemButton
              selected={childActive && collapsed}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false)
                  setConfigOpen(true)
                  return
                }
                setConfigOpen(prev => !prev)
              }}
              sx={{
                mx: 1,
                px: collapsed ? 1 : 1.5,
                py: 1,
                justifyContent: collapsed ? 'center' : 'flex-start',
                minHeight: 42,
              }}
            >
              <ListItemIcon sx={{
                minWidth: collapsed ? 0 : 36,
                color: childActive ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
              }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: childActive ? 600 : 400,
                      color: childActive ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
                    }}
                  />
                  {configOpen
                    ? <ExpandLess sx={{ color: COLORS.textMutedOnDark, fontSize: 18 }} />
                    : <ExpandMore sx={{ color: COLORS.textMutedOnDark, fontSize: 18 }} />}
                </>
              )}
            </ListItemButton>
          </Tooltip>
          {!collapsed && (
            <Collapse in={configOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {item.children.map((child) => {
                  const active = location.pathname.startsWith(child.path)
                  return (
                    <ListItemButton
                      key={child.path}
                      selected={active}
                      onClick={() => goTo(child.path)}
                      sx={{
                        mx: 1,
                        ml: 2,
                        px: 1.5,
                        py: 0.85,
                        minHeight: 38,
                        borderRadius: 2,
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: 32,
                        color: active ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
                      }}>
                        {child.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={child.label}
                        primaryTypographyProps={{
                          fontSize: '0.82rem',
                          fontWeight: active ? 600 : 400,
                          color: active ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
                        }}
                      />
                    </ListItemButton>
                  )
                })}
              </List>
            </Collapse>
          )}
        </Box>
      )
    }

    const active = location.pathname.startsWith(item.path)
    return (
      <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right">
        <ListItemButton
          selected={active}
          onClick={() => goTo(item.path)}
          sx={{
            mx: 1,
            px: collapsed ? 1 : 1.5,
            py: 1,
            justifyContent: collapsed ? 'center' : 'flex-start',
            minHeight: 42,
          }}
        >
          <ListItemIcon sx={{
            minWidth: collapsed ? 0 : 36,
            color: active ? COLORS.textOnDark : COLORS.textSecondaryOnDark,
          }}>
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
  }

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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

      <List sx={{ flex: 1, pt: 1, px: 0 }}>
        {filtered.map(renderNavItem)}
      </List>

      <Divider sx={{ borderColor: COLORS.sidebarBorder }} />

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

      {isMobile && (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {drawerContent}
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 }, pt: { xs: 7, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
