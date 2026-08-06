import { useCallback, useEffect, useState } from 'react';

export type AppPath =
  | '/'
  | '/estado'
  | '/guardianes'
  | '/mundo'
  | '/bruto-preview'
  | '/bruto-personaje'
  | '/menu'
  | '/pueblo'
  | '/expedicion'
  | '/inventario'
  | '/personaje'
  | '/habilidades'
  | '/resultados'
  | '/ausente'
  | '/comerciante'
  | '/cofre'
  | '/ajustes';
const normalize = (path: string): AppPath =>
  path === '/estado' ||
  path === '/guardianes' ||
  path === '/mundo' ||
  path === '/bruto-preview' ||
  path === '/bruto-personaje' ||
  path === '/menu' ||
  path === '/pueblo' ||
  path === '/expedicion' ||
  path === '/inventario' ||
  path === '/personaje' ||
  path === '/habilidades' ||
  path === '/resultados' ||
  path === '/ausente' ||
  path === '/comerciante' ||
  path === '/cofre' ||
  path === '/ajustes'
    ? path
    : '/';
export function usePath(): readonly [AppPath, (path: AppPath) => void] {
  const [path, setPath] = useState<AppPath>(() => normalize(window.location.pathname));
  useEffect(() => {
    const listener = () => setPath(normalize(window.location.pathname));
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  const navigate = useCallback((next: AppPath) => {
    if (window.location.pathname !== next) window.history.pushState({}, '', next);
    setPath(next);
  }, []);
  return [path, navigate] as const;
}
