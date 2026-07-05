export const focusFirstInput = (root?: HTMLElement | null) => {
  const scope: ParentNode | Document = root ?? document;

  // Use rAF to ensure DOM is ready after state updates
  window.requestAnimationFrame(() => {
    const element = scope.querySelector<HTMLElement>(
      '[data-focus-first="true"]'
    );
    if (!element) return;

    element.focus({ preventScroll: true });

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      const length = element.value?.length ?? 0;
      try {
        element.setSelectionRange(length, length);
      } catch {
        // Ignore selection errors (e.g., unsupported input types)
      }
    }
  });
};
