import { useEffect, useState } from 'react'
import { Box, TextField, MenuItem } from '@mui/material'
import { companiesApi } from '../../services/api'
import {
  COMPANY_ALL,
  COMPANY_NONE,
  useCompanyFilterStore,
} from '../../context/companyFilterStore'

/**
 * Selector de empresa para barras de filtro.
 * Persiste la selección entre páginas vía companyFilterStore.
 */
export default function CompanyFilterSelect({
  size = 'small',
  sx = {},
  label = 'Empresa',
  includeNone = true,
  fullWidth = false,
}) {
  const selectedCompanyCode = useCompanyFilterStore((s) => s.selectedCompanyCode)
  const setSelectedCompanyCode = useCompanyFilterStore((s) => s.setSelectedCompanyCode)
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    let cancelled = false
    companiesApi.list({ status: 'activo', limit: 200 })
      .then((res) => {
        if (!cancelled) setCompanies(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
    return () => { cancelled = true }
  }, [])

  return (
    <TextField
      select
      size={size}
      label={label}
      value={selectedCompanyCode || COMPANY_ALL}
      onChange={(e) => setSelectedCompanyCode(e.target.value)}
      fullWidth={fullWidth}
      sx={{ minWidth: 200, ...sx }}
    >
      <MenuItem value={COMPANY_ALL}>Todas las empresas</MenuItem>
      {includeNone && (
        <MenuItem value={COMPANY_NONE}>Sin empresa</MenuItem>
      )}
      {companies.map((c) => (
        <MenuItem key={c.company_code} value={c.company_code}>
          {c.company_code} · {c.commercial_name}
        </MenuItem>
      ))}
    </TextField>
  )
}

/** Helper opcional para agrupar con otros filtros */
export function CompanyFilterBar({ children, sx = {} }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', ...sx }}>
      <CompanyFilterSelect />
      {children}
    </Box>
  )
}
