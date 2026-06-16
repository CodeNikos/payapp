import { Alert, AlertTitle } from '@mui/material'
import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material'
import { COLORS } from '../../theme/theme'

const ICONS = {
  success: CheckCircleOutline,
  error: ErrorOutline,
  warning: WarningAmberOutlined,
  info: InfoOutlined,
}

const TITLES = {
  success: 'Operación exitosa',
  error: 'Error',
  warning: 'Atención',
  info: 'Información',
}

/**
 * Mensaje informativo estándar de PayApp.
 * Usar siempre este componente en lugar de Alert directo.
 */
export default function AppAlert({
  severity = 'info',
  title,
  showTitle = false,
  onClose,
  variant = 'inline',
  sx,
  children,
  ...props
}) {
  if (!children) return null

  const Icon = ICONS[severity] || InfoOutlined
  const resolvedTitle = title ?? (showTitle ? TITLES[severity] : null)

  return (
    <Alert
      severity={severity}
      icon={<Icon sx={{ fontSize: 20 }} />}
      onClose={onClose}
      variant="standard"
      sx={{
        mb: variant === 'banner' ? 2.5 : 2,
        alignItems: resolvedTitle ? 'flex-start' : 'center',
        ...(variant === 'banner' && { borderRadius: 2 }),
        ...sx,
      }}
      {...props}
    >
      {resolvedTitle && (
        <AlertTitle sx={{ mb: children ? 0.35 : 0, fontWeight: 600, fontSize: '0.875rem', color: COLORS.textPrimary }}>
          {resolvedTitle}
        </AlertTitle>
      )}
      {children}
    </Alert>
  )
}
