import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod';
import { readDraft, writeDraft } from './draftStorage';

export function useBrowserDraft<T>(key: string, schema: z.ZodType<T>, createDefault: () => T) {
  const [initial] = useState(() => {
    if (typeof window === 'undefined') return { value: createDefault(), error: '' };
    try {
      const loaded = readDraft(window.sessionStorage, key, schema);
      return { value: loaded.value ?? createDefault(), error: loaded.error };
    } catch {
      return {
        value: createDefault(),
        error: 'Хранилище вкладки недоступно. Черновик останется только в памяти.',
      };
    }
  });
  const [value, setValue] = useState<T>(initial.value);
  const [storageError, setStorageError] = useState(initial.error);
  const current = useRef(value);

  const update = useCallback((next: T | ((previous: T) => T)) => {
    const resolved = typeof next === 'function'
      ? (next as (previous: T) => T)(current.current)
      : next;
    current.current = resolved;
    setValue(resolved);
    try {
      setStorageError(writeDraft(window.sessionStorage, key, resolved, schema));
    } catch {
      setStorageError('Черновик не сохранён. Хранилище вкладки недоступно.');
    }
  }, [key, schema]);

  const reset = useCallback((next: T) => {
    current.current = next;
    setValue(next);
    try {
      window.sessionStorage.removeItem(key);
      setStorageError('');
    } catch {
      setStorageError('Не удалось удалить сохранённый черновик из хранилища вкладки.');
    }
  }, [key]);

  return { value, update, reset, storageError };
}
