import type { Product } from "@/types/product";

const normalizeSearch = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .toLowerCase()
  .trim();

export function indexProductCatalog(products: Product[]) {
  const activeProducts = products.filter((product) => product.estado !== "INACTIVO");
  return {
    products: activeProducts,
    text: activeProducts.map((product) => normalizeSearch(`${product.codigo ?? ""} ${product.nombre ?? ""}`)),
  };
}

export function searchProductCatalog(index: ReturnType<typeof indexProductCatalog>, query: string) {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return index.products;
  const matches = index.products.filter((_product, position) =>
    terms.every((term) => index.text[position].includes(term)),
  );
  return matches.length === index.products.length ? index.products : matches;
}
