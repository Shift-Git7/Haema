import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

function App() {
  return (
    <main className="page">
      <nav className="nav">
        <a className="brand" href="/">해마<span>.</span></a>
        <div className="nav-links">
          <a href="#clubs">모집 공고</a>
          <a href="#about">서비스 소개</a>
        </div>
        <button className="login">로그인</button>
      </nav>

      <section className="hero" id="about">
        <p className="eyebrow">함께할 동아리를 찾고 있나요?</p>
        <h1>좋아하는 마음으로<br />시작하는 <em>새로운 만남</em></h1>
        <p className="intro">해마에서 나와 꼭 맞는 동아리와 지원자를 만나보세요.</p>
        <a className="cta" href="#clubs">모집 공고 둘러보기 <span aria-hidden="true">↗</span></a>
        <div className="hero-note"><span className="dot" /> 지금 새로운 인연을 만나보세요</div>
      </section>

      <section className="list" id="clubs">
        <div><p className="eyebrow">FIND YOUR PEOPLE</p><h2>지금 모집 중인 동아리</h2></div>
        <p className="empty">새로운 모집 공고가 곧 올라올 예정이에요.</p>
      </section>
      <footer>해마 <span>·</span> 마음 맞는 사람들과 함께</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
)
