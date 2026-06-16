import axios from 'axios'
import { useAuthStore } from '../context/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const store = useAuthStore.getState()

    const status = error.response?.status
    const detail = error.response?.data?.detail
    const isAuthError = status === 401 || (status === 403 && detail === 'Not authenticated')

    if (isAuthError && !original._retry && store.refreshToken) {
      original._retry = true
      try {
        const res = await axios.post('/api/v1/auth/refresh', {
          refresh_token: store.refreshToken,
        })
        const { access_token, refresh_token, user } = res.data
        store.setTokens(access_token, refresh_token)
        store.setUser(user)
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch {
        store.logout()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// Extracts a displayable string from FastAPI errors (string detail or 422 array)
export function getApiError(e, fallback = 'Error desconocido') {
  const detail = e.response?.data?.detail
  if (!detail) return fallback
  if (Array.isArray(detail)) {
    return detail.map(d => (d.msg || '').replace(/^Value error,\s*/i, '')).join(' · ')
  }
  return String(detail)
}

export default api

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
}

export const employeesApi = {
  list: (params) => api.get('/employees/', { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees/', data),
  update: (id, data) => api.patch(`/employees/${id}`, data),
  deactivate: (id) => api.delete(`/employees/${id}`),
}

export const payrollApi = {
  list: (params) => api.get('/payroll/', { params }),
  create: (data) => api.post('/payroll/', data),
  approve: (id) => api.patch(`/payroll/${id}/approve`),
  reject: (id, reason) => api.patch(`/payroll/${id}/reject`, { reason }),
  remove: (id) => api.delete(`/payroll/${id}`),
}

export const usersApi = {
  list: () => api.get('/users/'),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
}

export const holidaysApi = {
  list: (params) => api.get('/holidays/', { params }),
  listYears: () => api.get('/holidays/years'),
  get: (id) => api.get(`/holidays/${id}`),
  create: (data) => api.post('/holidays/', data),
  update: (id, data) => api.patch(`/holidays/${id}`, data),
  remove: (id) => api.delete(`/holidays/${id}`),
  importCsv: (file, params) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/holidays/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    })
  },
}

export const timesheetsApi = {
  list: (params) => api.get('/timesheets/', { params }),
  bulkUpsert: (data) => api.put('/timesheets/bulk', data),
  validate: (params) => api.get('/timesheets/validate', { params }),
}
