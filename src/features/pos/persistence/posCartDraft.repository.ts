import Dexie, { type Table } from "dexie";
import type { PosCartItem, PosTotals } from "@/types/pos";

export type PosCartDraftStatus = "draft" | "confirmed";
export type PosCartDraftScope = "sale" | "note-edit";

export type PosCartDraftContext = {
  companyId: number;
  userId: string;
};

export type PosCartDraftKey = {
  scope?: PosCartDraftScope;
  noteId?: number | null;
};

export type PosCartDraftPaymentMeta = {
  noteId?: number | null;
  documentNumber?: string;
  paymentMethod?: string;
  customerName?: string;
  total?: number;
};

export type PosCartDraftRecord = {
  id: string;
  companyId: number;
  userId: string;
  status: PosCartDraftStatus;
  scope: PosCartDraftScope;
  noteId: number;
  items: PosCartItem[];
  totals: PosTotals;
  paymentMeta?: PosCartDraftPaymentMeta;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

type UpsertDraftParams = {
  context: PosCartDraftContext;
  items: PosCartItem[];
  totals: PosTotals;
  paymentMeta?: PosCartDraftPaymentMeta;
  scope?: PosCartDraftScope;
  noteId?: number | null;
};

type ConfirmDraftParams = UpsertDraftParams;

const AUTH_STORAGE_KEY = "sgo.auth.session";
const COMPANY_STORAGE_KEY = "companiaId";
const EMPTY_TOTALS: PosTotals = { subTotal: 0, total: 0, itemCount: 0 };
const DEFAULT_DRAFT_SCOPE: PosCartDraftScope = "sale";
const normalizeDraftScope = (scope?: PosCartDraftScope): PosCartDraftScope =>
  scope === "note-edit" ? "note-edit" : DEFAULT_DRAFT_SCOPE;
const normalizeDraftNoteId = (noteId?: number | null): number => {
  const numeric = Number(noteId);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};
const normalizeDraftKey = (key?: PosCartDraftKey) => ({
  scope: normalizeDraftScope(key?.scope),
  noteId: normalizeDraftNoteId(key?.noteId),
});

class PosCartDraftDatabase extends Dexie {
  drafts!: Table<PosCartDraftRecord, string>;

  constructor() {
    super("sgo-pos-drafts-db");
    this.version(1).stores({
      drafts:
        "&id, [companyId+userId], [companyId+userId+status], updatedAt, status",
    });
    this.version(2)
      .stores({
        drafts:
          "&id, [companyId+userId], [companyId+userId+status], [companyId+userId+scope+status], [companyId+userId+scope+noteId+status], updatedAt, status, scope, noteId",
      })
      .upgrade((transaction) =>
        transaction
          .table("drafts")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            if (row.scope !== "sale" && row.scope !== "note-edit") {
              row.scope = DEFAULT_DRAFT_SCOPE;
            }
            const noteId = Number(row.noteId);
            row.noteId =
              Number.isFinite(noteId) && noteId > 0 ? Math.floor(noteId) : 0;
          }),
      );
  }
}

const db = new PosCartDraftDatabase();

const nowIso = () => new Date().toISOString();

const createDraftId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const safeTrim = (value: unknown) => String(value ?? "").trim();

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const toNonNegativeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const normalizeTotals = (totals: PosTotals): PosTotals => ({
  subTotal: toNonNegativeNumber(totals.subTotal),
  total: toNonNegativeNumber(totals.total),
  itemCount: toNonNegativeNumber(totals.itemCount),
});

const pickLatestDraft = (drafts: PosCartDraftRecord[]) =>
  drafts.reduce<PosCartDraftRecord | null>((latest, current) => {
    if (!latest) return current;
    return current.updatedAt > latest.updatedAt ? current : latest;
  }, null);

const createEmptyDraftRecord = (
  context: PosCartDraftContext,
  status: PosCartDraftStatus,
  key?: PosCartDraftKey,
) => {
  const timestamp = nowIso();
  const normalizedKey = normalizeDraftKey(key);
  return {
    id: createDraftId(),
    companyId: context.companyId,
    userId: context.userId,
    status,
    scope: normalizedKey.scope,
    noteId: normalizedKey.noteId,
    items: [],
    totals: EMPTY_TOTALS,
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: status === "confirmed" ? timestamp : null,
  } as PosCartDraftRecord;
};

export const resolvePosDraftContextFromSessionStorage =
  (): PosCartDraftContext | null => {
    if (typeof window === "undefined") return null;

    let parsedSession: Record<string, unknown> | null = null;
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as unknown;
        if (parsed && typeof parsed === "object") {
          parsedSession = parsed as Record<string, unknown>;
        }
      } catch {
        parsedSession = null;
      }
    }

    const sessionUser =
      parsedSession &&
      typeof parsedSession.user === "object" &&
      parsedSession.user !== null
        ? (parsedSession.user as Record<string, unknown>)
        : null;

    const userId =
      safeTrim(sessionUser?.id) ||
      safeTrim(sessionUser?.username) ||
      safeTrim(sessionUser?.displayName);
    if (!userId) return null;

    const companyId =
      toPositiveNumber(sessionUser?.companyId) ||
      toPositiveNumber(window.localStorage.getItem(COMPANY_STORAGE_KEY));
    if (!companyId) return null;

    return { companyId, userId };
  };

