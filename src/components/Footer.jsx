import Brand from "./Brand.jsx";

export default function Footer({ onNavigate }) {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <Brand footer onHome={() => onNavigate("board")} />
        <p>대학생의 도전이 좋은 팀을 만나는 곳</p>
        <small>© 2025 HAEMA. All rights reserved.</small>
      </div>
    </footer>
  );
}
