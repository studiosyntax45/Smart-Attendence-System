
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_COLLEGE_DOMAIN?: string;
  
  readonly VITE_FACE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
