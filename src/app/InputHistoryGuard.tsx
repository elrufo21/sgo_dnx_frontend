import { useEffect } from "react";

type FormFieldElement = HTMLInputElement | HTMLTextAreaElement;

const FORM_SELECTOR = "form";
const FIELD_SELECTOR = "input, textarea";

const TEXT_LIKE_INPUT_TYPES = new Set([
  "text",
  "password",
  "email",
  "search",
  "tel",
  "url",
  "number",
]);

const USERNAME_HINTS = ["username", "usuario", "user", "login", "alias"];
const EMAIL_HINTS = ["email", "correo", "mail"];
const PASSWORD_HINTS = [
  "password",
  "pass",
  "clave",
  "contrasena",
  "currentpassword",
  "newpassword",
];

const normalizeHint = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const includesAnyHint = (value: string, hints: string[]) =>
  hints.some((hint) => value.includes(hint));

const setAttr = (el: Element, name: string, value: string) => {
  if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value);
  }
};

const clearManagedUppercaseStyle = (field: FormFieldElement) => {
  if (field.getAttribute("data-uppercase-managed") !== "true") return;
  field.style.removeProperty("text-transform");
  field.removeAttribute("data-uppercase-managed");
};

const isHistoryGuardDisabled = (field: FormFieldElement) => {
  const attr = field.getAttribute("data-no-history-guard");
  return attr === "true" || attr === "1";
};
const isInsideDialog = (field: FormFieldElement) =>
  Boolean(field.closest('[role="dialog"]'));

const setUppercaseStyle = (field: FormFieldElement) => {
  setAttr(field, "data-uppercase-managed", "true");
  field.style.setProperty("text-transform", "uppercase");
};

const isTextLikeField = (field: FormFieldElement) => {
  if (field instanceof HTMLTextAreaElement) return true;
  const inputType = field.type.toLowerCase();
  return TEXT_LIKE_INPUT_TYPES.has(inputType) && inputType !== "hidden";
};

const getFieldDescriptors = (field: FormFieldElement) => {
  const descriptors = [
    field.getAttribute("name") ?? "",
    field.getAttribute("id") ?? "",
    field.getAttribute("placeholder") ?? "",
    field.getAttribute("aria-label") ?? "",
    field.getAttribute("data-field") ?? "",
  ]
    .map((value) => normalizeHint(value))
    .filter(Boolean);

  return descriptors;
};

const shouldSkipUppercase = (field: FormFieldElement) => {
  const noUppercaseAttr = field.getAttribute("data-no-uppercase");
  if (noUppercaseAttr === "true" || noUppercaseAttr === "1") return true;

  if (field instanceof HTMLInputElement) {
    const inputType = field.type.toLowerCase();
    if (inputType === "email") return true;
    if (inputType === "password") return true;
  }

  const descriptors = getFieldDescriptors(field);
  if (!descriptors.length) return false;

  return descriptors.some(
    (descriptor) =>
      includesAnyHint(descriptor, EMAIL_HINTS) ||
      includesAnyHint(descriptor, USERNAME_HINTS) ||
      includesAnyHint(descriptor, PASSWORD_HINTS),
  );
};

const enforceUppercaseValue = (field: FormFieldElement) => {
  if (field.disabled || field.readOnly) return;

  const rawValue = field.value ?? "";
  if (!rawValue) return;

  const upperValue = rawValue.toLocaleUpperCase("es-PE");
  if (upperValue === rawValue) return;

  const selectionStart = field.selectionStart;
  const selectionEnd = field.selectionEnd;

  field.value = upperValue;

  if (selectionStart === null || selectionEnd === null) return;
  try {
    field.setSelectionRange(selectionStart, selectionEnd);
  } catch {
    // ignore selection errors in unsupported input types
  }
};

const applyUppercaseBehavior = (field: FormFieldElement) => {
  if (!isTextLikeField(field)) return;

  if (shouldSkipUppercase(field)) {
    clearManagedUppercaseStyle(field);
    return;
  }

  setUppercaseStyle(field);
};

const hardenForm = (form: HTMLFormElement) => {
  setAttr(form, "autocomplete", "off");
  setAttr(form, "data-lpignore", "true");
  setAttr(form, "data-1p-ignore", "true");
  setAttr(form, "data-bwignore", "true");
  setAttr(form, "data-form-type", "other");
};

