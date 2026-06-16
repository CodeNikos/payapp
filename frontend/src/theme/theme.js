import { createTheme, alpha } from '@mui/material/styles'

/** Paleta corporativa PayApp */
export const PALETTE = {
  petroleo: '#163447',
  grafito: '#2B2F33',
  adminWhite: '#F7F8FA',
  acero: '#66707A',
  validacion: '#2E7D5A',
  control: '#B54545',
}

export const COLORS = {
  // ── Marca — Azul petróleo oscuro ────────────────────────────────────────
  brand: PALETTE.petroleo,
  brandHover: '#1E4058',
  brandDark: '#0F2532',
  brandMuted: alpha(PALETTE.petroleo, 0.1),

  // Alias usados en componentes existentes
  black: PALETTE.petroleo,
  darkSurface: PALETTE.petroleo,
  accent: PALETTE.petroleo,
  accentHover: '#1E4058',
  accentMuted: alpha(PALETTE.petroleo, 0.1),

  // ── Sidebar / superficies oscuras ───────────────────────────────────────
  sidebarBorder: alpha(PALETTE.acero, 0.35),
  textOnDark: PALETTE.adminWhite,
  textSecondaryOnDark: alpha(PALETTE.adminWhite, 0.72),
  textMutedOnDark: alpha(PALETTE.acero, 0.85),

  // ── Contenido — Blanco administrativo + Gris grafito ────────────────────
  pageBg: PALETTE.adminWhite,
  cardBg: '#FFFFFF',
  inputBg: PALETTE.adminWhite,
  borderSubtle: alpha(PALETTE.acero, 0.28),
  textPrimary: PALETTE.grafito,
  textSecondary: PALETTE.acero,
  textMuted: alpha(PALETTE.acero, 0.72),

  // ── Estados ─────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  error: PALETTE.control,
  success: PALETTE.validacion,
  warning: '#8A7344',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: COLORS.brand,
      light: '#1E4058',
      dark: COLORS.brandDark,
      contrastText: COLORS.white,
    },
    secondary: {
      main: COLORS.textPrimary,
      contrastText: COLORS.textOnDark,
    },
    background: {
      default: COLORS.pageBg,
      paper: COLORS.cardBg,
    },
    text: {
      primary: COLORS.textPrimary,
      secondary: COLORS.textSecondary,
    },
    error:   { main: COLORS.error },
    success: { main: COLORS.success },
    warning: { main: COLORS.warning },
    divider: COLORS.borderSubtle,
  },
  typography: {
    fontFamily: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.03em', color: COLORS.textPrimary },
    h2: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.02em', color: COLORS.textPrimary },
    h3: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 600, letterSpacing: '-0.02em', color: COLORS.textPrimary },
    h4: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 600, letterSpacing: '-0.015em', color: COLORS.textPrimary },
    h5: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 600, color: COLORS.textPrimary },
    h6: { fontFamily: '"Syne", "DM Sans", sans-serif', fontWeight: 600, color: COLORS.textPrimary },
    body1: { fontFamily: '"DM Sans", sans-serif', fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontFamily: '"DM Sans", sans-serif', fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', letterSpacing: '0.04em' },
    overline: { fontFamily: '"DM Mono", monospace', fontSize: '0.6875rem', letterSpacing: '0.1em' },
    button: { fontFamily: '"DM Sans", sans-serif', fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background-color: ${COLORS.pageBg}; color: ${COLORS.textPrimary}; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${alpha(COLORS.textSecondary, 0.12)}; }
        ::-webkit-scrollbar-thumb { background: ${alpha(COLORS.textSecondary, 0.35)}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${alpha(COLORS.textSecondary, 0.55)}; }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          letterSpacing: '0.01em',
          transition: 'all 0.2s ease',
        },
        contained: {
          backgroundColor: COLORS.brand,
          color: COLORS.white,
          boxShadow: `0 2px 8px ${alpha(COLORS.brand, 0.28)}`,
          '&:hover': {
            backgroundColor: COLORS.brandHover,
            transform: 'translateY(-1px)',
            boxShadow: `0 4px 16px ${alpha(COLORS.brand, 0.38)}`,
          },
        },
        outlined: {
          borderColor: COLORS.borderSubtle,
          color: COLORS.textPrimary,
          '&:hover': { borderColor: COLORS.brand, backgroundColor: COLORS.brandMuted },
        },
        text: {
          color: COLORS.textSecondary,
          '&:hover': { color: COLORS.textPrimary, backgroundColor: alpha(COLORS.textPrimary, 0.04) },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: COLORS.cardBg,
          border: `1px solid ${COLORS.borderSubtle}`,
          borderRadius: 16,
          backgroundImage: 'none',
          boxShadow: '0 1px 6px rgba(22, 52, 71, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: COLORS.cardBg,
          border: `1px solid ${COLORS.borderSubtle}`,
          boxShadow: '0 1px 6px rgba(22, 52, 71, 0.05)',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: COLORS.inputBg,
            borderRadius: 8,
            '& fieldset': { borderColor: COLORS.borderSubtle },
            '&:hover fieldset': { borderColor: alpha(COLORS.brand, 0.45) },
            '&.Mui-focused fieldset': { borderColor: COLORS.brand },
          },
          '& .MuiInputLabel-root': { color: COLORS.textSecondary },
          '& .MuiInputLabel-root.Mui-focused': { color: COLORS.brand },
          '& .MuiInputBase-input': { color: COLORS.textPrimary },
          '& .MuiFormHelperText-root': { color: COLORS.textMuted },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: COLORS.textMuted },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: COLORS.textPrimary,
          '&.Mui-selected': { backgroundColor: COLORS.brandMuted },
          '&:hover': { backgroundColor: alpha(COLORS.brand, 0.05) },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontFamily: '"DM Mono", monospace', fontSize: '0.7rem', fontWeight: 500 },
        colorDefault: { backgroundColor: alpha(COLORS.textSecondary, 0.1), color: COLORS.textPrimary },
        colorSuccess: { backgroundColor: alpha(COLORS.success, 0.12), color: COLORS.success },
        colorError:   { backgroundColor: alpha(COLORS.error, 0.1),   color: COLORS.error },
        colorWarning: { backgroundColor: alpha(COLORS.warning, 0.12), color: COLORS.warning },
        colorPrimary: { backgroundColor: COLORS.brandMuted, color: COLORS.brand },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: COLORS.brand,
          borderRight: `1px solid ${COLORS.sidebarBorder}`,
          backgroundImage: 'none',
          boxShadow: '2px 0 12px rgba(15, 37, 50, 0.18)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: COLORS.borderSubtle } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: alpha(COLORS.textSecondary, 0.08),
            color: COLORS.textPrimary,
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${COLORS.borderSubtle}`,
          },
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          '& .MuiTableRow-root': {
            transition: 'background-color 0.15s ease',
            '&:hover': { backgroundColor: alpha(COLORS.brand, 0.03) },
          },
          '& .MuiTableCell-root': {
            borderBottom: `1px solid ${COLORS.borderSubtle}`,
            color: COLORS.textPrimary,
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { backgroundColor: COLORS.cardBg },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: COLORS.textPrimary,
          color: COLORS.textOnDark,
          fontSize: '0.8rem',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(43, 47, 51, 0.2)',
        },
        arrow: { color: COLORS.textPrimary },
      },
    },
    MuiAlert: {
      defaultProps: {
        variant: 'standard',
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid',
          padding: '10px 14px',
          fontSize: '0.8125rem',
          lineHeight: 1.55,
          boxShadow: '0 1px 4px rgba(22, 52, 71, 0.04)',
          '& .MuiAlert-message': {
            padding: '2px 0',
            color: COLORS.textPrimary,
            width: '100%',
          },
          '& .MuiAlert-icon': {
            padding: '2px 0',
            marginRight: 10,
            opacity: 1,
          },
          '& .MuiAlert-action': {
            paddingTop: 0,
            marginRight: -4,
            '& .MuiIconButton-root': {
              color: COLORS.textMuted,
              padding: 4,
              '&:hover': { color: COLORS.textPrimary, backgroundColor: alpha(COLORS.textPrimary, 0.06) },
            },
          },
        },
        standardError: {
          backgroundColor: alpha(COLORS.error, 0.07),
          borderColor: alpha(COLORS.error, 0.22),
          '& .MuiAlert-icon': { color: COLORS.error },
        },
        standardSuccess: {
          backgroundColor: alpha(COLORS.success, 0.07),
          borderColor: alpha(COLORS.success, 0.22),
          '& .MuiAlert-icon': { color: COLORS.success },
        },
        standardWarning: {
          backgroundColor: alpha(COLORS.warning, 0.08),
          borderColor: alpha(COLORS.warning, 0.22),
          '& .MuiAlert-icon': { color: COLORS.warning },
        },
        standardInfo: {
          backgroundColor: alpha(COLORS.brand, 0.06),
          borderColor: alpha(COLORS.brand, 0.2),
          '& .MuiAlert-icon': { color: COLORS.brand },
        },
      },
    },
    MuiAlertTitle: {
      styleOverrides: {
        root: {
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '0.875rem',
          marginBottom: 2,
          color: COLORS.textPrimary,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: alpha(COLORS.brand, 0.12) },
        bar:  { borderRadius: 4, backgroundColor: COLORS.brand },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          transition: 'all 0.15s ease',
          '&:hover': { backgroundColor: alpha(COLORS.white, 0.08) },
          '&.Mui-selected': {
            backgroundColor: alpha(COLORS.white, 0.14),
            '&:hover': { backgroundColor: alpha(COLORS.white, 0.2) },
            '& .MuiListItemIcon-root': { color: COLORS.textOnDark },
            '& .MuiListItemText-primary': { color: COLORS.textOnDark, fontWeight: 600 },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: COLORS.cardBg,
          border: `1px solid ${COLORS.borderSubtle}`,
          boxShadow: '0 20px 60px rgba(22, 52, 71, 0.12)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { color: COLORS.textPrimary } },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: COLORS.textSecondary },
      },
    },
  },
})
