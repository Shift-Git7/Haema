import { categoryClassName, formatPeople } from '../data/recruitments.js'

export default function RecruitmentCard({ recruitment, onOpen }) {
  return (
    <article className="recruitment-card">
      <div className="recruitment-card__top"><span className={`category ${categoryClassName(recruitment.category)}`}>{recruitment.category}</span><span className="days-left">D-{recruitment.daysLeft}</span></div>
      <button className="recruitment-card__title" onClick={() => onOpen(recruitment)}>{recruitment.title}</button>
      <p className="recruitment-card__organizer">{recruitment.organizer}</p>
      <p className="recruitment-card__description">{recruitment.description}</p>
      <div className="tag-list">{recruitment.roles.map((role) => <span className="tag" key={role}>#{role}</span>)}</div>
      <div className="recruitment-card__bottom"><span>♧ &nbsp;{formatPeople(recruitment.people)} 모집</span><button className="round-arrow" aria-label="공고 상세 보기" onClick={() => onOpen(recruitment)}>→</button></div>
    </article>
  )
}
