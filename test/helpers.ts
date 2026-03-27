// Test helpers for API tests

export function createMockEnv() {
  return {
    DB: createMockD1(),
    FORMULAS: createMockR2(),
    CACHE: createMockKV(),
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    API_VERSION: "v1",
  };
}

function createMockD1() {
  const data: Map<string, unknown[]> = new Map();

  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              return { success: true };
            },
          };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

function createMockR2() {
  const store = new Map<string, ArrayBuffer>();
  return {
    async put(key: string, value: ArrayBuffer) {
      store.set(key, value);
    },
    async get(key: string) {
      const val = store.get(key);
      return val ? { arrayBuffer: async () => val } : null;
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function createMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
