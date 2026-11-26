'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import RecruitmentCard from './components/RecruitmentCard.jsx'
import RecruitmentModal from './components/RecruitmentModal.jsx'
import ApplyModal from './components/ApplyModal.jsx'
import { categories, categoryClassName, sampleRecruitments } from './data/recruitments.js'

const STORAGE_KEY = 'haema-recruitments-v1'
const APPLICATIONS_KEY = 'haema-applications-v1'
const SAMPLE_VERSION_KEY = 'haema-sample-version'
const APPLICATIONS_SEED_VERSION_KEY = 'haema-applications-seed-version'

const sampleApplications = [
  { id: 'sample-application-1', recruitmentId: 'junction-asia', title: '2025 Junction Asia 함께할 프론트엔드 팀원을 찾아요', applicantId: 'demo-student-1', applicantName: '김하늘', introduction: 'React 프로젝트를 진행한 경험이 있어요. 팀과 함께 아이디어를 빠르게 구현하고 싶습니다.', status: 'pending' },
  { id: 'sample-application-2', recruitmentId: 'junction-asia', title: '2025 Junction Asia 함께할 프론트엔드 팀원을 찾아요', applicantId: 'demo-student-2', applicantName: '박민서', introduction: '디자인 시스템을 적용한 웹 앱을 만들어 봤어요. 맡은 일을 책임감 있게 끝내겠습니다.', status: 'pending' },
  { id: 'sample-my-application-1', recruitmentId: 'kosac', title: '대학생 광고 공모전 기획·마케팅 팀원 모집', applicantId: 'me', applicantName: '플랑크톤', introduction: '시장 조사 경험을 살려 아이디어를 함께 구체화하고 싶습니다.', status: 'accepted' },
  { id: 'sample-my-application-2', recruitmentId: 'campus-app', title: '캠퍼스 생활 개선 앱, 백엔드 개발자를 찾습니다', applicantId: 'me', applicantName: '플랑크톤', introduction: '사용하기 쉬운 교내 서비스를 팀과 함께 만들고 싶어요.', status: 'pending' },
]

