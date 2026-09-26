import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ComingSoon, Layout, NAV_ITEMS } from './components/Layout';
import { LanguageProvider } from './i18n';
import { CharactersView } from './views/characters/CharactersView';
import { ViewerView } from './views/viewer/ViewerView';
import { ScenesView } from './views/scenes/ScenesView';
import { ScenariosView } from './views/scenarios/ScenariosView';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/viewer" replace /> },
      { path: 'viewer', element: <ViewerView /> },
      { path: 'characters/:characterId?', element: <CharactersView /> },
      { path: 'scenes/:tab?/:id?', element: <ScenesView /> },
      { path: 'scenarios/:category?/:id?/:cut?', element: <ScenariosView /> },
      ...NAV_ITEMS.filter((item) => !item.ready).map((item) => ({ path: item.path.slice(1), element: <ComingSoon /> })),
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
