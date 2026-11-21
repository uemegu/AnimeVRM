import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type StudioProject } from '../api/client';

const STORAGE_KEY = 'studio_project';

function savedProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface ProjectsState {
  projects: StudioProject[] | null;
  current: StudioProject | null;
  select: (id: string) => void;
  error: boolean;
}

function useProjectsState(): ProjectsState {
  const [projects, setProjects] = useState<StudioProject[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(savedProjectId);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch(() => setError(true));
  }, []);

  const select = (id: string) => {
    setCurrentId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // 覚えられなくても選択は効く
    }
  };

  const current = projects ? (projects.find((p) => p.id === currentId) ?? projects[0] ?? null) : null;
  return { projects, current, select, error };
}

const ProjectsContext = createContext<ProjectsState | null>(null);

/** プロジェクトの選択を、サイドバーとすべての画面で共有する */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  return createElement(ProjectsContext.Provider, { value: useProjectsState() }, children);
}

/**
 * プロジェクト（assets/studio/projects.json と、studio-projects.txt・STUDIO_PROJECTS で読み込んだ外部プロジェクト）と、いま選んでいるプロジェクト。
 * シナリオ・キャラ・場所・BGM はプロジェクトごとに分かれる。選択はすべての画面で共通にし、ブラウザに覚えておく
 */
export function useProjects(): ProjectsState {
  return useContext(ProjectsContext) ?? NO_PROJECTS;
}

/** ProjectsProvider の外（公開版のビューア）。プロジェクトなし＝共通のものだけ */
const NO_PROJECTS: ProjectsState = { projects: [], current: null, select: () => {}, error: false };
