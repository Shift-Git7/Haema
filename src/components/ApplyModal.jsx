import { useState } from "react";

export default function ApplyModal({ recruitment, onClose, onSubmit }) {
  const [introduction, setIntroduction] = useState("");
  if (!recruitment) return null;
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ introduction });
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="apply-modal" onSubmit={handleSubmit}>
        <button
          type="button"
          className="modal-close modal-close--light"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <p className="eyebrow">APPLICATION</p>
        <h2>지원서 작성</h2>
        <p className="form-context">{recruitment.title}</p>
        <label>
          자기소개
          <textarea
            required
            minLength="10"
            value={introduction}
            onChange={(event) => setIntroduction(event.target.value)}
            placeholder="함께하고 싶은 이유와 간단한 자기소개를 작성해 주세요."
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={onClose}
          >
            취소
          </button>
          <button className="button button--primary">
            지원서 제출 <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
