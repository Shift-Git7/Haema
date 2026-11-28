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
        src="/images/logo.svg"
        alt="해마 로고"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </a>
  );
}
