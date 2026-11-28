import { useState } from "react";

export default function ApplyModal({ recruitment, onClose, onSubmit }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!recruitment) return null;
  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    Promise.resolve(onSubmit({ content }))
      .catch((requestError) => setError(requestError.message || "지원서를 보내지 못했어요."))
      .finally(() => setBusy(false));
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="apply-modal" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="application-title">
        <button
          type="button"
          className="modal-close modal-close--light"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <p className="eyebrow">APPLICATION</p>
        <h2 id="application-title">지원서 작성</h2>
        <p className="form-context">{recruitment.title}</p>
        <label>
          자기소개
          <textarea
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="함께하고 싶은 이유와 간단한 자기소개를 작성해 주세요."
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={onClose}
          >
            취소
          </button>
          <button className="button button--primary" disabled={busy}>
            {busy ? "제출 중…" : <>지원서 제출 <span>→</span></>}
          </button>
        </div>
      </form>
    </div>
  );
}
