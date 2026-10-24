import { describe, it, expect } from 'vitest';
import { SIGN_IN_DESTINATION } from './account-navigation';
describe('Sign-in destination', () => {
  it('sends both tenant and admin sign-ins to dashboard', () => {
    expect(SIGN_IN_DESTINATION).toBe('/dashboard');
  });
});