export const categories = ['전체', '해커톤', '공모전', '프로젝트', '기타']

export function categoryClassName(category) {
  return ['해커톤', '공모전', '프로젝트', '기타'].includes(category) ? `category--${category}` : 'category--기타'
}

export function formatPeople(people) {
  const value = String(people ?? '').trim()
  return /^\d+$/.test(value) ? `${value}명` : value
}
