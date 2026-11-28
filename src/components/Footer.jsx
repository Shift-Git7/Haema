import Brand from "./Brand.jsx";

export default function Footer({ onNavigate }) {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <Brand footer onHome={() => onNavigate("board")} />
        <p>대덕소프트웨어마이스터고등학교 학생의 도전이 좋은 팀을 만나는 곳</p>
        <small>© {new Date().getFullYear()} HAEMA</small>
      </div>
    </footer>
  );
}
