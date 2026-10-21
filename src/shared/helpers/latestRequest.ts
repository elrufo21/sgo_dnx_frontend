// Comparte una petición idéntica en curso y cancela la búsqueda anterior al cambiar filtros.
export const createLatestRequest = () => {
  let active: {
    key: string;
    controller: AbortController;
    promise: Promise<void>;
  } | undefined;

  return (
    key: string,
    run: (signal: AbortSignal, isCurrent: () => boolean) => Promise<void>,
  ): Promise<void> => {
    if (active?.key === key) return active.promise;
    active?.controller.abort();
    const controller = new AbortController();
    const isCurrent = () => active?.controller === controller;
    const promise = Promise.resolve()
      .then(() => run(controller.signal, isCurrent))
      .finally(() => {
        if (isCurrent()) active = undefined;
      });
    active = { key, controller, promise };
    return promise;
  };
};
