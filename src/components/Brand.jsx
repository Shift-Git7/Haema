export default function Brand({ footer = false, onHome }) {
  return (
    <a
      className={`brand${footer ? " brand--footer" : ""}`}
      href="#board"
      aria-label="해마 홈"
      onClick={
        onHome
          ? (event) => {
              event.preventDefault();
              onHome();
            }
          : undefined
      }
    >
      <img
        src="/images/logo/logo.svg"
        alt=""
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <span className="brand__name">해마</span>
      <span className="brand__english">HAEMA</span>
    </a>
  );
}
