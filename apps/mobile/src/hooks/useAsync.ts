import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

type State<T> = { data: T | null; error: unknown; loading: boolean };

/** Carga de datos mínima (sin librerías): data / error / loading / reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const fnRef = useRef(fn);
  const alive = useRef(true);
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    fnRef.current = fn;
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (alive.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  const key = JSON.stringify(deps);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    fnRef.current().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) => !cancelled && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [key]);

  const setData = useCallback((data: T | null) => setState((s) => ({ ...s, data })), []);
  return { ...state, reload, setData };
}