const hardenField = (
  field: FormFieldElement,
  options?: { skipReadonly?: boolean },
) => {
  if (!isTextLikeField(field)) return;

  if (isHistoryGuardDisabled(field) || isInsideDialog(field)) {
    clearManagedUppercaseStyle(field);
    if (field.hasAttribute("data-history-managed-readonly")) {
      field.removeAttribute("readonly");
      field.removeAttribute("data-history-managed-readonly");
    }
    return;
  }

  applyUppercaseBehavior(field);
  const shouldSkipReadonly = Boolean(options?.skipReadonly);

  if (field instanceof HTMLInputElement) {
    const inputType = field.type.toLowerCase();
    const autoCompleteValue =
      inputType === "password" ? "new-password" : "one-time-code";
    setAttr(field, "autocomplete", autoCompleteValue);
  } else {
    setAttr(field, "autocomplete", "off");
  }

  setAttr(field, "aria-autocomplete", "none");
  setAttr(field, "autocorrect", "off");
  setAttr(field, "autocapitalize", "off");
  setAttr(field, "spellcheck", "false");
  setAttr(field, "data-lpignore", "true");
  setAttr(field, "data-1p-ignore", "true");
  setAttr(field, "data-bwignore", "true");
  setAttr(field, "data-form-type", "other");

  if (shouldSkipReadonly) {
    if (field.hasAttribute("data-history-managed-readonly")) {
      field.removeAttribute("readonly");
    }
    return;
  }

  if (field.disabled) return;
  if (field.hasAttribute("readonly")) return;

  const activeElement = (field.ownerDocument ?? document).activeElement;
  if (activeElement === field) return;

  // Additional hardening for stubborn browser history/autofill dropdowns.
  setAttr(field, "data-history-managed-readonly", "true");
  setAttr(field, "readonly", "readonly");
};

const hardenNodeTree = (node: ParentNode | Element) => {
  if (node instanceof HTMLFormElement) {
    hardenForm(node);
  }
  if (
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement
  ) {
    hardenField(node);
  }

  if (!(node instanceof Element || node instanceof Document)) return;

  node.querySelectorAll(FORM_SELECTOR).forEach((form) => {
    hardenForm(form as HTMLFormElement);
  });
  node.querySelectorAll(FIELD_SELECTOR).forEach((field) => {
    hardenField(field as FormFieldElement);
  });
};

const focusAutoNextAfterRadio = (radio: HTMLInputElement) => {
  const scope: ParentNode | Document =
    radio.closest("form") ?? radio.ownerDocument ?? document;
  const candidates = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-auto-next="true"]'),
  ).filter((candidate) => {
    if (candidate.hasAttribute("disabled")) return false;
    if (candidate.getAttribute("aria-disabled") === "true") return false;
    return true;
  });

  if (!candidates.length) return;

  const nextCandidate = candidates.find(
    (candidate) =>
      Boolean(radio.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  const target = nextCandidate ?? candidates[0];
  if (!target) return;

  target.focus({ preventScroll: true });

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const length = target.value?.length ?? 0;
    try {
      target.setSelectionRange(length, length);
    } catch {
      // ignore selection errors on unsupported input types
    }
  }
};

export function InputHistoryGuard() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    hardenNodeTree(document);

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        hardenField(target, { skipReadonly: true });
      }

      const parentForm = target.closest("form");
      if (parentForm) {
        hardenForm(parentForm);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        )
      ) {
        return;
      }

      if (isHistoryGuardDisabled(target) || isInsideDialog(target)) {
        if (target.hasAttribute("data-history-managed-readonly")) {
          target.removeAttribute("readonly");
          target.removeAttribute("data-history-managed-readonly");
        }
        return;
      }

      if (
        target.hasAttribute("data-history-managed-readonly") &&
        !target.disabled
      ) {
        target.setAttribute("readonly", "readonly");
      }
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        )
      ) {
        return;
      }

      if (isHistoryGuardDisabled(target) || isInsideDialog(target)) return;

      applyUppercaseBehavior(target);
      if (shouldSkipUppercase(target)) return;
      enforceUppercaseValue(target);
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type.toLowerCase() !== "radio") return;

      window.requestAnimationFrame(() => {
        focusAutoNextAfterRadio(target);
      });
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("change", onChange, true);
    // Use window capture so uppercase mutation runs before React delegated onChange handlers.
    window.addEventListener("input", onInput, true);

    const pendingNodes = new Set<Element>();
    let rafId: number | null = null;

    const flushPendingNodes = () => {
      rafId = null;
      pendingNodes.forEach((node) => {
        if (node.isConnected) {
          hardenNodeTree(node);
        }
      });
      pendingNodes.clear();
    };

    const scheduleFlush = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(flushPendingNodes);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((addedNode) => {
          if (addedNode instanceof Element) {
            pendingNodes.add(addedNode);
          }
        });
      });
      scheduleFlush();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      pendingNodes.clear();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("change", onChange, true);
      window.removeEventListener("input", onInput, true);
    };
  }, []);

  return null;
}
