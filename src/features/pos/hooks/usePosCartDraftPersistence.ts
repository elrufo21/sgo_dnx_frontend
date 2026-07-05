import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "@/store/auth/auth.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { usePosStore, selectTotals } from "@/store/pos/pos.store";
import type { PosCartItem, PosTotals } from "@/types/pos";
import {
  cleanupExpiredPosCartDrafts,
  type PosCartDraftContext,
  type PosCartDraftPaymentMeta,
  type PosCartDraftScope,
  clearPosCartDraft,
  markActivePosCartDraftAsConfirmed,
  resetPosCartDraftForNewSale,
  resolvePosDraftContextFromSessionStorage,
  upsertActivePosCartDraft,
  getActivePosCartDraft,
} from "@/features/pos/persistence/posCartDraft.repository";

type UsePosCartDraftPersistenceOptions = {
  enabled?: boolean;
  autosave?: boolean;
  hydrateFromStorage?: boolean;
  scope?: PosCartDraftScope;
  noteId?: number | null;
};

type UsePosCartDraftPersistenceResult = {
  isHydrated: boolean;
  context: PosCartDraftContext | null;
  markDraftAsConfirmed: (paymentMeta?: PosCartDraftPaymentMeta) => Promise<void>;
  resetDraftForNewSale: () => Promise<void>;
  discardCurrentDraft: () => Promise<void>;
};

const AUTOSAVE_DEBOUNCE_MS = 180;

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};
const normalizeNoteId = (noteId?: number | null): number => {
  const numeric = Number(noteId);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const resolveContextFromAuthUser = (
  user: AuthUser | null,
): PosCartDraftContext | null => {
  if (!user) return null;

  const userId = String(user.id || user.username || user.displayName || "").trim();
  if (!userId) return null;

  const companyId = toPositiveNumber(user.companyId);
  if (!companyId) return null;

  return { companyId, userId };
};

export const usePosCartDraftPersistence = ({
  enabled = true,
  autosave = true,
  hydrateFromStorage = true,
  scope = "sale",
  noteId = null,
}: UsePosCartDraftPersistenceOptions = {}): UsePosCartDraftPersistenceResult => {
  const authUser = useAuthStore((state) => state.user);
  const items = usePosStore((state) => state.items);
  const totals = usePosStore(selectTotals);
  const setItems = usePosStore((state) => state.setItems);

  const [isHydrated, setIsHydrated] = useState(false);
  const cleanupExecutedRef = useRef(false);
  const latestItemsRef = useRef<PosCartItem[]>(items);
  const latestTotalsRef = useRef<PosTotals>(totals);

  useEffect(() => {
    latestItemsRef.current = items;
    latestTotalsRef.current = totals;
  }, [items, totals]);

  const context = useMemo(
    () =>
      resolveContextFromAuthUser(authUser) ??
      resolvePosDraftContextFromSessionStorage(),
    [authUser],
  );

  const contextKey = useMemo(() => {
    if (!context) return "";
    return `${context.companyId}|${context.userId}|${scope}|${normalizeNoteId(noteId)}`;
  }, [context, scope, noteId]);

  useEffect(() => {
    if (!enabled || !context) return;

    let isMounted = true;
    const bootstrap = async () => {
      if (!cleanupExecutedRef.current) {
        cleanupExecutedRef.current = true;
        void cleanupExpiredPosCartDrafts();
      }

      if (!hydrateFromStorage) {
        if (isMounted) setIsHydrated(true);
        return;
      }

      const activeDraft = await getActivePosCartDraft(context, {
        scope,
        noteId,
      });
      if (!isMounted) return;

      const hasLiveItems = latestItemsRef.current.length > 0;
      const draftHasItems = Boolean(activeDraft?.items.length);

      if (!hasLiveItems && draftHasItems) {
        setItems(activeDraft.items);
      }

      if (!activeDraft) {
        await upsertActivePosCartDraft({
          context,
          items: latestItemsRef.current,
          totals: latestTotalsRef.current,
          scope,
          noteId,
        });
      }

      if (isMounted) setIsHydrated(true);
    };

    void bootstrap().catch(() => {
      if (isMounted) setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, [context, contextKey, enabled, hydrateFromStorage, noteId, scope, setItems]);

  useEffect(() => {
    if (!enabled || !autosave || !context || !isHydrated) return;

    const timer = window.setTimeout(() => {
      void upsertActivePosCartDraft({
        context,
        items,
        totals,
        scope,
        noteId,
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autosave, context, enabled, isHydrated, items, noteId, scope, totals]);

  const markDraftAsConfirmed = useCallback(
    async (paymentMeta?: PosCartDraftPaymentMeta) => {
      if (!context) return;

      await markActivePosCartDraftAsConfirmed({
        context,
        items: latestItemsRef.current,
        totals: latestTotalsRef.current,
        paymentMeta,
        scope,
        noteId,
      });
    },
    [context, noteId, scope],
  );

  const resetDraftForNewSale = useCallback(async () => {
    if (!context) return;
    await resetPosCartDraftForNewSale(context);
  }, [context]);

  const discardCurrentDraft = useCallback(async () => {
    if (!context) return;
    await clearPosCartDraft(context, { scope, noteId });
  }, [context, noteId, scope]);

  return {
    isHydrated: enabled && Boolean(context) ? isHydrated : false,
    context,
    markDraftAsConfirmed,
    resetDraftForNewSale,
    discardCurrentDraft,
  };
};
