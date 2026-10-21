import { useSyncExternalStore } from "react";

export interface Store<T> { get(): T; set(p: Partial<T> | ((s: T) => Partial<T>)): void; subscribe(fn: () => void): () => void }

/** Store mínimo (sem biblioteca): estado imutável + assinantes. */
export function createStore<T extends object | null>(init: T): Store<T> {
  let s = init; const subs = new Set<() => void>();
  return {
    get: () => s,
    set(p) {
      const patch = typeof p === "function" ? p(s) : p;
      s = (s === null ? patch : { ...s, ...patch }) as T;
      subs.forEach(f => f());
    },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
/** Lê uma parte do store. O seletor deve devolver valor primitivo ou uma referência que já existe no estado (nunca um objeto novo). */
export function useStore<T, U>(st: Store<T>, sel: (s: T) => U): U {
  return useSyncExternalStore(st.subscribe, () => sel(st.get()), () => sel(st.get()));
}
