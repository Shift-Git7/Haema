import Brand from "./Brand.jsx";

export default function Header({ page, onNavigate }) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Brand onHome={() => onNavigate("board")} />
        <nav className="topbar__nav" aria-label="주요 메뉴">
          <button
            className={page === "board" ? "is-active" : ""}
            onClick={() => onNavigate("board")}
          >
            모집 공고
          </button>
          <button
            className={page === "create" ? "is-active" : ""}
            onClick={() => onNavigate("create")}
          >
            공고 작성
          </button>
        </nav>
        <button
          className="account-pill"
          onClick={() => onNavigate("mypage")}
          aria-label="플랑크톤 마이페이지 열기"
        >
          <span className="account-pill__avatar">플</span>
          <span>플랑크톤</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </header>
  );
}
