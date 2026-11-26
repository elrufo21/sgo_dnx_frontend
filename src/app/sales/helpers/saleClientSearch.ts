import type { Client } from "@/app/customers/types/customer";

const SUGGESTION_LIMIT = 15;
const collator = new Intl.Collator("es", { sensitivity: "base" });

export const normalizeClientText = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeClientDocument = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");

export const isCompleteClientRuc = (ruc: string) =>
  ruc.length === 11 && !/^0+[01]$/.test(ruc);

const optionFor = (client: Client, label: string) => ({ label, value: label, client });

const documentScore = (client: Client) =>
  Number(Boolean(client.ruc?.trim())) * 2 + Number(Boolean(client.dni?.trim()));

type IndexedOption = {
  option: ReturnType<typeof optionFor>;
  label: string;
  documents: string[];
};

export type ClientSearchField = "name" | "invoiceName" | "code" | "ruc";

export function indexSaleClients(clients: Client[]) {
  const byCode = new Map<string, Client>();
  const byName = new Map<string, Client>();
  const byDni = new Map<string, Client>();
  const byRuc = new Map<string, Client[]>();
  const names = new Map<string, IndexedOption>();
  const codes: IndexedOption[] = [];
  const rucs: IndexedOption[] = [];
  for (const client of clients) {
    if (!(Number(client.id) > 0)) continue;
    const name = String(client.nombreRazon ?? "").trim() || `Cliente ${client.id}`;
    const code = String(client.clienteCodigo ?? "").trim();
    const label = normalizeClientText(name);
    const normalizedCode = normalizeClientText(code);
    const dni = normalizeClientDocument(client.dni);
    const ruc = normalizeClientDocument(client.ruc);
    const documents = [normalizedCode, dni, ruc].filter(Boolean);
    if (dni && !byDni.has(dni)) byDni.set(dni, client);
    if (isCompleteClientRuc(ruc)) {
      const matches = byRuc.get(ruc);
      if (matches) {
        if (!matches.some((match) => match.id === client.id)) matches.push(client);
      } else {
        byRuc.set(ruc, [client]);
      }
    }
    if (code) {
      if (!byCode.has(normalizedCode)) byCode.set(normalizedCode, client);
      codes.push({ label: normalizedCode, option: optionFor(client, code), documents: [] });
    }
    if (label === "varios") continue;
    if (!byName.has(label)) byName.set(label, client);
    const current = names.get(label)?.option.client;
    if (!current || documentScore(client) > documentScore(current)) {
      names.set(label, { label, option: optionFor(client, name), documents });
    }
  }

  for (const [ruc, matches] of byRuc) {
    if (matches.length === 1) {
      rucs.push({ label: ruc, option: optionFor(matches[0], ruc), documents: [] });
    }
  }
  const compare = (a: IndexedOption, b: IndexedOption) => collator.compare(a.label, b.label);
  const namedOptions = Array.from(names.values()).sort(compare);
  const options = {
    name: namedOptions,
    invoiceName: namedOptions.filter(({ option }) => Boolean(option.client.ruc?.trim())),
    code: codes.sort(compare),
    ruc: rucs.sort(compare),
  };
  return { byCode, byName, byDni, byRuc, options };
}

export type SaleClientIndex = ReturnType<typeof indexSaleClients>;

export function searchSaleClients(index: SaleClientIndex, field: ClientSearchField, input: string) {
  const options = index.options[field];
  const query = field === "ruc" ? normalizeClientDocument(input) : normalizeClientText(input);
  if (!query) return options.slice(0, SUGGESTION_LIMIT).map(({ option }) => option);
  const terms = query.split(/\s+/);
  const buckets: IndexedOption[][] = [[], [], [], []];
  for (const entry of options) {
    const { label, documents } = entry;
    const matches = terms.every(
      (term) => label.includes(term) || documents.some((doc) => doc.includes(term)),
    );
    if (!matches) continue;
    let rank = 3;
    if (label === query || documents.includes(query)) rank = 0;
    else if (label.startsWith(query)) rank = 1;
    else if (documents.some((doc) => doc.startsWith(query))) rank = 2;
    if (buckets[rank].length < SUGGESTION_LIMIT) buckets[rank].push(entry);
    if (buckets[0].length === SUGGESTION_LIMIT) break;
  }
  return buckets.flat().slice(0, SUGGESTION_LIMIT).map(({ option }) => option);
}
