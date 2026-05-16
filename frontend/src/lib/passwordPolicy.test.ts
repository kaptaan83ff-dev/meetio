import { describe, expect, it } from 'vitest';

import {
  getPasswordPolicyError,
  getPasswordPolicyState,
  hasNumber,
  hasSymbol,
  hasUppercase,
} from './passwordPolicy';

describe('passwordPolicy', () => {
  it('checks uppercase, number, and symbol rules', () => {
    expect(hasUppercase('abcD')).toBe(true);
    expect(hasUppercase('abcd')).toBe(false);
    expect(hasNumber('abc1')).toBe(true);
    expect(hasNumber('abcd')).toBe(false);
    expect(hasSymbol('abc!')).toBe(true);
    expect(hasSymbol('abc1')).toBe(false);
  });

  it('returns the first failing password rule', () => {
    expect(getPasswordPolicyError('sh1A!')).toBe('Password must be at least 8 characters long.');
    expect(getPasswordPolicyError('lowercase12!')).toBe('Password must include at least one uppercase letter.');
    expect(getPasswordPolicyError('NoDigitsHere!')).toBe('Password must include at least one number.');
    expect(getPasswordPolicyError('Password123')).toBe('Password must include at least one special character.');
  });

  it('tracks the rule state for the strength meter', () => {
    expect(getPasswordPolicyState('abc')).toMatchObject({
      lengthOk: false,
      uppercaseOk: false,
      numberOk: false,
      symbolOk: false,
      metRules: 0,
      isStrong: false,
    });
    expect(getPasswordPolicyState('Abcdef12!')).toMatchObject({
      lengthOk: true,
      uppercaseOk: true,
      numberOk: true,
      symbolOk: true,
      metRules: 4,
      isStrong: true,
    });
  });
});
