/// <reference types="vite/client" />
declare module '*.css';

declare module 'virtual:vrm-models' {
  export interface VrmModelInfo {
    id: string;
    label: string;
    character: string;
    fileName: string;
    url: string;
    icon: string;
  }
  const models: VrmModelInfo[];
  export default models;
}
