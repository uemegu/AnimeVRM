import '@anime-vrm/content/register';
import '../src/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { configureAssets } from '@anime-vrm/engine/utils/path';
import { Layout } from '../src/components/Layout';
import { DEFAULT_MOTION } from '../src/defaultMotion';
import { LanguageProvider } from '../src/i18n';
import { ViewerView } from '../src/views/viewer/ViewerView';

configureAssets({ idleMotion: DEFAULT_MOTION });

// 公開版はビューアだけ。以前のシーン・再生画面の URL もここへ戻す。
const router = createHashRouter([
  {
    path: '/',
    element: <Layout viewerOnly />,
    children: [
      { index: true, element: <Navigate to="/viewer" replace /> },
      { path: 'viewer', element: <ViewerView /> },
      { path: '*', element: <Navigate to="/viewer" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  </StrictMode>
);