export const getActivePosCartDraft = async (
  context: PosCartDraftContext,
  key?: PosCartDraftKey,
): Promise<PosCartDraftRecord | null> => {
  const normalizedKey = normalizeDraftKey(key);
  const drafts = await db.drafts
    .where("[companyId+userId+scope+noteId+status]")
    .equals([
      context.companyId,
      context.userId,
      normalizedKey.scope,
      normalizedKey.noteId,
      "draft",
    ])
    .toArray();

  return pickLatestDraft(drafts);
};

export const upsertActivePosCartDraft = async ({
  context,
  items,
  totals,
  paymentMeta,
  scope,
  noteId,
}: UpsertDraftParams): Promise<PosCartDraftRecord> => {
  const timestamp = nowIso();
  const normalizedKey = normalizeDraftKey({ scope, noteId });

  return db.transaction("rw", db.drafts, async () => {
    const currentDraft = await getActivePosCartDraft(context, normalizedKey);

    if (currentDraft) {
      const updated: PosCartDraftRecord = {
        ...currentDraft,
        items,
        totals: normalizeTotals(totals),
        paymentMeta: paymentMeta ?? currentDraft.paymentMeta,
        updatedAt: timestamp,
      };
      await db.drafts.put(updated);
      return updated;
    }

    const created: PosCartDraftRecord = {
      ...createEmptyDraftRecord(context, "draft", normalizedKey),
      items,
      totals: normalizeTotals(totals),
      paymentMeta,
    };
    await db.drafts.add(created);
    return created;
  });
};

export const markActivePosCartDraftAsConfirmed = async ({
  context,
  items,
  totals,
  paymentMeta,
  scope,
  noteId,
}: ConfirmDraftParams): Promise<PosCartDraftRecord> => {
  const timestamp = nowIso();
  const normalizedKey = normalizeDraftKey({ scope, noteId });

  return db.transaction("rw", db.drafts, async () => {
    const draftRows = await db.drafts
      .where("[companyId+userId+scope+noteId+status]")
      .equals([
        context.companyId,
        context.userId,
        normalizedKey.scope,
        normalizedKey.noteId,
        "draft",
      ])
      .toArray();

    const latestDraft = pickLatestDraft(draftRows);

    if (latestDraft) {
      const staleDraftIds = draftRows
        .filter((draft) => draft.id !== latestDraft.id)
        .map((draft) => draft.id);
      if (staleDraftIds.length) {
        await db.drafts.bulkDelete(staleDraftIds);
      }

      const confirmed: PosCartDraftRecord = {
        ...latestDraft,
        status: "confirmed",
        items,
        totals: normalizeTotals(totals),
        paymentMeta: paymentMeta ?? latestDraft.paymentMeta,
        confirmedAt: timestamp,
        updatedAt: timestamp,
      };
      await db.drafts.put(confirmed);
      return confirmed;
    }

    const confirmed: PosCartDraftRecord = {
      ...createEmptyDraftRecord(context, "confirmed", normalizedKey),
      items,
      totals: normalizeTotals(totals),
      paymentMeta,
      confirmedAt: timestamp,
      updatedAt: timestamp,
    };
    await db.drafts.add(confirmed);
    return confirmed;
  });
};

export const resetPosCartDraftForNewSale = async (
  context: PosCartDraftContext,
): Promise<PosCartDraftRecord> => {
  const timestamp = nowIso();
  const draftKey = normalizeDraftKey({ scope: "sale", noteId: null });

  return db.transaction("rw", db.drafts, async () => {
    const rows = await db.drafts
      .where("[companyId+userId]")
      .equals([context.companyId, context.userId])
      .toArray();
    const saleRows = rows.filter(
      (row) =>
        normalizeDraftScope(row.scope) === draftKey.scope &&
        normalizeDraftNoteId(row.noteId) === draftKey.noteId,
    );

    if (saleRows.length) {
      await db.drafts.bulkDelete(saleRows.map((row) => row.id));
    }

    const freshDraft: PosCartDraftRecord = {
      ...createEmptyDraftRecord(context, "draft", draftKey),
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedAt: null,
    };
    await db.drafts.add(freshDraft);
    return freshDraft;
  });
};

export const clearPosCartDraft = async (
  context: PosCartDraftContext,
  key?: PosCartDraftKey,
) => {
  const normalizedKey = normalizeDraftKey(key);
  const rows = await db.drafts
    .where("[companyId+userId]")
    .equals([context.companyId, context.userId])
    .toArray();
  const idsToDelete = rows
    .filter(
      (row) =>
        normalizeDraftScope(row.scope) === normalizedKey.scope &&
        normalizeDraftNoteId(row.noteId) === normalizedKey.noteId,
    )
    .map((row) => row.id);

  if (!idsToDelete.length) return 0;
  await db.drafts.bulkDelete(idsToDelete);
  return idsToDelete.length;
};

export const cleanupExpiredPosCartDrafts = async (maxAgeHours = 72) => {
  const safeMaxAge = Math.max(1, toPositiveNumber(maxAgeHours, 72));
  const threshold = Date.now() - safeMaxAge * 60 * 60 * 1000;

  const rows = await db.drafts.toArray();
  const expiredIds = rows
    .filter((row) => {
      const updatedAt = Date.parse(row.updatedAt);
      if (!Number.isFinite(updatedAt)) return false;
      return updatedAt < threshold;
    })
    .map((row) => row.id);

  if (!expiredIds.length) return 0;
  await db.drafts.bulkDelete(expiredIds);
  return expiredIds.length;
};
