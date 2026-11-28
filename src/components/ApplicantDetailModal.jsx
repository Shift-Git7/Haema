export default function ApplicantDetailModal({ applicant, onClose }) {
  if (!applicant) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="detail-modal applicant-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-detail-title"
      >
        <header className="detail-modal__banner">
          <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
          <p className="eyebrow">APPLICATION</p>
          <h2 id="applicant-detail-title">지원서 내용</h2>
          <p>{applicant.statusLabel ?? applicant.status}</p>
        </header>
        <div className="applicant-profile-body">
          <p className="applicant-profile-body__intro">{applicant.introduction}</p>
          <button className="button button--outline" onClick={onClose}>닫기</button>
        </div>
      </section>
    </div>
  );
}
