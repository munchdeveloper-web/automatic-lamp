/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_MUNCH_API_URL?: string;
  readonly VITE_MUNCH_REAL_PHOTOS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
