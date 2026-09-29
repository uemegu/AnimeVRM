import { useEffect, useState } from 'react';
import { ProjectBook, type ScenarioProject } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

const STORAGE_KEY = 'studio_project';

function savedProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * シナリオのプロジェクト（assets/studio/projects.json）と、いま選んでいるプロジェクト。
 * 選択はシナリオ編集と再生で共通にし、ブラウザに覚えておく
 */
export function useProjects(): { projects: ScenarioProject[] | null; current: ScenarioProject | null; select: (id: string) => void; error: boolean } {
  const [projects, setProjects] = useState<ScenarioProject[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(savedProjectId);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(resolveAssetUrl('/studio/projects.json'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('projects.json を読めません'))))
      .then((json) => setProjects(ProjectBook.parse(json).projects))
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
