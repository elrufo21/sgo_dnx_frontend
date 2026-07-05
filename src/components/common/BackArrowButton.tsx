import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

interface BackArrowButtonProps {
  fallbackTo?: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function BackArrowButton({
  fallbackTo = "/",
  className,
  title = "Volver",
  ariaLabel = "Volver",
}: BackArrowButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isLikelyIdentifier = (segment: string) => {
    const normalized = segment.trim();
    if (!normalized) return false;
    if (/^\d+$/.test(normalized)) return true;
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalized,
      )
    ) {
      return true;
    }
    return false;
  };

  const isActionSegment = (segment: string) => {
    const normalized = segment.toLowerCase();
    return [
      "create",
      "new",
      "edit",
      "view",
      "details",
      "detail",
      "form",
      "payment",
    ].includes(normalized);
  };

  const resolveParentPath = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean);
    if (!segments.length) return fallbackTo;

    const trimmed = [...segments];
    let removedContext = false;

    while (trimmed.length > 0) {
      const last = trimmed[trimmed.length - 1];
      if (isActionSegment(last) || isLikelyIdentifier(last)) {
        trimmed.pop();
        removedContext = true;
        continue;
      }
      break;
    }

    if (!trimmed.length) return fallbackTo;

    if (!removedContext) {
      trimmed.pop();
    }

    if (!trimmed.length) return fallbackTo;

    return `/${trimmed.join("/")}`;
  };

  const handleBack = () => {
    const target = resolveParentPath(location.pathname);
    navigate(target, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      title={title}
      aria-label={ariaLabel}
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors"
      }
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
