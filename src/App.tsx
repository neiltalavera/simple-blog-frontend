import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Heart, LogOut, MessageCircle, PenLine, Plus, Search, Send, Sparkles, X } from 'lucide-react'
import { api, ApiError, getToken, saveToken, type Comment, type Post, type User } from './api'

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
const wasEdited = (post: Post) => new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 1000
const paragraphs = (body: string) => body.split(/\n{2,}/).filter(Boolean)
const excerpt = (body: string) => body.replace(/\s+/g, ' ').trim()

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!getToken()) { setAuthReady(true); return }
    api.me().then(setUser).catch(() => saveToken(null)).finally(() => setAuthReady(true))
  }, [])
  const flash = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3800)
  }, [])
  const signOut = () => { saveToken(null); setUser(null); flash('You have signed out.') }
  if (!authReady) return <div className="boot-screen"><span className="brand-mark">f</span></div>
  return <>
    <Header user={user} signOut={signOut} />
    <main className="app-main">
      <Routes>
        <Route path="/" element={<Feed user={user} />} />
        <Route path="/post/:id" element={<PostPage user={user} flash={flash} />} />
        <Route path="/write" element={<Composer user={user} flash={flash} />} />
        <Route path="/edit/:id" element={<Composer user={user} flash={flash} />} />
        <Route path="/login" element={<AuthPage mode="login" setUser={setUser} flash={flash} />} />
        <Route path="/register" element={<AuthPage mode="register" setUser={setUser} flash={flash} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <footer className="site-footer"><span>Morrowlog</span><span>A blog for reading and writing.</span></footer>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}
  </>
}

function Header({ user, signOut }: { user: User | null; signOut: () => void }) {
  const location = useLocation()
  return <header className="topbar">
    <div className="topbar-inner">
      <Link to="/" className="brand" aria-label="Morrowlog home"><span className="brand-mark">m</span><span>Morrowlog</span></Link>
      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Bookmark size={16} />Reading</NavLink>
        <NavLink to="/write" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><PenLine size={16} />Write</NavLink>
      </nav>
      <div className="top-actions">
        {user ? <><Link to="/write" className="button button-primary top-write"><Plus size={16} />New post</Link><div className="user-menu"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username}</span><ChevronDown size={14} /><button className="menu-logout" onClick={signOut}><LogOut size={15} />Sign out</button></div></> : <>
          <Link to="/login" state={{ from: location.pathname }} className="login-link">Sign in</Link><Link to="/register" className="button button-primary top-write">Join Morrowlog<ArrowRight size={15} /></Link>
        </>}
      </div>
    </div>
  </header>
}

