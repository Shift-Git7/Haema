export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function checkDb(error) {
  if (!error) return;
  const codes = {
    P0002: [404, 'NOT_FOUND', '대상을 찾을 수 없습니다.'],
    '42501': [403, 'FORBIDDEN', '접근 권한이 없습니다.'],
    '23505': [409, 'CONFLICT', '이미 등록된 항목입니다.'],
    '23514': [409, 'CONFLICT', '모집 인원 또는 지원 상태를 확인해 주세요.'],
    '22023': [400, 'INVALID_INPUT', '입력값을 확인해 주세요.']
  };
  const mapped = codes[error.code];
  if (mapped) throw new HttpError(...mapped);
  throw new HttpError(503, 'DATABASE_UNAVAILABLE', '데이터 처리에 실패했습니다.');
}
