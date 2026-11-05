import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, getToken, saveToken } from './api'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
})

afterEach(() => { vi.restoreAllMocks(); storage.clear() })

describe('API client', () => {
  it('adds bearer credentials and query parameters to post requests', async () => {
    saveToken('session-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await api.posts(20, 10)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/posts?limit=10&offset=20')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-token')
  })

  it('handles successful no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api.react(8, true)).resolves.toBeUndefined()
  })

  it('maps post, comment, and reaction actions to the backend routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await api.updatePost(4, { title: 'Updated', body: 'Text' })
    await api.createPost({ title: 'New', body: 'Text' })
    await api.post(4)
    await api.createComment(4, 'A comment')
    await api.comments(4, 50)
    await api.deletePost(4)
    await api.react(4, false)
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      ['/api/v1/posts/4', 'PATCH'],
      ['/api/v1/posts', 'POST'],
      ['/api/v1/posts/4', 'GET'],
      ['/api/v1/posts/4/comments', 'POST'],
      ['/api/v1/posts/4/comments?limit=50&offset=50', 'GET'],
      ['/api/v1/posts/4', 'DELETE'],
      ['/api/v1/posts/4/reaction', 'DELETE'],
    ])
  })

  it('uses the documented register, login, and current-user routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api.register({ email: 'reader@example.com', username: 'reader_1', password: 'twelvecharacters' })
    await api.login({ email: 'reader@example.com', password: 'twelvecharacters' })
    await api.me()
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      ['/api/v1/auth/register', 'POST'],
      ['/api/v1/auth/login', 'POST'],
      ['/api/v1/auth/me', 'GET'],
    ])
  })

  it('surfaces API validation errors to the interface', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: 'Field required' }] }), { status: 422, headers: { 'Content-Type': 'application/json' } })))
    await expect(api.createPost({ title: '', body: '' })).rejects.toThrow('Field required')
  })

  it('persists and clears the session token', () => {
    saveToken('abc')
    expect(getToken()).toBe('abc')
    saveToken(null)
    expect(getToken()).toBeNull()
  })
})
