'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import RecruitmentCard from './components/RecruitmentCard.jsx'
import RecruitmentModal from './components/RecruitmentModal.jsx'
import ApplyModal from './components/ApplyModal.jsx'
import ApplicantDetailModal from './components/ApplicantDetailModal.jsx'
import AccountActionModal from './components/AccountActionModal.jsx'
import Brand from './components/Brand.jsx'
import { categoryClassName } from './data/recruitments.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const ACCESS_TOKEN_KEY = 'haema-access-token'
const USER_ID_KEY = 'haema-user-id'

async function apiRequest(path, { token, ...options } = {}) {
  // Backend 라우트는 Bearer 토큰을 사용하고 업무 오류는 JSON의 error 필드로 돌려줍니다.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했어요.')
  return data
}

function mapBoard(board) {
  // Backend board 응답을 화면에서 쓰는 이름으로만 바꿉니다. 응답에 없는 값은 만들지 않습니다.
  const deadline = new Date(board.deadline)
  const daysLeft = Math.max(0, Math.ceil((deadline - new Date()) / 86400000))
  return {
    id: board.id,
    deadline: board.deadline,
    category: '모집 공고',
    daysLeft,
    title: board.title,
    organizer: board.eventName,
    description: board.recruitingContent,
    content: board.recruitingContent,
    people: board.recruitmentCount,
    contact: board.contactEmail,
    url: board.sourceUrl,
    createdAt: Date.parse(board.createdAt) || 0,
  }
}

function readRawStorage(key, fallback = '') {
  if (typeof window === 'undefined') return fallback
  return window.localStorage.getItem(key) || fallback
}

