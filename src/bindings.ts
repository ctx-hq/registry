import type { UserRow } from "./models/types";

export type Bindings = {
  DB: D1Database;
  FORMULAS: R2Bucket;
  CACHE: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  API_VERSION: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user: UserRow;
  };
};
