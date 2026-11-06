export type User = { id: number; email: string; username: string }
export type Post = {
  id: number; title: string; body: string; author: User; created_at: string; updated_at: string;
  reaction_count: number; comment_count: number
}
export type Comment = { id: number; post_id: number; author_id: number; author: { username: string }; body: string; created_at: string }
export type AccessRequestResult = { message: string }

const tokenKey = 'morrowlog.accessToken'
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export const getToken = () => localStorage.getItem(tokenKey)
export const saveToken = (token: string | null) => token ? localStorage.setItem(tokenKey, token) : localStorage.removeItem(tokenKey)

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, { ...init, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)
        ? body.detail.map((item: { msg?: string }) => item.msg).join('. ') : message
    } catch { /* retain status message */ }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  requestAccess: (email: string) => request<AccessRequestResult>('/auth/access-request', { method: 'POST', body: JSON.stringify({ email }) }),
  register: (data: { email: string; invite_code: string; username: string; password: string }) => request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ access_token: string; token_type: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<User>('/auth/me'),
  posts: (offset: number, limit = 20) => request<Post[]>(`/posts?limit=${limit}&offset=${offset}`),
  post: (id: number) => request<Post>(`/posts/${id}`),
  createPost: (data: { title: string; body: string }) => request<Post>('/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id: number, data: { title: string; body: string }) => request<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),
  comments: (id: number, offset = 0) => request<Comment[]>(`/posts/${id}/comments?limit=50&offset=${offset}`),
  createComment: (id: number, body: string) => request<Comment>(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  react: (id: number, liked: boolean) => request<void>(`/posts/${id}/reaction`, { method: liked ? 'PUT' : 'DELETE' }),
}
