import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { clearToasts } from '@/lib/toast';

afterEach(() => {
  cleanup();
  clearToasts();
});
