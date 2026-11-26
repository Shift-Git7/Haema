import { useState } from 'react'

export default function AccountActionModal({ mode, email, onClose, onConfirm }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isWithdraw = mode === 'withdraw'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onConfirm(isWithdraw ? password : undefined)
    } catch (requestError) {
      setError(requestError.message || '요청을 처리하지 못했어요.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
      <section className="detail-modal account-action-modal" role="dialog" aria-modal="true" aria-labelledby="account-action-title">
        <header className="detail-modal__banner">
          <button className="modal-close" onClick={onClose} aria-label="닫기" disabled={isSubmitting}>×</button>
          <p className="eyebrow">ACCOUNT</p>
          <h2 id="account-action-title">{isWithdraw ? '회원 탈퇴' : '로그아웃'}</h2>
          <p>{isWithdraw ? '탈퇴하면 계정과 활동 정보를 복구할 수 없어요.' : '현재 계정에서 로그아웃할까요?'}</p>
        </header>
        <form className="account-action-body" onSubmit={submit}>
          {isWithdraw ? <>
            <p className="account-action-email">계정 이메일 <strong>{email}</strong></p>
            <label>비밀번호<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="계정 비밀번호를 입력해 주세요" /></label>
            <p className="account-action-hint">미리보기 계정에서는 비밀번호를 확인하지 않고 이 브라우저의 공고와 지원 내역만 지워요.</p>
          </> : <p className="account-action-message">다시 이용하려면 로그인해야 해요.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button button--outline" onClick={onClose} disabled={isSubmitting}>취소</button><button className={`button ${isWithdraw ? 'button--outline button--danger' : 'button--primary'}`} disabled={isSubmitting}>{isSubmitting ? '처리 중…' : isWithdraw ? '탈퇴하기' : '로그아웃'}</button></div>
        </form>
      </section>
    </div>
  )
}