function Feed({ user }: { user: User | null }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const load = useCallback(async (start = 0, append = false) => {
    try {
      setError('')
      const next = await api.posts(start)
      setPosts(current => append ? [...current, ...next] : next)
      setOffset(start + next.length)
      setHasMore(next.length === 20)
    } catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !target?.matches('input, textarea, [contenteditable="true"]')) {
        event.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const filtered = posts.filter(post => `${post.title} ${post.body} ${post.author.username}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="feed-layout">
    <aside className="feed-rail"><div className="rail-label">Your space</div><NavLink to="/" end className="rail-item selected"><Bookmark size={16} />All posts</NavLink><div className="rail-divider" /><div className="rail-note"><span className="note-icon"><PenLine size={16} /></span><strong>Good writing takes a little space.</strong><span>Make yours here.</span>{user ? <Link to="/write" className="text-link">Start a post <ArrowRight size={14} /></Link> : <Link to="/register" className="text-link">Create an account <ArrowRight size={14} /></Link>}</div></aside>
    <section className="feed-column" aria-labelledby="feed-heading">
      <div className="feed-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" />The reading room</p><h1 id="feed-heading">All posts</h1><p className="heading-sub">Ideas and notes, shared by the community.</p></div><span className="post-total">{posts.length}{hasMore ? '+' : ''} {posts.length === 1 ? 'post' : 'posts'}</span></div>
      <div className="feed-toolbar"><div className="feed-tabs"><span className="feed-tab active">Latest</span></div><label className="search-box"><Search size={16} /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search posts" aria-label="Search posts" /><kbd>/</kbd></label></div>
      {loading ? <div className="loading-state"><span className="spinner" />Loading posts</div> : error ? <div className="state-card"><span className="state-icon"><X size={20} /></span><h2>Posts did not load</h2><p>{error}</p><button className="button button-secondary" onClick={() => { setLoading(true); void load() }}>Try again</button></div> : filtered.length ? <div className="post-list">{filtered.map((post, index) => <PostCard key={post.id} post={post} index={index} />)}</div> : query ? <div className="empty-state"><span className="state-icon"><Search size={20} /></span><h2>No posts found</h2><p>Try a different title, phrase, or author.</p><button className="text-link" onClick={() => setQuery('')}>Clear search</button></div> : <div className="empty-state"><span className="state-icon"><PenLine size={20} /></span><h2>The page is still blank</h2><p>There are no posts yet. Start with an idea you want to share.</p><Link to={user ? '/write' : '/register'} className="button button-primary">{user ? 'Write the first post' : 'Join and write'}<ArrowRight size={16} /></Link></div>}
      {!loading && hasMore && !query && <button className="load-more" disabled={loadingMore} onClick={() => { setLoadingMore(true); void load(offset, true) }}>{loadingMore ? 'Loading…' : 'Load more posts'}<ArrowDownIcon /></button>}
    </section>
    <aside className="feed-aside"><div className="aside-card"><div className="aside-kicker">A note on Morrowlog</div><h2>A little room for a good idea.</h2><p>Write what you know, read what others notice, and add a thought when you have one.</p><div className="aside-line" /><span className="aside-sign">Morrowlog <span>·</span> Reading room</span></div></aside>
  </div>
}

function ArrowDownIcon() { return <ArrowRight className="down-arrow" size={15} /> }

function PostCard({ post, index }: { post: Post; index: number }) {
  return <article className="post-card" style={{ animationDelay: `${index * 45}ms` }}>
    <div className="post-meta"><span className="avatar avatar-small">{post.author.username.slice(0, 1).toUpperCase()}</span><strong>{post.author.username}</strong><span className="meta-separator">·</span><time dateTime={post.created_at}>{dateLabel(post.created_at)}</time>{wasEdited(post) && <span className="edited-label">Edited</span>}</div>
    <Link to={`/post/${post.id}`} className="post-title-link"><h2>{post.title}</h2></Link>
    <p className="post-excerpt">{excerpt(post.body).slice(0, 240)}{post.body.length > 240 ? '…' : ''}</p>
    <div className="post-card-footer"><Link to={`/post/${post.id}`} className="read-link">Read post <ArrowRight size={15} /></Link><div className="post-stats"><span><Heart size={15} />{post.reaction_count}</span><span><MessageCircle size={15} />{post.comment_count}</span></div></div>
  </article>
}

function PostPage({ user, flash }: { user: User | null; flash: (message: string) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const postId = Number(id)
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentOffset, setCommentOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [body, setBody] = useState('')
  const [liked, setLiked] = useState(() => localStorage.getItem(`morrowlog.reaction.${postId}`) === 'true')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [loadedPost, loadedComments] = await Promise.all([api.post(postId), api.comments(postId)])
      setPost(loadedPost); setComments(loadedComments); setCommentOffset(loadedComments.length); setHasMore(loadedComments.length === 50)
    } catch (err) { setError(errorMessage(err)) }
  }, [postId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setLiked(localStorage.getItem(`morrowlog.reaction.${postId}`) === 'true') }, [postId])
  const toggleReaction = async () => {
    if (!user || !post || pending) return
    const next = !liked; setPending(true); setLiked(next); setPost({ ...post, reaction_count: Math.max(0, post.reaction_count + (next ? 1 : -1)) })
    try { await api.react(post.id, next); localStorage.setItem(`morrowlog.reaction.${post.id}`, String(next)) }
    catch (err) { setLiked(!next); setPost(post); flash(errorMessage(err)) }
    finally { setPending(false) }
  }
  const submitComment = async (event: FormEvent) => {
    event.preventDefault(); if (!body.trim() || pending) return
    setPending(true)
    try {
      const created = await api.createComment(postId, body.trim())
      setComments(current => [...current, created]); setBody(''); setPost(current => current ? { ...current, comment_count: current.comment_count + 1 } : current)
    } catch (err) { flash(errorMessage(err)) } finally { setPending(false) }
  }
  const remove = async () => {
    if (!post || !window.confirm('Delete this post? This cannot be undone.')) return
    try { await api.deletePost(post.id); flash('Post deleted.'); navigate('/') } catch (err) { flash(errorMessage(err)) }
  }
  if (error) return <div className="narrow-page"><Link to="/" className="back-link"><ArrowLeft size={16} />All posts</Link><div className="state-card"><h2>Post unavailable</h2><p>{error}</p><Link to="/" className="button button-secondary">Back to all posts</Link></div></div>
  if (!post) return <div className="loading-state page-loading"><span className="spinner" />Loading post</div>
  const isAuthor = user?.id === post.author.id
  return <div className="narrow-page">
    <Link to="/" className="back-link"><ArrowLeft size={16} />All posts</Link>
    <article className="article-page">
      <div className="article-topline"><span className="article-category">Community writing</span>{isAuthor && <div className="article-tools"><Link to={`/edit/${post.id}`} className="icon-action" aria-label="Edit post"><PenLine size={16} /></Link><button onClick={remove} className="icon-action danger-hover" aria-label="Delete post"><X size={17} /></button></div>}</div>
      <h1>{post.title}</h1>
      <div className="article-byline"><span className="avatar">{post.author.username.slice(0, 1).toUpperCase()}</span><div><strong>{post.author.username}</strong><span>{dateLabel(post.created_at)}{wasEdited(post) && ' · Edited'}</span></div></div>
      <div className="article-body">{paragraphs(post.body).map((para, index) => <p key={index}>{para}</p>)}</div>
      <div className="article-actions"><button onClick={toggleReaction} disabled={!user || pending} className={`reaction-button${liked ? ' reacted' : ''}`} title={user ? (liked ? 'Remove reaction' : 'React to this post') : 'Sign in to react'}><Heart size={17} fill={liked ? 'currentColor' : 'none'} />{liked ? 'Liked' : 'Like'}<span>{post.reaction_count}</span></button><span className="article-comment-count"><MessageCircle size={16} />{post.comment_count} comments</span>{!user && <Link to="/login" className="text-link sign-in-hint">Sign in to join the conversation <ArrowRight size={14} /></Link>}</div>
    </article>
    <section className="comments-section" aria-labelledby="comments-title"><div className="comments-heading"><div><p className="eyebrow">Conversation</p><h2 id="comments-title">Comments <span>{post.comment_count}</span></h2></div></div>
      {user ? <form className="comment-form" onSubmit={submitComment}><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><div className="comment-input-wrap"><textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Add a thoughtful comment…" maxLength={5000} rows={3} aria-label="Write a comment" /><div className="comment-form-footer"><span>{body.length}/5000</span><button className="button button-primary" disabled={!body.trim() || pending}>Send comment<Send size={14} /></button></div></div></form> : <div className="comment-signin"><p>Join the conversation with a comment.</p><Link to="/login" className="button button-secondary">Sign in to comment</Link></div>}
      <div className="comment-list">{comments.map(comment => <article className="comment" key={comment.id}><span className="avatar avatar-small">{comment.author.username.slice(0, 1).toUpperCase()}</span><div className="comment-content"><div className="comment-meta"><strong>{comment.author.username}</strong><time dateTime={comment.created_at}>{dateLabel(comment.created_at)}</time></div><p>{comment.body}</p></div></article>)}
        {!comments.length && <div className="comments-empty"><MessageCircle size={19} /><span>No comments yet. Add the first thought.</span></div>}
        {hasMore && <button className="load-more comments-more" onClick={async () => { try { const next = await api.comments(postId, commentOffset); setComments(current => [...current, ...next]); setCommentOffset(commentOffset + next.length); setHasMore(next.length === 50) } catch (err) { flash(errorMessage(err)) } }}>Load earlier comments<ArrowRight size={14} /></button>}
      </div>
    </section>
  </div>
}

function Composer({ user, flash }: { user: User | null; flash: (message: string) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!isEdit || !id) return
    api.post(Number(id)).then(post => {
      if (user && post.author.id !== user.id) { setError('You can only edit your own posts.'); return }
      setTitle(post.title); setBody(post.body)
    }).catch(err => setError(errorMessage(err))).finally(() => setLoading(false))
  }, [id, isEdit, user])
  if (!user) return <AuthRequired />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) { setError('Add a title and some writing before publishing.'); return }
    setPending(true); setError('')
    try {
      const post = isEdit ? await api.updatePost(Number(id), { title: title.trim(), body: body.trim() }) : await api.createPost({ title: title.trim(), body: body.trim() })
      flash(isEdit ? 'Your changes are saved.' : 'Your post is published.')
      navigate(`/post/${post.id}`)
    } catch (err) { setError(errorMessage(err)) } finally { setPending(false) }
  }
  if (loading) return <div className="loading-state page-loading"><span className="spinner" />Loading draft</div>
  return <div className="composer-page"><div className="composer-heading"><Link to={isEdit ? `/post/${id}` : '/'} className="back-link"><ArrowLeft size={16} />{isEdit ? 'Back to post' : 'All posts'}</Link><p className="eyebrow"><span className="eyebrow-dot" />Your writing</p><h1>{isEdit ? 'Edit your post' : 'Write a post'}</h1><p>Put your thoughts into words. You can come back and edit this later.</p></div>
    <form className="composer-form" onSubmit={submit}><label className="field-label" htmlFor="post-title">Title <span>{title.length}/200</span></label><input id="post-title" className="title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a title" maxLength={200} required autoFocus /><label className="field-label body-label" htmlFor="post-body">Your writing <span>{body.length.toLocaleString()}/50,000</span></label><textarea id="post-body" className="body-input" value={body} onChange={e => setBody(e.target.value)} placeholder="Start with a thought…" maxLength={50000} required rows={14} /><div className="editor-footer"><span className="editor-tip"><Sparkles size={15} />A clear first paragraph helps readers find their way in.</span><div className="editor-actions"><Link to={isEdit ? `/post/${id}` : '/'} className="button button-text">Cancel</Link><button className="button button-primary publish-button" disabled={pending || !title.trim() || !body.trim()}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish post'}<ArrowRight size={16} /></button></div></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
  </div>
}

function AuthRequired() { return <div className="narrow-page auth-required"><span className="state-icon"><PenLine size={20} /></span><h1>Sign in to write</h1><p>Create an account or sign in to publish a post.</p><div className="auth-choice"><Link to="/login" className="button button-primary">Sign in</Link><Link to="/register" className="button button-secondary">Create account</Link></div></div> }

function AuthPage({ mode, setUser, flash }: { mode: 'login' | 'register'; setUser: (user: User) => void; flash: (message: string) => void }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [registerChoice, setRegisterChoice] = useState<'choose' | 'request' | 'code'>('choose')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const from = (location.state as { from?: string } | null)?.from || '/'
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError('')
    try {
      if (isRegister) {
        if (registerChoice === 'request') {
          const result = await api.requestAccess(email.trim())
          flash(result.message)
          navigate('/', { replace: true })
          return
        }
        await api.register({ email: email.trim(), invite_code: inviteCode.trim(), username: username.trim(), password })
      }
      const token = await api.login({ email: email.trim(), password })
      saveToken(token.access_token)
      const me = await api.me(); setUser(me); navigate(from, { replace: true })
    } catch (err) { setError(errorMessage(err)) } finally { setPending(false) }
  }
  return <div className="auth-layout"><div className="auth-story"><Link to="/" className="brand"><span className="brand-mark">m</span><span>Morrowlog</span></Link><div className="auth-story-copy"><p className="eyebrow"><span className="eyebrow-dot" />A place to share ideas</p><h1>Read with care.<br /><em>Write with purpose.</em></h1><p>Good writing can start anywhere. Find a thought worth keeping, or leave one for someone else.</p></div><span className="story-foot">A small corner of the internet for words.</span></div>
    <div className="auth-form-side"><div className="auth-form-wrap"><Link to="/" className="mobile-brand brand"><span className="brand-mark">m</span>Morrowlog</Link><p className="eyebrow">{isRegister ? 'Make a little room' : 'Welcome back'}</p><h2>{isRegister ? registerChoice === 'choose' ? 'Request access' : registerChoice === 'request' ? 'Request a new account' : 'Enter your invite code' : 'Sign in to Morrowlog'}</h2><p className="auth-subtitle">{isRegister ? registerChoice === 'choose' ? 'Choose how you would like to join Morrowlog.' : registerChoice === 'request' ? 'We’ll review your request and email an invite code within 1–3 business days.' : 'Use the email address that received your invite code.' : 'Pick up where you left off.'}</p>
      {isRegister && registerChoice === 'choose' ? <div className="auth-form"><button className="button button-primary auth-submit" onClick={() => setRegisterChoice('request')}>Request a new account<ArrowRight size={16} /></button><button className="button button-secondary auth-submit" onClick={() => setRegisterChoice('code')}>Enter invite code<ArrowRight size={16} /></button></div> : <form onSubmit={submit} className="auth-form">{isRegister && registerChoice === 'code' && <label className="form-field"><span>Invite code</span><input value={inviteCode} onChange={e => setInviteCode(e.target.value)} autoComplete="off" required /></label>}{isRegister && registerChoice === 'code' && <label className="form-field"><span>Username</span><input value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" placeholder="Letters, numbers, and _" required /><small>3–30 characters. Letters, numbers, and underscores.</small></label>}<label className="form-field"><span>Email address</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>{(!isRegister || registerChoice === 'code') && <label className="form-field"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={isRegister ? 12 : undefined} maxLength={128} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 12 characters' : 'Your password'} required />{isRegister && <small>Use at least 12 characters.</small>}</label>}{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary auth-submit" disabled={pending}>{pending ? 'One moment…' : isRegister ? registerChoice === 'request' ? 'Submit access request' : 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>{isRegister && <button type="button" className="button button-text" onClick={() => { setRegisterChoice('choose'); setError('') }}>Back to options</button>}</form>}
      <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Morrowlog?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
    </div></div>
  </div>
}

function NotFound() { return <div className="narrow-page not-found"><p className="eyebrow">404 · Page not found</p><h1>This page is missing.</h1><p>The post or page you’re looking for may have moved.</p><Link to="/" className="button button-primary">Back to all posts<ArrowRight size={16} /></Link></div> }
function errorMessage(err: unknown) { return err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong. Please try again.' }

export default App
