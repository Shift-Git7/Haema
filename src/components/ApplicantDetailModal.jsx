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
      <section className="detail-modal applicant-profile-modal" role="dialog" aria-modal="true" aria-labelledby="applicant-detail-title">
        <header className="detail-modal__banner"><button className="modal-close" onClick={onClose} aria-label="닫기">×</button><p className="eyebrow">APPLICANT PROFILE</p><h2 id="applicant-detail-title">{applicant.displayName}</h2><p>{applicant.title}</p></header>
        <div className="applicant-profile-body"><h3>전공</h3><p>{applicant.major || '등록된 전공이 없어요.'}</p><h3>기술 스택</h3><p>{applicant.skills || '등록한 기술 스택이 없어요.'}</p><h3>수상 경력</h3><p>{applicant.awards || '등록한 수상 경력이 없어요.'}</p><h3>지원자가 작성한 글</h3><p className="applicant-profile-body__intro">{applicant.introduction || '작성한 소개가 없어요.'}</p><button className="button button--outline" onClick={onClose}>닫기</button></div>
      </section>
    </div>
  );
}
