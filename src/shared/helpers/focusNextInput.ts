const isSkippable = (el: HTMLElement) => {
  if (el.hasAttribute("disabled")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el instanceof HTMLInputElement && el.type === "hidden") return true;
  return false;
};

const focusElement = (el: HTMLElement) => {
  el.focus({ preventScroll: true });

  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    const length = el.value?.length ?? 0;
    try {
      el.setSelectionRange?.(length, length);
    } catch {
      // Ignore selection errors on unsupported input types
    }
  }
};

const resolveFocusableElement = (current: HTMLElement): HTMLElement | null => {
  const isFocusableTarget = (el: Element | null): el is HTMLElement =>
    !!el &&
    el instanceof HTMLElement &&
    el.matches('[data-auto-next="true"]');

  if (isFocusableTarget(current)) return current;

  const fromClosest = current.closest('[data-auto-next="true"]');
  if (isFocusableTarget(fromClosest)) return fromClosest;

  const active = (current.ownerDocument ?? document).activeElement;
  if (isFocusableTarget(active)) return active;

  const nested = current.querySelector?.('[data-auto-next="true"]');
  if (isFocusableTarget(nested)) return nested;

  return null;
};

export const focusNextInput = (current: HTMLElement): boolean => {
  const source = resolveFocusableElement(current);
  if (!source) return false;

  const scope: ParentNode | Document =
    source.closest("form") ?? source.ownerDocument ?? document;

  const focusable = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-auto-next="true"]')
  );

  const idx = focusable.indexOf(source);
  if (idx === -1) return false;

  for (let i = idx + 1; i < focusable.length; i += 1) {
    const candidate = focusable[i];
    if (isSkippable(candidate)) continue;
    focusElement(candidate);
    return true;
  }
  return false;
};

export const focusPreviousInput = (current: HTMLElement): boolean => {
  const source = resolveFocusableElement(current);
  if (!source) return false;

  const scope: ParentNode | Document =
    source.closest("form") ?? source.ownerDocument ?? document;

  const focusable = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-auto-next="true"]')
  );

  const idx = focusable.indexOf(source);
  if (idx === -1) return false;

  for (let i = idx - 1; i >= 0; i -= 1) {
    const candidate = focusable[i];
    if (isSkippable(candidate)) continue;
    focusElement(candidate);
    return true;
  }
  return false;
};