function PageHeading({ eyebrow, title, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>
}

function BoardPage({ recruitments, onCreate, onOpen, onLogin, error, loading, authenticated }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('latest')
  const [visibleCount, setVisibleCount] = useState(6)
  useEffect(() => setVisibleCount(6), [query])
  const visibleRecruitments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return recruitments
      .filter((item) => !normalizedQuery || `${item.title} ${item.organizer}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => sort === 'deadline' ? a.daysLeft - b.daysLeft : b.createdAt - a.createdAt)
  }, [recruitments, query, sort])
  const shownRecruitments = visibleRecruitments.slice(0, visibleCount)

  return <main className="main-content" id="board" aria-busy={loading}>
    <PageHeading eyebrow="RECRUITMENT BOARD" title="모집 공고"><button className="button button--primary" onClick={onCreate}><span>＋</span> 공고 작성</button></PageHeading>
    <section className="filter-bar" aria-label="공고 검색">
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대회명 또는 공고 제목으로 검색" aria-label="대회명 또는 공고 제목으로 검색" /></label>
    </section>
    <div className="results-row"><span>전체 <strong>{visibleRecruitments.length}개</strong>의 공고</span><label><span className="sr-only">정렬 순서</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">최신 등록순</option><option value="deadline">마감 임박순</option></select></label></div>
    {error ? <div className="empty-state"><strong>공고를 불러오지 못했어요.</strong><span>{error}</span><button className="button button--outline" onClick={onLogin}>로그인 화면으로</button></div>
      : loading ? <div className="empty-state" role="status" aria-live="polite"><strong>공고를 불러오는 중이에요.</strong></div>
      : shownRecruitments.length ? <div className="recruitment-grid">{shownRecruitments.map((item) => <RecruitmentCard key={item.id} recruitment={item} onOpen={onOpen} />)}</div>
        : <div className="empty-state"><strong>{authenticated ? '등록된 모집 공고가 없어요.' : '공고를 보려면 로그인해 주세요.'}</strong><span>{authenticated ? '백엔드에 공고가 등록되면 이곳에 표시됩니다.' : '학교 계정으로 로그인하면 백엔드의 공고를 불러옵니다.'}</span>{!authenticated && <button className="button button--outline" onClick={onLogin}>로그인</button>}</div>}
    {visibleRecruitments.length > shownRecruitments.length && <div className="board-more"><button onClick={() => setVisibleCount((count) => count + 6)}>모집 공고 더 보기 <b aria-hidden="true">→</b></button></div>}
  </main>
}

function getRecruitmentForm(recruitment) {
  if (!recruitment) return { organizer: '', deadline: '', url: '', title: '', people: '', contact: '', content: '' }
  return {
    organizer: recruitment.organizer ?? '',
    deadline: recruitment.deadline?.slice(0, 10) ?? '',
    url: recruitment.url ?? '',
    title: recruitment.title ?? '',
    people: String(recruitment.people ?? ''),
    contact: recruitment.contact ?? '',
    content: recruitment.content ?? '',
  }
}

function CreatePage({ initialRecruitment, onSave, onCancel }) {
  const isEditing = Boolean(initialRecruitment)
  const [form, setForm] = useState(() => getRecruitmentForm(initialRecruitment))
  const [error, setError] = useState('')
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    if (!/^https?:\/\//i.test(form.url)) { setError('http:// 또는 https://로 시작하는 대회 URL을 입력해 주세요.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.deadline)) { setError('마감일을 확인해 주세요.'); return }
    setError('')
    try {
      await onSave({ ...form, people: Number(form.people) })
    } catch (saveError) {
      setError(saveError.message)
    }
  }
  return <main className="form-page"><div className="form-intro"><p className="eyebrow">{isEditing ? 'EDIT RECRUITMENT' : 'NEW RECRUITMENT'}</p><h1>{isEditing ? '모집 공고 수정' : '모집 공고 작성'}</h1><p>함께 도전할 팀원에게 필요한 정보를 알려주세요.</p></div>
    <form className="recruitment-form" onSubmit={submit}>
      <section className="form-section"><div className="section-title"><span>01</span><div><h2>대회 정보</h2><p>참여하려는 대회의 기본 정보를 입력해 주세요.</p></div></div>
        <label>대회명<input required maxLength="200" name="organizer" value={form.organizer} onChange={update} placeholder="대회명을 입력해 주세요" /></label>
        <div className="form-columns"><label>모집 마감일<input required name="deadline" type="date" value={form.deadline} onChange={update} /></label><label>원문 대회 URL<input required maxLength="2048" name="url" type="url" value={form.url} onChange={update} placeholder="https://example.com/event" /></label></div>
      </section>
      <section className="form-section"><div className="section-title"><span>02</span><div><h2>모집 정보</h2><p>공고를 보는 팀원이 필요한 내용을 작성해 주세요.</p></div></div>
        <label>공고 제목<input required name="title" maxLength="200" value={form.title} onChange={update} placeholder="지원자가 한눈에 이해할 수 있는 제목을 작성해 주세요" /></label>
        <div className="form-columns"><label>모집 인원<input required name="people" type="number" min="1" max="100" step="1" value={form.people} onChange={update} placeholder="1~100명" /></label><label>연락 이메일<input required name="contact" type="email" maxLength="254" value={form.contact} onChange={update} placeholder="team@example.com" /></label></div>
        <label>모집 내용<textarea required maxLength="10000" name="content" value={form.content} onChange={update} placeholder="프로젝트 소개, 필요한 역할, 활동 계획 등을 자유롭게 작성해 주세요." /></label>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button button--outline" onClick={onCancel}>취소</button><button className="button button--primary">{isEditing ? '수정 내용 저장' : '공고 등록하기'} <span>→</span></button></div>
    </form>
  </main>
}

function getApplicationStatusLabel(status) {
  if (status === 'accepted') return '합격'
  if (status === 'rejected') return '탈락'
  return '검토 중'
}

function MyPage({ recruitments, applications, profile, onSaveProfile, onDelete, onOpenPost, onEditPost, onDecideApplication, onLogout, onWithdraw }) {
  const [tab, setTab] = useState('profile')
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [accountAction, setAccountAction] = useState(null)
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const mine = recruitments.filter((item) => item.owner === 'me')
  const myApplications = applications.filter((application) => application.applicantId === 'me')
  async function runAction(action) {
    setDashboardError('')
    try {
      await action()
    } catch (error) {
      setDashboardError(error.message)
    }
  }
  function submitProfile(event) {
    event.preventDefault()
    void runAction(() => onSaveProfile(profile))
  }
  return <main className="dashboard"><aside className="sidebar"><div className="profile-summary"><div className="profile-avatar">계</div><span>내 계정</span><strong>{profile.email || '로그인 계정'}</strong></div><nav aria-label="마이페이지 메뉴">{[['profile', '프로필 관리'], ['posts', `내가 작성한 공고  ${mine.length}`], ['applications', `내가 지원한 공고  ${myApplications.length}`]].map(([key, label]) => <button key={key} className={tab === key ? 'is-selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav><div className="account-actions"><span>계정</span><button onClick={() => setAccountAction('logout')}>로그아웃</button><button className="account-actions__withdraw" onClick={() => setAccountAction('withdraw')}>회원 탈퇴</button></div></aside>
    <section className="dashboard-content"><p className="eyebrow">MY HAEMA</p><div className="dashboard-heading"><h1>{tab === 'profile' ? '프로필 관리' : tab === 'posts' ? '내가 작성한 공고' : '내가 지원한 공고'}</h1><p>작성한 공고와 지원 현황을 관리해요.</p></div>
      {dashboardError && <p className="form-error" role="alert">{dashboardError}</p>}
      {tab === 'profile' ? <form className="profile-form" onSubmit={submitProfile}><div className="profile-avatar profile-avatar--large">계</div><div className="profile-fields"><label>전공<input value={profile.major} onChange={(event) => onSaveProfile({ ...profile, major: event.target.value }, false)} /></label><label>수상 경력<textarea value={profile.awards} onChange={(event) => onSaveProfile({ ...profile, awards: event.target.value }, false)} /></label><button className="button button--primary">변경사항 저장</button></div></form>
      : tab === 'posts' ? <div className="owned-list">{mine.length ? mine.map((item) => {
        const applicants = applications.filter((application) => application.recruitmentId === item.id && application.applicantId !== 'me')
        return <article className="owned-card owned-card--post" key={item.id}>
          <div className="owned-card__details"><span className={`category ${categoryClassName(item.category)}`}>{item.category} · D-{item.daysLeft}</span><button className="owned-card__open owned-card__post-title" onClick={() => onOpenPost(item)}><strong>{item.title}</strong><span>공고 상세 보기 →</span></button><p>{item.organizer}</p>
            <section className="applicant-section"><h3>지원서 목록 <span>{applicants.length}건</span></h3>{applicants.length ? applicants.map((application) => <article className="applicant-row" key={application.id}><div className="applicant-row__info"><button className="applicant-name-button" onClick={() => setSelectedApplicant(application)}>지원서 내용 보기</button><p>{application.introduction}</p></div><div className="applicant-row__actions">{application.status === 'pending' ? <><button className="button button--outline button--danger" onClick={() => runAction(() => onDecideApplication(application.id, 'rejected'))}>탈락</button><button className="button button--primary" onClick={() => runAction(() => onDecideApplication(application.id, 'accepted'))}>합격</button></> : <span className={`application-status application-status--${application.status}`}>{getApplicationStatusLabel(application.status)}</span>}</div></article>) : <p className="applicant-empty">아직 지원서가 없어요.</p>}</section>
          </div><div className="owned-card__actions"><button className="button button--outline" onClick={() => onEditPost(item)}>수정</button><button className="button button--outline button--danger" onClick={() => runAction(() => onDelete(item.id))}>삭제</button></div>
        </article>
      }) : <div className="empty-state"><strong>아직 작성한 공고가 없어요.</strong><span>새 공고를 작성하면 이곳에서 관리할 수 있어요.</span></div>}</div>
      : <div className="owned-list">{myApplications.length ? myApplications.map((item) => <article className="owned-card" key={item.id}><div><span className={`application-status application-status--${item.status}`}>{getApplicationStatusLabel(item.status)}</span><h2>{item.title}</h2></div><button className="button button--outline" onClick={() => setSelectedApplication(item)}>지원 결과 보기 →</button></article>) : <div className="empty-state"><strong>아직 지원한 공고가 없어요.</strong><span>관심 있는 공고를 찾아 지원해 보세요.</span></div>}</div>}
    </section>
    <ApplicantDetailModal applicant={selectedApplicant} onClose={() => setSelectedApplicant(null)} />
    {accountAction && <AccountActionModal mode={accountAction} onClose={() => setAccountAction(null)} onConfirm={() => accountAction === 'logout' ? onLogout() : onWithdraw()} />}
    {selectedApplication && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedApplication(null) }}><section className="application-detail" role="dialog" aria-modal="true" aria-labelledby="application-title"><button className="modal-close modal-close--light" onClick={() => setSelectedApplication(null)} aria-label="닫기">×</button><p className="eyebrow">APPLICATION RESULT</p><h2 id="application-title">지원 결과</h2><p className="form-context">{selectedApplication.title}</p><span className={`application-status application-status--${selectedApplication.status}`}>{getApplicationStatusLabel(selectedApplication.status)}</span><button className="button button--outline" onClick={() => setSelectedApplication(null)}>닫기</button></section></div>}
    </main>
}

function AuthPage({ mode, onSwitch, onSubmit, onHome }) {
  const isSignup = mode === 'signup'
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      const payload = Object.fromEntries(form.entries())
      if (isSignup) {
        const emailDomain = payload.email.trim().toLowerCase().split('@').at(-1)
        if (emailDomain !== 'dsm.hs.kr' && !emailDomain.endsWith('.dsm.hs.kr')) {
          throw new Error('대덕소프트웨어마이스터고등학교 학교 이메일을 입력해 주세요.')
        }
        if (payload.password !== payload.passwordConfirm) {
          throw new Error('비밀번호와 비밀번호 확인이 일치하지 않아요.')
        }
        if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}/.test(payload.password)) {
          throw new Error('비밀번호는 10자 이상이며 대문자, 소문자, 숫자, !@#$%^&* 중 특수기호를 포함해야 해요.')
        }
      }
      const result = await onSubmit(isSignup ? 'signup' : 'login', payload)
      if (result?.message) setNotice(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-labelledby="auth-promise">
        <Brand onHome={onHome} />
        <p className="eyebrow">DSM STUDENT TEAM BUILDING</p>
        <h1 id="auth-promise">좋은 도전에는,<br /><strong>좋은 팀</strong>이 필요하니까.</h1>
        <p>대덕소프트웨어마이스터고등학교 학생들과 해커톤 · 공모전 · 프로젝트 팀원을 찾아보세요.</p>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">{isSignup ? 'JOIN HAEMA' : 'WELCOME BACK'}</p>
        <h2>{isSignup ? '새로운 도전을 시작해요.' : '다시 만나서 반가워요.'}</h2>
        <p>{isSignup ? 'dsm.hs.kr 학교 이메일로 가입하고 인증 메일을 확인해 주세요.' : '학교 이메일로 로그인해 주세요.'}</p>
        <label>이메일
          <input required name="email" type="email" autoComplete="email" placeholder="name@dsm.hs.kr" />
          {isSignup && <small className="field-hint">@dsm.hs.kr 학교 이메일을 사용해 주세요.</small>}
        </label>
        <label>비밀번호
          <input required name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 10 : 1} placeholder="비밀번호를 입력해 주세요" />
          {isSignup && <small className="field-hint">10자 이상, 대문자·소문자·숫자·특수기호 !@#$%^&amp;* 포함</small>}
        </label>
        {isSignup && <>
          <label>비밀번호 확인<input required name="passwordConfirm" type="password" autoComplete="new-password" minLength="10" placeholder="비밀번호를 다시 입력해 주세요" /></label>
          <label>전공<input name="major" maxLength="5000" placeholder="전공 (선택)" /></label>
          <label>기술 스택<input name="skills" maxLength="5000" placeholder="예: Java, React, Python (선택)" /></label>
          <label>수상 경력<textarea name="awards" maxLength="5000" placeholder="수상 경력 (선택)" /></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-context" role="status">{notice}</p>}
        <button className="button button--primary auth-submit" disabled={busy}>
          {busy ? '처리 중…' : isSignup ? '회원가입' : '로그인'} <span>→</span>
        </button>
        <p className="auth-switch">{isSignup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'} <button type="button" onClick={onSwitch}>{isSignup ? '로그인' : '회원가입'}</button></p>
      </form>
    </main>
  )
}

export default function App() {
  const [page, setPage] = useState('login')
  const [recruitments, setRecruitments] = useState([])
  const [applications, setApplications] = useState([])
  const [profile, setProfile] = useState(() => ({ email: readRawStorage('haema-account-email'), major: '', awards: '' }))
  const [authenticated, setAuthenticated] = useState(() => Boolean(readRawStorage(ACCESS_TOKEN_KEY) && readRawStorage(USER_ID_KEY)))
  const [loading, setLoading] = useState(false)
  const [boardError, setBoardError] = useState('')
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(null)
  const [editingRecruitment, setEditingRecruitment] = useState(null)
  const userId = readRawStorage(USER_ID_KEY)
  const accessToken = readRawStorage(ACCESS_TOKEN_KEY)

  useEffect(() => {
    if (!authenticated || !accessToken || !userId) return
    let cancelled = false
    setLoading(true)
    setBoardError('')
    Promise.all([
      apiRequest('/common/board?limit=100&offset=0', { token: accessToken }),
      apiRequest(`/common/mypage/${userId}`, { token: accessToken }),
      apiRequest('/common/record', { token: accessToken }),
    ]).then(async ([boardData, myPageData, recordData]) => {
      if (cancelled) return
      const ownBoardIds = new Set((myPageData.createdBoards ?? []).map((board) => board.id))
      setRecruitments((boardData.items ?? []).map((board) => ({ ...mapBoard(board), owner: ownBoardIds.has(board.id) ? 'me' : undefined })))
      const appliedBoards = (myPageData.appliedBoards ?? []).map((item) => ({
        id: item.applicationId,
        recruitmentId: item.board?.id,
        title: item.board?.title ?? '삭제된 공고',
        status: item.status,
        statusLabel: item.statusLabel,
        introduction: '',
        applicantId: 'me',
      }))
      // 모집자 API는 본인 공고마다 boardId를 요구하며, 지원자의 신상 정보는 반환하지 않습니다.
      const receivedResults = await Promise.all([...ownBoardIds].map((boardId) =>
        apiRequest(`/host/app/list?boardId=${encodeURIComponent(boardId)}&limit=100&offset=0`, { token: accessToken }),
      ))
      const receivedApplications = receivedResults.flatMap((result) => result.items ?? []).map((item) => ({
        id: item.id,
        recruitmentId: item.boardId,
        status: item.status,
        statusLabel: item.statusLabel,
        introduction: item.content,
      }))
      setApplications([...appliedBoards, ...receivedApplications])
      setProfile((current) => ({ ...current, major: recordData.record?.major ?? '', awards: recordData.record?.awards ?? '' }))
    }).catch((error) => {
      if (cancelled) return
      setBoardError(error.message)
      if (/인증|로그인|token/i.test(error.message)) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY)
        window.localStorage.removeItem(USER_ID_KEY)
        setAuthenticated(false)
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authenticated, accessToken, userId])

  async function saveRecruitment(form) {
    // Backend가 받는 BoardInput 필드만 전송합니다.
    const payload = {
      eventName: form.organizer,
      title: form.title,
      sourceUrl: form.url,
      recruitingContent: form.content,
      recruitmentCount: Number(form.people),
      contactEmail: form.contact,
      deadline: form.deadline,
    }
    if (editingRecruitment) {
      await apiRequest(`/host/board/${editingRecruitment.id}`, { method: 'PATCH', token: accessToken, body: JSON.stringify(payload) })
    } else {
      await apiRequest('/host/board', { method: 'POST', token: accessToken, body: JSON.stringify(payload) })
    }
    const [boardData, myPageData] = await Promise.all([
      apiRequest('/common/board?limit=100&offset=0', { token: accessToken }),
      apiRequest(`/common/mypage/${userId}`, { token: accessToken }),
    ])
    const ownBoardIds = new Set((myPageData.createdBoards ?? []).map((board) => board.id))
    setRecruitments((boardData.items ?? []).map((board) => ({ ...mapBoard(board), owner: ownBoardIds.has(board.id) ? 'me' : undefined })))
    setEditingRecruitment(null)
    setPage('board')
  }
  function startNewRecruitment() {
    setEditingRecruitment(null)
    setPage('create')
  }
  function startEditingRecruitment(recruitment) {
    setSelected(null)
    setEditingRecruitment(recruitment)
    setPage('create')
  }
  async function submitApplication(form) {
    await apiRequest(`/app/record/${applying.id}`, { method: 'POST', token: accessToken, body: JSON.stringify({ content: form.content }) })
    setApplying(null)
    const myPageData = await apiRequest(`/common/mypage/${userId}`, { token: accessToken })
    setApplications((current) => [
      ...current.filter((item) => item.applicantId !== 'me'),
      ...(myPageData.appliedBoards ?? []).map((item) => ({ id: item.applicationId, recruitmentId: item.board?.id, title: item.board?.title ?? '삭제된 공고', status: item.status, statusLabel: item.statusLabel, introduction: '', applicantId: 'me' })),
    ])
  }
  async function deleteRecruitment(id) {
    await apiRequest(`/host/board/${id}`, { method: 'DELETE', token: accessToken })
    setRecruitments((items) => items.filter((item) => item.id !== id))
  }
  async function decideApplication(id, status) {
    await apiRequest(`/host/app/${id}`, { method: 'PATCH', token: accessToken, body: JSON.stringify({ status }) })
    setApplications((items) => items.map((item) => item.id === id ? { ...item, status, statusLabel: getApplicationStatusLabel(status) } : item))
  }
  function logOut() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    window.localStorage.removeItem(USER_ID_KEY)
    window.localStorage.removeItem('haema-account-email')
    setAuthenticated(false)
    setRecruitments([])
    setApplications([])
    setProfile({ email: '', major: '', awards: '' })
    setPage('login')
  }
  async function withdrawAccount() {
    await apiRequest('/common/account', { method: 'DELETE', token: accessToken })
    logOut()
  }
  async function handleAuth(mode, values) {
    if (mode === 'signup') {
      return apiRequest('/common/sign-up', { method: 'POST', body: JSON.stringify(values) })
    }
    const result = await apiRequest('/common/log-in', { method: 'POST', body: JSON.stringify(values) })
    window.localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
    window.localStorage.setItem(USER_ID_KEY, result.userId)
    window.localStorage.setItem('haema-account-email', values.email)
    setProfile((current) => ({ ...current, email: values.email }))
    setAuthenticated(true)
    setPage('board')
    return result
  }
  async function saveProfile(nextProfile, shouldSave = true) {
    setProfile(nextProfile)
    if (!shouldSave) return
    const result = await apiRequest(`/common/record/${userId}`, { method: 'PATCH', token: accessToken, body: JSON.stringify({ major: nextProfile.major, awards: nextProfile.awards }) })
    setProfile((current) => ({ ...current, major: result.record.major, awards: result.record.awards }))
  }

  return <>{page !== 'login' && page !== 'signup' && <Header page={page} onNavigate={(nextPage) => { if ((nextPage === 'mypage' || nextPage === 'create') && !authenticated) { setPage('login'); return } if (nextPage !== 'create') setEditingRecruitment(null); setPage(nextPage) }} />}
    {page === 'board' && <BoardPage recruitments={recruitments} onCreate={startNewRecruitment} onOpen={setSelected} onLogin={() => setPage('login')} loading={loading} error={boardError} authenticated={authenticated} />}
    {page === 'create' && <CreatePage initialRecruitment={editingRecruitment} onSave={saveRecruitment} onCancel={() => { setPage(editingRecruitment ? 'mypage' : 'board'); setEditingRecruitment(null) }} />}
    {page === 'mypage' && authenticated && <MyPage recruitments={recruitments.filter((item) => item.owner)} applications={applications} profile={profile} onSaveProfile={saveProfile} onDelete={deleteRecruitment} onOpenPost={setSelected} onEditPost={startEditingRecruitment} onDecideApplication={decideApplication} onLogout={logOut} onWithdraw={withdrawAccount} />}
    {(page === 'login' || page === 'signup') && <AuthPage mode={page} onSwitch={() => setPage(page === 'login' ? 'signup' : 'login')} onSubmit={handleAuth} onHome={() => setPage(authenticated ? 'board' : 'login')} />}
    <Footer onNavigate={setPage} />
    <RecruitmentModal recruitment={selected} isOwner={selected?.owner === 'me'} onClose={() => setSelected(null)} onApply={(item) => { if (item.owner !== 'me') { setSelected(null); setApplying(item) } }} />
    <ApplyModal recruitment={applying} onClose={() => setApplying(null)} onSubmit={submitApplication} />
  </>
}
