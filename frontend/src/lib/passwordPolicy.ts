export const PASSWORD_MIN_LENGTH = 8;

export function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

export function hasNumber(password: string): boolean {
  return /\d/.test(password);
}

export function hasSymbol(password: string): boolean {
  return /[^A-Za-z0-9]/.test(password);
}

export function getPasswordPolicyState(password: string) {
  const lengthOk = password.length >= PASSWORD_MIN_LENGTH;
  const uppercaseOk = hasUppercase(password);
  const numberOk = hasNumber(password);
  const symbolOk = hasSymbol(password);
  const metRules = [lengthOk, numberOk, symbolOk, uppercaseOk].filter(Boolean).length;

  return {
    lengthOk,
    uppercaseOk,
    numberOk,
    symbolOk,
    metRules,
    isStrong: lengthOk && uppercaseOk && numberOk && symbolOk,
  };
}

export function getPasswordPolicyError(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters long.';
  }
  if (!hasUppercase(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!hasNumber(password)) {
    return 'Password must include at least one number.';
  }
  if (!hasSymbol(password)) {
    return 'Password must include at least one special character.';
  }
  return '';
}
