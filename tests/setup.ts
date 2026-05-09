import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

beforeAll(() => {
  vi.mock('console', () => ({
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
}) as any;

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
  appendFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ mtimeMs: Date.now() }),
  watch: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  promises: {
    readFile: vi.fn().mockResolvedValue(''),
    stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
  },
}));

declare global {
  namespace NodeJS {
    interface Global {
      fetch: typeof fetch;
    }
  }
}
