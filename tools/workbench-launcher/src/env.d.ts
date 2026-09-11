/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAUNCHER_FIXTURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
