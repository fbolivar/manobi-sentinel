/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_TILES_URL?: string;
  readonly VITE_GEOSERVER_URL?: string;
  readonly VITE_LOCAL_TILES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
