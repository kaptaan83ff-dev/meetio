// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GoogleOAuthButton } from './GoogleOAuthButton';
import { getGoogleOAuthAuthorizeUrl } from './googleOAuthUrl';

describe('GoogleOAuthButton', () => {
  it('builds the google oauth authorize url', () => {
    expect(getGoogleOAuthAuthorizeUrl()).toContain('/v1/auth/google/authorize');
  });

  it('invokes the redirect handler with the authorize endpoint', async () => {
    const user = userEvent.setup();
    const onRedirect = vi.fn();

    render(<GoogleOAuthButton onRedirect={onRedirect} />);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(onRedirect).toHaveBeenCalledWith(expect.stringContaining('/v1/auth/google/authorize'));
  });
});
