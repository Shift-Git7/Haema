import { categoryClassName, formatPeople } from "../data/recruitments.js";

export default function RecruitmentModal({
  recruitment,
  onClose,
  onApply,
  isOwner = false,
}) {
  if (!recruitment) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="detail-modal__banner">
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
          <span
            className={`category ${categoryClassName(recruitment.category)}`}
          >
            {recruitment.category} · D-{recruitment.daysLeft}
          </span>
          <h2 id="detail-title">{recruitment.title}</h2>
          <p>{recruitment.organizer}</p>
        </div>
        <div className="detail-modal__body">
          <div>
            <h3>모집 내용</h3>
            <p>{recruitment.content}</p>
            <h3>원문 대회 URL</h3>
            <a
              className="text-link"
              href={recruitment.url}
              target="_blank"
              rel="noreferrer"
            >
              대회 공식 페이지 바로가기 ↗
            </a>
            <h3>연락 수단</h3>
            <p>{recruitment.contact}</p>
          </div>
          <aside className="apply-panel">
            <p>
              모집 인원 <strong>{formatPeople(recruitment.people)}</strong>
            </p>
            <p>
              모집 마감 <strong>D-{recruitment.daysLeft}</strong>
            </p>
            <button
              className="button button--primary"
              disabled={isOwner}
              onClick={() => onApply(recruitment)}
            >
              {isOwner ? (
                "내가 작성한 공고예요"
              ) : (
                <>
                  지원하기 <span>→</span>
                </>
              )}
            </button>
            {isOwner && (
              <p className="owner-note">작성한 공고에는 지원할 수 없어요.</p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
