import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ComingSoon, Layout, NAV_ITEMS } from './components/Layout';
import { LanguageProvider } from './i18n';
import { CharactersView } from './views/characters/CharactersView';
import './styles/global.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/characters" replace /> },
      { path: 'characters/:characterId?', element: <CharactersView /> },
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