function readStorage(key, fallback) {
  // Next.js can render on the server, where browser storage is unavailable.
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function loadRecruitments() {
  const saved = readStorage(STORAGE_KEY, null)
  if (!saved) {
    if (typeof window !== 'undefined') window.localStorage.setItem(SAMPLE_VERSION_KEY, '4')
    return sampleRecruitments.map((item, index) => ({ ...item, createdAt: sampleRecruitments.length - index }))
  }

  const normalized = saved.map((item) => item.id === 'junction-asia' && !item.owner ? { ...item, owner: 'me' } : item)

  // Add the new examples once for people who already opened an earlier preview.
  if (typeof window !== 'undefined' && window.localStorage.getItem(SAMPLE_VERSION_KEY) !== '4') {
    const savedIds = new Set(normalized.map((item) => item.id))
    const addedSamples = sampleRecruitments
      .filter((item) => !savedIds.has(item.id))
      .map((item, index) => ({ ...item, createdAt: -index - 1 }))
    window.localStorage.setItem(SAMPLE_VERSION_KEY, '4')
    return [...normalized, ...addedSamples]
  }

  return normalized
}

function loadApplications() {
  const saved = readStorage(APPLICATIONS_KEY, null)
  if (!saved) {
    if (typeof window !== 'undefined') window.localStorage.setItem(APPLICATIONS_SEED_VERSION_KEY, '1')
    return sampleApplications
  }

  // Older previews stored a contact field. Applications now use the applicant profile instead.
  const normalized = saved.map(({ contact, ...application }) => ({
    ...application,
    applicantId: application.applicantId ?? 'me',
    applicantName: application.applicantName ?? '플랑크톤',
    status: application.status ?? 'pending',
  }))

  if (typeof window !== 'undefined' && window.localStorage.getItem(APPLICATIONS_SEED_VERSION_KEY) !== '1') {
    const savedIds = new Set(normalized.map((application) => application.id))
    const newExamples = sampleApplications.filter((application) => !savedIds.has(application.id))
    window.localStorage.setItem(APPLICATIONS_SEED_VERSION_KEY, '1')
    return [...normalized, ...newExamples]
  }

  return normalized
}

function PageHeading({ eyebrow, title, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>
}

function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('이 사진 파일은 열 수 없어요.'))
      image.onload = () => {
        const maxSide = 1200
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.78))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function BoardPage({ recruitments, onCreate, onOpen }) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('latest')
  const [visibleCount, setVisibleCount] = useState(6)
  const availableCategories = useMemo(() => [...new Set([...categories, ...recruitments.map((item) => item.category)])], [recruitments])
  useEffect(() => setVisibleCount(6), [category, query])
  const visibleRecruitments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return recruitments
      .filter((item) => category === '전체' || item.category === category)
      .filter((item) => !normalizedQuery || `${item.title} ${item.organizer} ${item.roles.join(' ')}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => sort === 'deadline' ? a.daysLeft - b.daysLeft : b.createdAt - a.createdAt)
  }, [recruitments, category, query, sort])
  const shownRecruitments = visibleRecruitments.slice(0, visibleCount)

  return <main className="main-content" id="board">
    <PageHeading eyebrow="RECRUITMENT BOARD" title="모집 공고"><button className="button button--primary" onClick={onCreate}><span>＋</span> 공고 작성</button></PageHeading>
    <section className="filter-bar" aria-label="공고 검색 및 필터">
      <div className="category-tabs">{availableCategories.map((item) => <button key={item} className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대회명, 역할로 검색" aria-label="대회명, 역할로 검색" /></label>
    </section>
    <div className="results-row"><span>전체 <strong>{visibleRecruitments.length}개</strong>의 공고</span><label><span className="sr-only">정렬 순서</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">최신 등록순</option><option value="deadline">마감 임박순</option></select></label></div>
    {shownRecruitments.length ? <div className="recruitment-grid">{shownRecruitments.map((item) => <RecruitmentCard key={item.id} recruitment={item} onOpen={onOpen} />)}</div> : <div className="empty-state"><strong>검색 결과가 없어요.</strong><span>다른 단어로 검색하거나 전체 공고를 확인해 보세요.</span></div>}
    {visibleRecruitments.length > shownRecruitments.length && <div className="board-more"><button onClick={() => setVisibleCount((count) => count + 6)}>모집 공고 더 보기 <b aria-hidden="true">→</b></button></div>}
  </main>
}

function getRecruitmentForm(recruitment) {
  if (!recruitment) return { category: '해커톤', customCategory: '', organizer: '', daysLeft: '', url: '', title: '', people: '', contact: '', content: '', roles: '', image: '' }
  const hasPresetCategory = categories.slice(1).includes(recruitment.category)
  return {
    category: hasPresetCategory ? recruitment.category : '직접 입력',
    customCategory: hasPresetCategory ? '' : recruitment.category,
    organizer: recruitment.organizer ?? '',
    daysLeft: String(recruitment.daysLeft ?? ''),
    url: recruitment.url ?? '',
    title: recruitment.title ?? '',
    people: String(recruitment.people ?? ''),
    contact: recruitment.contact ?? '',
    content: recruitment.content ?? '',
    roles: (recruitment.roles ?? []).join(', '),
    image: recruitment.image ?? '',
  }
}

function CreatePage({ initialRecruitment, onSave, onCancel }) {
  const isEditing = Boolean(initialRecruitment)
  const [form, setForm] = useState(() => getRecruitmentForm(initialRecruitment))
  const [error, setError] = useState('')
  const imageInput = useRef(null)
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function updateImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('이미지 파일을 선택해 주세요.'); return }
    if (file.size > 8 * 1024 * 1024) { setError('사진은 8MB 이하로 선택해 주세요.'); return }
    try {
      const image = await prepareImage(file)
      setForm((current) => ({ ...current, image }))
      setError('')
    } catch (imageError) {
      setError(imageError.message)
    }
  }
  function submit(event) {
    event.preventDefault()
    if (form.url && !/^https?:\/\//i.test(form.url)) { setError('URL은 https:// 또는 http://로 시작해야 해요.'); return }
    if (form.category === '직접 입력' && !form.customCategory.trim()) { setError('공고 카테고리를 입력해 주세요.'); return }
    setError('')
    const { customCategory, ...recruitment } = form
    onSave({ ...recruitment, category: form.category === '직접 입력' ? customCategory.trim() : form.category, people: form.people.trim(), daysLeft: Number(form.daysLeft), roles: form.roles.split(',').map((role) => role.trim()).filter(Boolean) })
  }
  return <main className="form-page"><div className="form-intro"><p className="eyebrow">{isEditing ? 'EDIT RECRUITMENT' : 'NEW RECRUITMENT'}</p><h1>{isEditing ? '모집 공고 수정' : '모집 공고 작성'}</h1><p>함께 도전할 팀원에게 필요한 정보를 알려주세요.</p></div>
    <form className="recruitment-form" onSubmit={submit}>
      <section className="form-section"><div className="section-title"><span>01</span><div><h2>대회 정보</h2><p>참여하려는 대회의 기본 정보를 입력해 주세요.</p></div></div>
        <label>대회명<input required name="organizer" value={form.organizer} onChange={update} placeholder="대회명을 입력해 주세요" /></label>
        <div className="form-columns"><label>공고 카테고리<select name="category" value={form.category} onChange={update}><option>해커톤</option><option>공모전</option><option>프로젝트</option><option>기타</option><option value="직접 입력">직접 입력</option></select></label><label>모집 마감까지 남은 일수<input required name="daysLeft" type="number" min="0" value={form.daysLeft} onChange={update} placeholder="예: 7" /></label></div>
        {form.category === '직접 입력' && <label>직접 입력 카테고리<input required maxLength="20" name="customCategory" value={form.customCategory} onChange={update} placeholder="예: 스터디, 봉사활동" /></label>}
        <label>원문 대회 URL<input name="url" type="url" value={form.url} onChange={update} placeholder="https://" /></label>
      </section>
      <section className="form-section"><div className="section-title"><span>02</span><div><h2>모집 정보</h2><p>공고를 보는 팀원이 필요한 내용을 작성해 주세요.</p></div></div>
        <label>공고 제목<input required name="title" maxLength="80" value={form.title} onChange={update} placeholder="지원자가 한눈에 이해할 수 있는 제목을 작성해 주세요" /></label>
        <div className="form-columns"><label>모집 인원<input required maxLength="30" name="people" value={form.people} onChange={update} placeholder="예: 2명, 3~5명, 제한 없음" /></label><label>연락 수단<input required name="contact" value={form.contact} onChange={update} placeholder="이메일 또는 연락처" /></label></div>
        <label>모집 분야 직접 입력<input name="roles" value={form.roles} onChange={update} placeholder="쉼표로 나눠 입력해 주세요 (예: 기획, 프론트엔드)" /></label>
        <div className="image-upload"><span className="image-upload__label">공고 사진 <small>선택 사항 · 8MB 이하</small></span><input ref={imageInput} type="file" accept="image/*" onChange={updateImage} aria-label="공고 사진 선택" />{form.image && <div className="image-preview"><img src={form.image} alt="선택한 공고 사진 미리보기" /><button type="button" className="button button--outline" onClick={() => { setForm((current) => ({ ...current, image: '' })); if (imageInput.current) imageInput.current.value = '' }}>사진 제거</button></div>}</div>
        <label>모집 내용<textarea required minLength="10" name="content" value={form.content} onChange={update} placeholder="프로젝트 소개, 필요한 역할, 활동 계획 등을 자유롭게 작성해 주세요." /></label>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button button--outline" onClick={onCancel}>취소</button><button className="button button--primary">{isEditing ? '수정 내용 저장' : '공고 등록하기'} <span>→</span></button></div>
    </form>
  </main>
}

function PasswordChangeForm() {
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [message, setMessage] = useState('')
  function submit(event) {
    event.preventDefault()
    if (passwords.next !== passwords.confirm) {
      setMessage('새 비밀번호와 확인 값이 일치하지 않아요.')
      return
    }
    setMessage('비밀번호 변경 화면은 준비됐어요. 실제 변경은 백엔드 비밀번호 변경 API 연결 후 사용할 수 있어요.')
  }
  return <form className="password-change-form" onSubmit={submit}>
    <label>현재 비밀번호<input required type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></label>
    <label>새 비밀번호<input required type="password" minLength="10" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} /></label>
    <label>새 비밀번호 확인<input required type="password" minLength="10" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} /></label>
    {message && <p className="password-change-message" role="status">{message}</p>}
    <button className="button button--primary">비밀번호 변경</button>
  </form>
}

function getApplicationStatusLabel(status) {
  if (status === 'accepted') return '수락'
  if (status === 'rejected') return '거절'
  return '검토 중'
}

function MyPage({ recruitments, applications, onDelete, onOpenPost, onEditPost, onDecideApplication, onLogout, onWithdraw }) {
  const [tab, setTab] = useState('posts')
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [profile, setProfile] = useState(() => readStorage('haema-profile-v1', { name: '플랑크톤', email: 'haemin@university.ac.kr', major: '프론트엔드, 백엔드', skills: 'Python, Spring Boot', awards: '' }))
  const mine = recruitments.filter((item) => item.owner === 'me')
  const myApplications = applications.filter((application) => application.applicantId === 'me')
  return <main className="dashboard"><aside className="sidebar"><div className="profile-summary"><div className="profile-avatar">플</div><span>반가워요,</span><strong>{profile.name}</strong><small>{profile.email}</small></div><nav aria-label="마이페이지 메뉴">{[['profile', '프로필 관리'], ['password', '비밀번호 변경'], ['posts', `내가 작성한 공고  ${mine.length}`], ['applications', `내가 지원한 공고  ${myApplications.length}`]].map(([key, label]) => <button key={key} className={tab === key ? 'is-selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav><div className="account-actions"><span>계정</span><button onClick={onLogout}>로그아웃</button><button className="account-actions__withdraw" onClick={onWithdraw}>회원 탈퇴</button></div></aside>
    <section className="dashboard-content"><p className="eyebrow">MY HAEMA</p><div className="dashboard-heading"><h1>{tab === 'profile' ? '프로필 관리' : tab === 'password' ? '비밀번호 변경' : tab === 'posts' ? '내가 작성한 공고' : '내가 지원한 공고'}</h1><p>작성한 공고와 지원 현황을 관리해요.</p></div>
      {tab === 'profile' ? <form className="profile-form" onSubmit={(event) => { event.preventDefault(); window.localStorage.setItem('haema-profile-v1', JSON.stringify(profile)); alert('프로필을 저장했어요. 이 브라우저에만 저장됩니다.') }}><div className="profile-avatar profile-avatar--large">플</div><div className="profile-fields">{[['email', '이메일'], ['major', '전공'], ['skills', '기술 스택'], ['awards', '수상 경력']].map(([key, label]) => <label key={key}>{label}<input value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}<button className="button button--primary">변경사항 저장</button></div></form>
      : tab === 'password' ? <PasswordChangeForm />
      : tab === 'posts' ? <div className="owned-list">{mine.length ? mine.map((item) => {
        const applicants = applications.filter((application) => application.recruitmentId === item.id && application.applicantId !== 'me')
        return <article className="owned-card owned-card--post" key={item.id}>
          <div className="owned-card__details"><span className={`category ${categoryClassName(item.category)}`}>{item.category} · D-{item.daysLeft}</span><button className="owned-card__open owned-card__post-title" onClick={() => onOpenPost(item)}><strong>{item.title}</strong><span>공고 상세 보기 →</span></button><p>{item.organizer}</p>
            <section className="applicant-section"><h3>지원자 목록 <span>{applicants.length}명</span></h3>{applicants.length ? applicants.map((application) => <article className="applicant-row" key={application.id}><div className="applicant-row__info"><strong>{application.applicantName}</strong><p>{application.introduction}</p></div><div className="applicant-row__actions">{application.status === 'pending' ? <><button className="button button--outline button--danger" onClick={() => onDecideApplication(application.id, 'rejected')}>거절</button><button className="button button--primary" onClick={() => onDecideApplication(application.id, 'accepted')}>수락</button></> : <span className={`application-status application-status--${application.status}`}>{getApplicationStatusLabel(application.status)}</span>}</div></article>) : <p className="applicant-empty">아직 지원자가 없어요.</p>}</section>
          </div><div className="owned-card__actions"><button className="button button--outline" onClick={() => onEditPost(item)}>수정</button><button className="button button--outline button--danger" onClick={() => onDelete(item.id)}>삭제</button></div>
        </article>
      }) : <div className="empty-state"><strong>아직 작성한 공고가 없어요.</strong><span>새 공고를 작성하면 이곳에서 관리할 수 있어요.</span></div>}</div>
      : <div className="owned-list">{myApplications.length ? myApplications.map((item) => <article className="owned-card" key={item.id}><div><span className={`application-status application-status--${item.status}`}>{getApplicationStatusLabel(item.status)}</span><h2>{item.title}</h2></div><button className="button button--outline" onClick={() => setSelectedApplication(item)}>지원 결과 보기 →</button></article>) : <div className="empty-state"><strong>아직 지원한 공고가 없어요.</strong><span>관심 있는 공고를 찾아 지원해 보세요.</span></div>}</div>}
    </section>
    {selectedApplication && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedApplication(null) }}><section className="application-detail" role="dialog" aria-modal="true" aria-labelledby="application-title"><button className="modal-close modal-close--light" onClick={() => setSelectedApplication(null)} aria-label="닫기">×</button><p className="eyebrow">APPLICATION RESULT</p><h2 id="application-title">지원 결과</h2><p className="form-context">{selectedApplication.title}</p><span className={`application-status application-status--${selectedApplication.status}`}>{getApplicationStatusLabel(selectedApplication.status)}</span><h3>내 지원서</h3><p className="application-detail__text">{selectedApplication.introduction}</p><button className="button button--outline" onClick={() => setSelectedApplication(null)}>닫기</button></section></div>}
    </main>
}

function AuthPage({ mode, onSwitch, onDone }) {
  const isSignup = mode === 'signup'
  return <main className="auth-page"><section className="auth-brand-panel"><p className="eyebrow">UNIVERSITY TEAM BUILDING</p><h1>좋은 도전에는,<br /><strong>좋은 팀</strong>이 필요하니까.</h1><p>해커톤 · 공모전 · 프로젝트를 함께 할 팀원을 해마에서 만나보세요.</p></section><form className="auth-form" onSubmit={(event) => { event.preventDefault(); alert('데모 화면이에요. 실제 계정 인증 기능은 서버 연결이 필요합니다.'); onDone() }}><p className="eyebrow">{isSignup ? 'JOIN HAEMA' : 'WELCOME BACK'}</p><h2>{isSignup ? '새로운 도전을 시작해요.' : '다시 만나서 반가워요.'}</h2><p>{isSignup ? '이메일 인증으로 안전하게 가입할 수 있어요.' : '이메일로 로그인해 주세요.'}</p><label>이메일<input required type="email" placeholder="name@school.ac.kr" /></label><label>비밀번호<input required type="password" minLength="8" placeholder="비밀번호를 입력해 주세요" /></label>{isSignup && <><label>비밀번호 확인<input required type="password" minLength="8" placeholder="비밀번호를 다시 입력해 주세요" /></label><label>전공<input placeholder="예: 프론트엔드, 백엔드" /></label><label>기술 스택<input placeholder="예: Python, Spring Boot" /></label></>}<button className="button button--primary auth-submit">{isSignup ? '회원가입 완료' : '로그인'} <span>→</span></button><p className="auth-switch">{isSignup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'} <button type="button" onClick={onSwitch}>{isSignup ? '로그인' : '회원가입'}</button></p></form></main>
}

export default function App() {
  const [page, setPage] = useState('board')
  const [recruitments, setRecruitments] = useState(loadRecruitments)
  const [applications, setApplications] = useState(loadApplications)
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(null)
  const [editingRecruitment, setEditingRecruitment] = useState(null)

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recruitments)) }, [recruitments])
  useEffect(() => { window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications)) }, [applications])

  function saveRecruitment(form) {
    if (editingRecruitment) {
      setRecruitments((current) => current.map((item) => item.id === editingRecruitment.id
        ? { ...item, ...form, description: form.content.slice(0, 90), updatedAt: Date.now() }
        : item))
      setEditingRecruitment(null)
      setPage('mypage')
      return
    }
    const newRecruitment = { ...form, id: `post-${Date.now()}`, description: form.content.slice(0, 90), owner: 'me', createdAt: Date.now() }
    setRecruitments((current) => [newRecruitment, ...current])
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
  function submitApplication(form) {
    setApplications((current) => [{ ...form, id: `application-${Date.now()}`, recruitmentId: applying.id, title: applying.title, applicantId: 'me', applicantName: '플랑크톤', status: 'pending' }, ...current])
    setApplying(null)
    setSelected(null)
    alert('지원서를 저장했어요. (데모 화면에서는 이 브라우저에만 저장됩니다.)')
  }
  function deleteRecruitment(id) {
    if (!window.confirm('이 공고를 삭제할까요?')) return
    setRecruitments((current) => current.filter((item) => item.id !== id))
    setApplications((current) => current.filter((application) => application.recruitmentId !== id))
  }
  function decideApplication(id, status) {
    setApplications((current) => current.map((application) => application.id === id ? { ...application, status } : application))
  }
  function logOut() {
    if (!window.confirm('로그아웃할까요?')) return
    window.localStorage.removeItem('haema-access-token')
    window.localStorage.removeItem('haema-user-id')
    setPage('login')
  }
  async function withdrawAccount() {
    if (!window.confirm('회원 탈퇴를 진행할까요? 탈퇴하면 계정 정보와 작성한 공고, 지원 내역을 복구할 수 없어요.')) return

    const accessToken = window.localStorage.getItem('haema-access-token')
    if (accessToken) {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
        const response = await fetch(`${apiBaseUrl}/common/account`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result.error || '회원 탈퇴를 처리하지 못했어요.')
        }
      } catch (error) {
        window.alert(error.message || '백엔드 서버에 연결하지 못했어요.')
        return
      }
    }

    setRecruitments((current) => current.filter((item) => item.owner !== 'me'))
    setApplications([])
    window.localStorage.removeItem('haema-profile-v1')
    window.localStorage.removeItem('haema-access-token')
    window.localStorage.removeItem('haema-user-id')
    setPage('login')
    window.alert(accessToken ? '회원 탈퇴가 완료됐어요.' : '미리보기 계정의 공고와 지원 내역을 지웠어요. 실제 계정 탈퇴는 로그인과 백엔드 연결 후 사용할 수 있어요.')
  }

  return <><Header page={page} onNavigate={(nextPage) => { if (nextPage !== 'create') setEditingRecruitment(null); setPage(nextPage) }} />
    {page === 'board' && <BoardPage recruitments={recruitments} onCreate={startNewRecruitment} onOpen={setSelected} />}
    {page === 'create' && <CreatePage initialRecruitment={editingRecruitment} onSave={saveRecruitment} onCancel={() => { setPage(editingRecruitment ? 'mypage' : 'board'); setEditingRecruitment(null) }} />}
    {page === 'mypage' && <MyPage recruitments={recruitments} applications={applications} onDelete={deleteRecruitment} onOpenPost={setSelected} onEditPost={startEditingRecruitment} onDecideApplication={decideApplication} onLogout={logOut} onWithdraw={withdrawAccount} />}
    {(page === 'login' || page === 'signup') && <AuthPage mode={page} onSwitch={() => setPage(page === 'login' ? 'signup' : 'login')} onDone={() => setPage('board')} />}
    <Footer onNavigate={setPage} />
    <RecruitmentModal recruitment={selected} isOwner={selected?.owner === 'me'} onClose={() => setSelected(null)} onApply={(item) => { if (item.owner !== 'me') setApplying(item) }} />
    <ApplyModal recruitment={applying} onClose={() => setApplying(null)} onSubmit={submitApplication} />
  </>
}
