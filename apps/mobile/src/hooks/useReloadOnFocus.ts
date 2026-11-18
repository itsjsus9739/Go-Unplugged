import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Vuelve a cargar los datos cada vez que la pantalla recupera el foco
 * (p. ej. al volver de editar o borrar un límite). La primera vez no hace nada
 * porque useAsync ya cargó al montar.
 */
export function useReloadOnFocus(reload: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      reload();
    }, [reload]),
  );
}
