import { useEffect, useState } from 'react';
import type { ScenarioProject } from '@anime-vrm/scenario';
import { api } from '../api/client';

const STORAGE_KEY = 'studio_project';

function savedProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * シナリオのプロジェクト（assets/studio/projects.json と、studio-projects.txt・STUDIO_PROJECTS で読み込んだ外部プロジェクト）と、いま選んでいるプロジェクト。
 * 選択はシナリオ編集と再生で共通にし、ブラウザに覚えておく
 */
export function useProjects(): { projects: ScenarioProject[] | null; current: ScenarioProject | null; select: (id: string) => void; error: boolean } {
  const [projects, setProjects] = useState<ScenarioProject[] | null>(null);
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

  const current = projects ? (projects.find((p) => p.id === currentId) ?? projects[0]) : null;
  return { projects, current, select, error };
}
