/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_APP_CLIENT_ID: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_REDIRECT: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AI_API_ENDPOINT: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_PLATFORM_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
