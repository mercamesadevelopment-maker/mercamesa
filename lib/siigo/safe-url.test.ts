import { describe, expect, it } from 'vitest';
import { safeHttpsUrl } from './safe-url';

describe('safeHttpsUrl', () => {
  it('deja pasar solo https', () => {
    expect(safeHttpsUrl('https://reportsexcelprod.blob.core.windows.net/a/b.xlsx')).toBe(
      'https://reportsexcelprod.blob.core.windows.net/a/b.xlsx'
    );
    for (const malo of ['http://x.com', 'javascript:alert(1)', 'no es url', 42, null, undefined]) {
      expect(safeHttpsUrl(malo)).toBeNull();
    }
  });
});
