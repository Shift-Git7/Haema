export function getPasswordPolicyErrors(password) {
  if (typeof password !== 'string') return ['비밀번호를 입력해 주세요.'];

  const errors = [];
  if (password.length < 10) errors.push('비밀번호는 10자 이상이어야 합니다.');
  if (!/[A-Z]/.test(password)) errors.push('영어 대문자를 1개 이상 포함해야 합니다.');
  if (!/[a-z]/.test(password)) errors.push('영어 소문자를 1개 이상 포함해야 합니다.');
  if (!/[0-9]/.test(password)) errors.push('숫자를 1개 이상 포함해야 합니다.');
  if (!/[!@#$%^&*]/.test(password)) errors.push('특수기호 !@#$%^&* 중 1개 이상 포함해야 합니다.');
  return errors;
}
