import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Valor especial: empleados sin empresa asignada */
export const COMPANY_NONE = '__none__'
/** Valor vacío / all: todas las empresas */
export const COMPANY_ALL = ''

export const useCompanyFilterStore = create(
  persist(
    (set, get) => ({
      selectedCompanyCode: COMPANY_ALL,
      setSelectedCompanyCode: (code) =>
        set({ selectedCompanyCode: code == null ? COMPANY_ALL : String(code) }),
      /** Params listos para enviar a la API (omitir si es "todas") */
      companyQueryParam: () => {
        const code = get().selectedCompanyCode
        if (!code || code === COMPANY_ALL) return undefined
        return code
      },
    }),
    {
      name: 'payapp-company-filter',
      partialize: (state) => ({
        selectedCompanyCode: state.selectedCompanyCode,
      }),
    },
  ),
)
