import { useState } from 'react'

export default function AccountActionModal({ mode, onClose, onConfirm }) {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isWithdraw = mode === 'withdraw'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onConfirm()
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
          {isWithdraw
            ? <p className="account-action-message">회원 탈퇴 후에는 계정과 활동 정보를 복구할 수 없어요.</p>
            : <p className="account-action-message">다시 이용하려면 로그인해야 해요.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button button--outline" onClick={onClose} disabled={isSubmitting}>취소</button><button className={`button ${isWithdraw ? 'button--outline button--danger' : 'button--primary'}`} disabled={isSubmitting}>{isSubmitting ? '처리 중…' : isWithdraw ? '탈퇴하기' : '로그아웃'}</button></div>
        </form>
      </section>
    </div>
  )
}
