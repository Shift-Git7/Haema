import { HttpError } from './errors.js';
const fail = (message) => { throw new HttpError(400, 'INVALID_INPUT', message); };
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('올바른 UUID가 필요합니다.');
  return value;
}
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('JSON 객체가 필요합니다.');
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('허용되지 않은 필드가 있습니다.');
}
export function boardInput(value, partial = false) {
  const mapping = {eventName:'event_name',deadline:'deadline',sourceUrl:'source_url',title:'title',recruitingContent:'recruiting_content',recruitmentCount:'recruitment_count',contactEmail:'contact_email'};
  object(value,Object.keys(mapping));
  if (!Object.keys(value).length) fail('작성 또는 수정할 내용을 입력해 주세요.');
  const result = {};
  for (const [field, column] of Object.entries(mapping)) {
    if (!(field in value)) { if (!partial) fail(`${field} 필드가 필요합니다.`); continue; }
    const item = value[field];
    if (field === 'recruitmentCount') {
      if (!Number.isInteger(item) || item < 1 || item > 100) fail('모집 인원은 1~100 사이 정수여야 합니다.');
      result[column] = item; continue;
    }
    const max = {eventName:200,deadline:10,sourceUrl:2048,title:200,recruitingContent:10000,contactEmail:254}[field];
    if (typeof item !== 'string' || !item.trim() || item.trim().length > max) fail(`${field} 길이를 확인해 주세요.`);
    result[column] = item.trim();
    if (field === 'deadline') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result[column]) || !Number.isFinite(Date.parse(result[column])) || new Date(result[column]).toISOString().slice(0,10) !== result[column] || result[column] < '0001-01-01') fail('마감일은 유효한 YYYY-MM-DD 날짜여야 합니다.');
    }
    if (field === 'sourceUrl') {
      let url;
      try { url = new URL(result[column]); } catch { fail('올바른 대회 URL이 필요합니다.'); }
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) fail('HTTP(S) 대회 URL이 필요합니다.');
    }
    if (field === 'contactEmail' && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(result[column])) fail('올바른 연락 이메일이 필요합니다.');
  }
  return result;
}
export function pagination(query, extra = []) {
  object(query,['limit','offset',...extra]);
  const number = (value, fallback, min, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) fail('페이지 값은 정수여야 합니다.');
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) fail('페이지 범위를 확인해 주세요.');
    return n;
  };
  return {limit:number(query.limit,20,1,100),offset:number(query.offset,0,0,100000)};
}
export function decision(value) {
  object(value,['status']);
  if (!['accepted','rejected'].includes(value.status)) fail('status는 accepted 또는 rejected여야 합니다.');
  return value.status;
}
