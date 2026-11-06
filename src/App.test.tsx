// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const user = { id: 1, email: 'writer@example.com', username: 'writer' }
const now = '2026-11-05T09:00:00Z'
const seedPost = { id: 7, title: 'A small observation', body: 'A short piece of writing.', author: user, created_at: now, updated_at: now, reaction_count: 0, comment_count: 0 }
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

describe('blog UI flow', () => {
  it('submits an access request and returns to the home screen with the review notice', async () => {
    const ui = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      void init
      const url = String(input)
      if (url === '/api/v1/auth/access-request') return json({ message: 'Your request has been submitted. Invite code in 1–3 business days.' }, 202)
      if (url.startsWith('/api/v1/posts?')) return json([])
      return json({ detail: `Unexpected request: ${url}` }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>)
    await ui.click(screen.getByRole('button', { name: /Request a new account/ }))
    await ui.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await ui.click(screen.getByRole('button', { name: /Submit access request/ }))

    await screen.findByRole('heading', { name: 'All posts' })
    expect((await screen.findByRole('status')).textContent).toContain('Invite code in 1–3 business days.')
    const request = fetchMock.mock.calls.find(([url]) => String(url) === '/api/v1/auth/access-request')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ email: 'reader@example.com' })
  })

  it('registers, publishes, reacts, comments, edits, and deletes through the API', async () => {
    const ui = userEvent.setup()
    let post = { ...seedPost }
    const posts = new Map<number, typeof seedPost>()
    const comments: Array<{ id: number; post_id: number; author_id: number; author: { username: string }; body: string; created_at: string }> = []
    const requests: Array<[string, string]> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input)
      const method = init.method ?? 'GET'
      requests.push([url, method])
      if (url === '/api/v1/auth/register') return json(user, 201)
      if (url === '/api/v1/auth/login') return json({ access_token: 'test-token', token_type: 'bearer' })
      if (url === '/api/v1/auth/me') return json(user)
      if (url.startsWith('/api/v1/posts?')) return json([...posts.values()])
      if (url === '/api/v1/posts' && method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { title: string; body: string }
        post = { ...seedPost, ...payload, created_at: now, updated_at: now }
        posts.set(post.id, post)
        return json(post, 201)
      }
      if (url === '/api/v1/posts/7' && method === 'GET') return json(post)
      if (url === '/api/v1/posts/7' && method === 'PATCH') {
        post = { ...post, ...JSON.parse(String(init.body)), updated_at: '2026-11-05T09:05:00Z' }
        posts.set(post.id, post)
        return json(post)
      }
      if (url === '/api/v1/posts/7' && method === 'DELETE') { posts.delete(7); return new Response(null, { status: 204 }) }
      if (url === '/api/v1/posts/7/reaction' && method === 'PUT') { post = { ...post, reaction_count: 1 }; return new Response(null, { status: 204 }) }
      if (url === '/api/v1/posts/7/comments?limit=50&offset=0' && method === 'GET') return json(comments)
      if (url === '/api/v1/posts/7/comments' && method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { body: string }
        const comment = { id: 11, post_id: 7, author_id: user.id, author: { username: user.username }, body: payload.body, created_at: now }
        comments.push(comment); post = { ...post, comment_count: comments.length }
        return json(comment, 201)
      }
      return json({ detail: `Unexpected request: ${method} ${url}` }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>)
    await ui.click(screen.getByRole('button', { name: /Enter invite code/ }))
    await ui.type(screen.getByLabelText(/Username/), 'writer')
    await ui.type(screen.getByLabelText('Invite code'), 'valid-code')
    await ui.type(screen.getByLabelText('Email address'), 'writer@example.com')
    await ui.type(screen.getByLabelText(/Password/), 'twelvecharacters')
    await ui.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('link', { name: /New post/ })

    await ui.click(screen.getByRole('link', { name: /New post/ }))
    await ui.type(await screen.findByLabelText(/Title/), 'A small observation')
    await ui.type(screen.getByLabelText(/Your writing/), 'A short piece of writing.')
    await ui.click(screen.getByRole('button', { name: 'Publish post' }))
    await screen.findByRole('heading', { name: 'A small observation' })

    await ui.click(screen.getByRole('button', { name: /Like/ }))
    await ui.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'A useful addition.')
    await ui.click(screen.getByRole('button', { name: 'Send comment' }))
    const submittedComment = await screen.findByText('A useful addition.')
    expect(submittedComment.closest('.comment')?.querySelector('strong')?.textContent).toBe('writer')

    await ui.click(screen.getByRole('link', { name: 'Edit post' }))
    const titleField = await screen.findByLabelText(/Title/)
    await ui.clear(titleField); await ui.type(titleField, 'A revised observation')
    await ui.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('heading', { name: 'A revised observation' })

    await ui.click(screen.getByRole('button', { name: 'Delete post' }))
    await screen.findByText('The page is still blank')

    expect(requests.map(([url, method]) => [url, method])).toEqual(expect.arrayContaining([
      ['/api/v1/auth/register', 'POST'], ['/api/v1/auth/login', 'POST'], ['/api/v1/auth/me', 'GET'],
      ['/api/v1/posts', 'POST'], ['/api/v1/posts/7', 'GET'], ['/api/v1/posts/7/reaction', 'PUT'],
      ['/api/v1/posts/7/comments', 'POST'], ['/api/v1/posts/7', 'PATCH'], ['/api/v1/posts/7', 'DELETE'],
    ]))
    expect(requests.findIndex(([url]) => url === '/api/v1/auth/login')).toBeGreaterThan(requests.findIndex(([url]) => url === '/api/v1/auth/register'))
    await waitFor(() => expect(posts.size).toBe(0))
  })
})
