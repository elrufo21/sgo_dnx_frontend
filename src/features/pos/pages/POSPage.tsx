import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShoppingCart,
  TableProperties,
  Trash2,
  X,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import NavigableNumberInput from "@/components/inputs/NavigableNumberInput";
import { useProductsStore } from "@/store/products/products.store";
import { usePosStore, selectTotals } from "@/store/pos/pos.store";
import { useDialogStore } from "@/store/app/dialog.store";
import { usePosCartDraftPersistence } from "@/features/pos/hooks/usePosCartDraftPersistence";
import type { Product } from "@/types/product";
import type { ProductUnitOption } from "@/types/product";
import type { PosCartItem } from "@/types/pos";
import { toast } from "@/shared/ui/toast";

type PosCatalogProduct = Product & {
  catalogKey: string;
  detalleId?: number;
  isVariation?: boolean;
  baseProductId?: number;
  valorUM?: number;
};

type HtmlCaptureLine = {
  code: string;
  quantity: number;
};
type HtmlCaptureData = {
  transactionNumber: string;
  memberCode: string;
  customerName: string;
  ruc: string;
  date: string;
  discount: number;
  lines: HtmlCaptureLine[];
};

const columnHelper = createColumnHelper<PosCatalogProduct>();
const PAGE_SIZE = 24;

const priceLabel = (product: Product) =>
  Number(product.preVenta ?? product.preVentaB ?? 0).toFixed(2);
const sortCatalogProductsByCode = (products: PosCatalogProduct[]) =>
  [...products].sort((a, b) =>
    String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
const buildVariationDetailId = (baseId: number, index: number) =>
  -1 * (baseId * 1000 + (index + 1));
const getCartItemKey = (item: Pick<PosCartItem, "productId" | "detalleId">) =>
  Number(item.detalleId ?? 0) || Number(item.productId ?? 0);
const normalizeProductCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();
const getCapturedProductId = (code: string) =>
  -1 *
  (1000000 +
    Array.from(code).reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) % 900000,
      0,
    ));
const readHtmlText = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim() ?? "";
const parseHtmlQuantity = (value: unknown) => {
  const chunks = String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? [];
  return chunks.reduce((total, chunk) => {
    const parsed = Number(chunk.replace(",", "."));
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
};
const extractFrameFileName = (html: string) => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const src = document.querySelector("frame")?.getAttribute("src") ?? "";
  const decoded = decodeURIComponent(src.replace(/\\/g, "/"));
  return decoded.split("/").pop()?.trim() ?? "";
};
const parseHtmlCapture = (html: string): HtmlCaptureData => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const table = document.querySelector("table");
  const ruc = readHtmlText(document, "#section-1 .medium-font.center-align");
  const memberSource = `${readHtmlText(document, "#section-6 .fright.left-align")}#`;
  const memberCode = memberSource
    .replace("Miembro Teléfono", "#")
    .replace("No. de Membresia", "")
    .replace(":", "")
    .split("#")[0]
    .trim();
  const discountText = readHtmlText(document, "#discount .sections.summary")
    .replace("DISCOUNT", "")
    .trim();
  const lines =
    document.getElementById("section-6") && table
      ? Array.from(table.querySelectorAll("tr"))
          .slice(1)
          .map((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            return {
              code: normalizeProductCode(cells[0]?.textContent),
              quantity: parseHtmlQuantity(cells[5]?.textContent),
            };
          })
          .filter((line) => line.code && line.quantity > 0)
      : [];

  return {
    transactionNumber: readHtmlText(document, "#section-6 .center.medium-font"),
    memberCode,
    customerName: readHtmlText(document, "#section-2 .fleft"),
    ruc,
    date: readHtmlText(
      document,
      ruc.toUpperCase().includes("FACTURA")
        ? "#section-5 .fleft"
        : "#section-3 .fleft",
    ),
    discount: parseHtmlQuantity(discountText),
    lines,
  };
};
const hasInvalidQuantityForPayment = (item: PosCartItem) => {
  const quantity = Number(item.cantidad ?? 0);
  return !Number.isFinite(quantity) || quantity <= 0;
};
const normalizeUnitLabel = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();
const canonicalUnit = (value: unknown) => {
  const unit = normalizeUnitLabel(value);
  if (["L", "LT", "LTS", "LITRO", "LITROS"].includes(unit)) return "LITRO";
  if (["ML", "MILILITRO", "MILILITROS"].includes(unit)) return "ML";
  if (["KG", "KGS", "KILO", "KILOS", "KILOGRAMO", "KILOGRAMOS"].includes(unit))
    return "KG";
  if (["G", "GR", "GRAMO", "GRAMOS"].includes(unit)) return "G";
  return unit;
};
const getKnownUnitRatio = (fromUnit: unknown, toUnit: unknown): number => {
  const from = canonicalUnit(fromUnit);
  const to = canonicalUnit(toUnit);
  if (!from || !to || from === to) return 1;
  const key = `${from}>${to}`;
  const ratioMap: Record<string, number> = {
    "LITRO>ML": 1000,
    "ML>LITRO": 0.001,
    "KG>G": 1000,
    "G>KG": 0.001,
  };
  return ratioMap[key] ?? 0;
};
const deriveVariationReductionValue = (
  baseUnit: unknown,
  variation: ProductUnitOption,
) => {
  const rawFactor = Number(variation.valorUM ?? variation.factor ?? 0);
  if (Number.isFinite(rawFactor) && rawFactor > 0) {
    return Number(rawFactor.toFixed(6));
  }

  // Fallback por unidades conocidas: convertir de unidad alterna a unidad principal.
  const knownRatio = getKnownUnitRatio(variation.unidadMedida, baseUnit);
  if (knownRatio > 0) {
    return Number(knownRatio.toFixed(6));
  }

  return 1;
};
const deriveVariationStock = (
  baseStockRaw: unknown,
  baseUnit: unknown,
  variation: ProductUnitOption,
) => {
  const baseStock = Number(baseStockRaw);
  const safeBaseStock = Number.isFinite(baseStock) ? baseStock : 0;
  const reportedVariationStock = Number(variation.cantidad ?? 0);
  const safeReportedStock = Number.isFinite(reportedVariationStock)
    ? reportedVariationStock
    : 0;
  const variationUnit = normalizeUnitLabel(variation.unidadMedida);
  const principalUnit = normalizeUnitLabel(baseUnit);
  const hasDifferentUnit =
    variationUnit !== "" &&
    principalUnit !== "" &&
    variationUnit !== principalUnit;
  const stockLooksUnconverted =
    hasDifferentUnit &&
    Math.abs(safeReportedStock - safeBaseStock) < 0.000001 &&
    safeBaseStock > 0;
  const reductionValue = deriveVariationReductionValue(baseUnit, variation);

  if (!stockLooksUnconverted && safeReportedStock > 0) {
    return safeReportedStock;
  }

  if (Number.isFinite(reductionValue) && reductionValue > 0) {
    const converted = safeBaseStock / reductionValue;
    if (Number.isFinite(converted)) {
      return Number(converted.toFixed(6));
    }
  }

  return safeReportedStock;
};

const POSPage = () => {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { products, fetchProducts, loading } = useProductsStore();
  const items = usePosStore((state) => state.items);
  const totals = usePosStore(selectTotals);
  const addProduct = usePosStore((state) => state.addProduct);
  const updateQuantity = usePosStore((state) => state.updateQuantity);
  const updatePrice = usePosStore((state) => state.updatePrice);
  const removeItem = usePosStore((state) => state.removeItem);
  const clearCart = usePosStore((state) => state.clearCart);
  const clearEditingNota = usePosStore((state) => state.clearEditingNota);
  const editingNotaId = usePosStore((state) => state.editingNotaId);
  const isEditingMode = usePosStore((state) => state.isEditingMode);
  const openDialog = useDialogStore((state) => state.openDialog);
  const { resetDraftForNewSale } = usePosCartDraftPersistence({
    enabled: true,
    autosave: true,
    hydrateFromStorage: true,
  });
  const isCardsView = viewMode === "cards";
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const captureFileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [lastHtmlCapture, setLastHtmlCapture] =
    useState<HtmlCaptureData | null>(null);

  const focusSearchInput = () => {
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input || input.disabled) return;
      input.focus({ preventScroll: true });
      const length = input.value.length;
      input.setSelectionRange(length, length);
    });
  };

  const handleSearchTermInput = (event: FormEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
  };

  useEffect(() => {
    if (!products.length) {
      fetchProducts();
    }
  }, [fetchProducts, products.length]);

  useEffect(() => {
    const routeState =
      (location.state as {
        preserveCart?: boolean;
        resetCart?: boolean;
      } | null) ?? null;
    const preserveCart = routeState?.preserveCart === true;
    const resetCart = routeState?.resetCart === true;
    if (resetCart) {
      clearCart();
      clearEditingNota();
      void resetDraftForNewSale();
      return;
    }
    if (preserveCart) return;

    clearEditingNota();
  }, [clearCart, clearEditingNota, location.state, resetDraftForNewSale]);

  const hasInvalidPriceForPayment = (item: PosCartItem) => {
    const minPrice = Math.max(0, Number(item.precioMinimo ?? 0) || 0);
    const draftValue = priceDrafts[getCartItemKey(item)];
    if (draftValue === undefined) {
      const storedPrice = Number(item.precio ?? 0);
      return !Number.isFinite(storedPrice) || storedPrice < minPrice;
    }

    const normalizedDraft = draftValue.trim();
    if (!normalizedDraft) return true;
    const draftPrice = Number(normalizedDraft);
    return !Number.isFinite(draftPrice) || draftPrice < minPrice;
  };

  const goToPayment = () => {
    if (!items.length) {
      toast.error("Agrega productos antes de procesar");
      return;
    }

    const normalizedPath = location.pathname.toLowerCase();
    const paymentBasePath = normalizedPath.includes("/sales/pos")
      ? "/sales/pos/payment"
      : "/pos/payment";
    const hasEditingNota =
      isEditingMode &&
      Number.isFinite(Number(editingNotaId)) &&
      Number(editingNotaId) > 0;
    const paymentTarget = hasEditingNota
      ? `${paymentBasePath}/${Number(editingNotaId)}?mode=edit`
      : paymentBasePath;

    if (items.some(hasInvalidQuantityForPayment)) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    if (items.some(hasInvalidPriceForPayment)) {
      toast.error("El precio no debe ser menor al precio establecido.");
      return;
    }

    navigate(
      paymentTarget,
      lastHtmlCapture ? { state: { htmlCapture: lastHtmlCapture } } : undefined,
    );
  };

  const handleCartShortcut = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      goToPayment();
      return;
    }

    setMobileCartOpen(true);
  };

  const handleAddProduct = (product: PosCatalogProduct) => {
    addProduct(product, 1);

    focusSearchInput();
  };

  const catalogProducts = useMemo<PosCatalogProduct[]>(() => {
    const expanded: PosCatalogProduct[] = [];
    products.forEach((product) => {
      expanded.push({
        ...product,
        valorUM: 1,
        catalogKey: `base-${product.id}`,
      });

      const variations = Array.isArray(product.unidadesAlternas)
        ? product.unidadesAlternas
        : [];
      variations.forEach((variation, index) => {
        const variationReductionValue = deriveVariationReductionValue(
          product.unidadMedida,
          variation,
        );
        const variationImage = String(variation.unidadImagen ?? "").trim();
        const variationStock = deriveVariationStock(
          product.cantidad,
          product.unidadMedida,
          variation,
        );
        expanded.push({
          ...product,
          detalleId: buildVariationDetailId(product.id, index),
          isVariation: true,
          baseProductId: product.id,
          unidadMedida: variation.unidadMedida || product.unidadMedida,
          valorUM: variationReductionValue,
          cantidad: variationStock,
          preCosto: Number(variation.preCosto ?? product.preCosto ?? 0),
          preVenta: Number(variation.preVenta ?? product.preVenta ?? 0),
          preVentaB: Number(variation.preVentaB ?? product.preVentaB ?? 0),
          images: variationImage ? [variationImage] : (product.images ?? []),
          catalogKey: `var-${product.id}-${index}`,
        });
      });
    });

    return expanded;
  }, [products]);

  const sortedCatalogProducts = useMemo(
    () => sortCatalogProductsByCode(catalogProducts),
    [catalogProducts],
  );

  const productByCaptureCode = useMemo(() => {
    const map = new Map<string, PosCatalogProduct>();
    sortedCatalogProducts.forEach((product) => {
      const key = normalizeProductCode(product.codigo);
      if (key && !map.has(key)) map.set(key, product);
    });
    return map;
  }, [sortedCatalogProducts]);

  const handleCaptureFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const firstHtml = await files[0].text();
    let capture = parseHtmlCapture(firstHtml);
    if (!capture.lines.length && files.length > 1) {
      const frameFileName = extractFrameFileName(firstHtml).toLowerCase();
      const candidates = frameFileName
        ? [
            ...files.filter((file) => file.name.toLowerCase() === frameFileName),
            ...files.filter((file) => file.name.toLowerCase() !== frameFileName),
          ]
        : files.slice(1);

      for (const candidate of candidates) {
        capture = parseHtmlCapture(await candidate.text());
        if (capture.lines.length) break;
      }
    }

    if (!capture.lines.length) {
      const frameFileName = extractFrameFileName(firstHtml);
      toast.error(
        frameFileName
          ? `Ese HTML solo apunta a un frame. Selecciona tambien ${frameFileName}.`
          : "No se encontraron productos en el HTML.",
      );
      return;
    }

    const matched: Array<{ product: PosCatalogProduct; quantity: number }> = [];
    const missing: string[] = [];

    capture.lines.forEach((line) => {
      const product = productByCaptureCode.get(line.code);
      if (product) {
        matched.push({ product, quantity: line.quantity });
      } else {
        matched.push({
          product: {
            id: getCapturedProductId(line.code),
            codigo: line.code,
            nombre: line.code,
            unidadMedida: "UND",
            valorCritico: 0,
            preCosto: 0,
            preVenta: 0,
            preVentaB: 0,
            aplicaINV: "S",
            cantidad: 0,
            usuario: "",
            estado: "ACTIVO",
            catalogKey: `captured-${line.code}`,
          },
          quantity: line.quantity,
        });
        missing.push(line.code);
      }
    });

    if (!matched.length) {
      toast.error(
        sortedCatalogProducts.length
          ? `Códigos no encontrados: ${missing.slice(0, 5).join(", ")}`
          : `El HTML trae ${capture.lines[0].code}, pero el catálogo no tiene productos.`,
      );
      return;
    }

    clearCart();
    void resetDraftForNewSale();
    matched.forEach(({ product, quantity }) => addProduct(product, quantity));
    setLastHtmlCapture(capture);
    toast.success(
      `Archivo cargado: ${matched.length} productos${missing.length ? `, ${missing.length} temporales` : ""}.`,
    );
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const source =
      term.length < 2
        ? sortedCatalogProducts
        : sortedCatalogProducts.filter(
            (p) =>
              p.codigo?.toLowerCase().includes(term) ||
              p.nombre?.toLowerCase().includes(term) ||
              p.unidadMedida?.toLowerCase().includes(term),
          );

    return source;
  }, [searchTerm, sortedCatalogProducts]);

  const visibleProducts = useMemo(() => {
    if (viewMode !== "cards") return filteredProducts;
    return filteredProducts.slice(0, page * PAGE_SIZE);
  }, [filteredProducts, page, viewMode]);

  const hasMoreProducts =
    viewMode === "cards" && visibleProducts.length < filteredProducts.length;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (!isCardsView || !hasMoreProducts) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { root: null, rootMargin: "200px 0px 200px 0px", threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreProducts, isCardsView]);

  useEffect(() => {
    if (!isCardsView) return;

    const input = searchInputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    const length = input.value.length;
    input.setSelectionRange(length, length);
  }, [isCardsView]);

  const handleQuantityChange = (item: PosCartItem, delta: number) => {
    const desired = Math.max(1, (item.cantidad ?? 0) + delta);
    updateQuantity(getCartItemKey(item), desired);
  };

  const handleManualQuantity = (item: PosCartItem, value: string) => {
    if (value === "") {
      updateQuantity(getCartItemKey(item), 0);
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const next = Math.max(1, parsed);
    updateQuantity(getCartItemKey(item), next);
  };

  const handlePriceChange = (item: PosCartItem, value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;

    setPriceDrafts((prev) => ({ ...prev, [getCartItemKey(item)]: value }));

    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      updatePrice(getCartItemKey(item), parsed);
    }
  };

  const handlePriceBlur = (item: PosCartItem, value: string) => {
    if (value.trim() === "") {
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setPriceDrafts((prev) => ({
        ...prev,
        [getCartItemKey(item)]: String(item.precio ?? 0),
      }));
      return;
    }

    setPriceDrafts((prev) => ({
      ...prev,
      [getCartItemKey(item)]: String(parsed),
    }));
    updatePrice(getCartItemKey(item), parsed);
  };

  useEffect(() => {
    setPriceDrafts((prev) => {
      const next: Record<number, string> = {};
      items.forEach((item) => {
        const itemKey = getCartItemKey(item);
        next[itemKey] = prev[itemKey] ?? item.precio?.toString() ?? "";
      });
      return next;
    });
  }, [items]);

  const confirmClear = () =>
    openDialog({
      title: "Vaciar carrito",
      content: <p>¿Seguro que deseas eliminar todos los ítems del carrito?</p>,
      onConfirm: () => {
        clearCart();
        toast.success("Carrito limpiado");
      },
      confirmText: "Vaciar",
      cancelText: "Cancelar",
    });

  const productColumns = [
    columnHelper.display({
      id: "imagen",
      header: "Img",
      cell: ({ row }) => {
        const image = row.original.images?.[0];
        if (!image) {
          return (
            <div className="h-9 w-9 rounded-md border border-slate-200 bg-slate-100" />
          );
        }
        return (
          <img
            src={image}
            alt={row.original.nombre}
            className="h-9 w-9 rounded-md border border-slate-200 object-cover"
          />
        );
      },
    }),
    columnHelper.accessor("codigo", {
      header: "Código",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("nombre", {
      header: "Nombre",
      cell: (info) => info.getValue(),
    }),
    columnHelper.display({
      id: "unidad",
      header: "U.M.",
      cell: ({ row }) => {
        const unit = row.original.unidadMedida ?? "UND";
        return row.original.isVariation ? `${unit}` : unit;
      },
    }),
    columnHelper.display({
      id: "precio",
      header: "P. Venta",
      cell: ({ row }) => (
        <span className="font-semibold text-right block">
          S/ {priceLabel(row.original)}
        </span>
      ),
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.display({
      id: "stock",
      header: "Stock",
      cell: ({ row }) => {
        const stockValue = Number(row.original.cantidad ?? 0);
        return (
          <span className="text-right block">
            {stockValue}
          </span>
        );
      },
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.display({
      id: "action",
      header: "",
      cell: ({ row }) => (
        <button
          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors text-sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAddProduct(row.original);
          }}
        >
          <Plus className="w-4 h-4" />
          Añadir
        </button>
      ),
      meta: { tdClassName: "text-right" },
    }),
  ];

  const renderCartPanel = ({ mobile = false }: { mobile?: boolean } = {}) => (
    <div
      className={`bg-white rounded-xl shadow p-4 ${mobile ? "h-full flex flex-col" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Carrito</h3>
          <p className="text-xs text-gray-500">Actualización en tiempo real</p>
        </div>
        <button
          className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
          onClick={confirmClear}
          disabled={!items.length}
        >
          <RotateCcw className="w-4 h-4" />
          Vaciar
        </button>
      </div>

      <div
        className={`space-y-3 overflow-y-auto pr-1 ${
          mobile
            ? "flex-1 min-h-0 max-h-none"
            : "max-h-[min(56vh,520px)] md:max-h-[58vh]"
        }`}
      >
        {items.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-6">
            No hay productos en el carrito.
          </div>
        )}

        {items.map((item) => {
          const isZeroOrNegative = (item.cantidad ?? 0) <= 0;
          const minPrice = Math.max(0, Number(item.precioMinimo ?? 0) || 0);
          const highlightClass =
            isZeroOrNegative
              ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-gray-50";

          return (
            <article
              key={getCartItemKey(item)}
              className={`border rounded-lg p-3 hover:border-slate-300 transition-colors ${highlightClass}`}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.unidadMedida ?? "UND"}
                  </p>
                  {item.stock !== undefined && (
                    <p className="text-xs text-gray-500">
                      Stock:{" "}
                      <span>{item.stock}</span>
                    </p>
                  )}
                </div>

                <div className="text-right w-32">
                  <label className="text-xs text-gray-500 block text-left">
                    P. Unitario
                  </label>

                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-sm text-gray-500">S/</span>
                    <NavigableNumberInput
                      min={minPrice}
                      step="0.01"
                      value={priceDrafts[getCartItemKey(item)] ?? item.precio}
                      onChange={(value) => handlePriceChange(item, value)}
                      onBlur={(event) =>
                        handlePriceBlur(item, event.currentTarget.value)
                      }
                      navGroup="pos-price-input"
                      className="w-full text-right border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    className="p-1 rounded bg-white border hover:bg-slate-50"
                    onClick={() => handleQuantityChange(item, -1)}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <NavigableNumberInput
                    value={item.cantidad === 0 ? "" : item.cantidad}
                    onChange={(value) => handleManualQuantity(item, value)}
                    navGroup="pos-quantity-input"
                    className="w-16 text-center border rounded-md py-1"
                  />
                  <button
                    className="p-1 rounded bg-white border hover:bg-slate-50"
                    onClick={() => handleQuantityChange(item, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p
                      className={`text-base font-semibold ${
                        isZeroOrNegative ? "text-red-600" : "text-slate-800"
                      }`}
                    >
                      S/ {(item.precio * item.cantidad).toFixed(2)}
                    </p>
                  </div>
                  <button
                    className="p-2 rounded bg-red-50 text-red-600 hover:bg-red-100"
                    onClick={() => removeItem(getCartItemKey(item))}
                    title="Quitar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3 space-y-2">
        <div className="flex justify-between text-sm text-gray-700">
          <span>Importe</span>
          <span className="font-semibold">S/ {totals.subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base text-slate-800 font-bold">
          <span>Total</span>
          <span>S/ {totals.total.toFixed(2)}</span>
        </div>
        <button
          className="w-full mt-3 inline-flex justify-center items-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
          disabled={!items.length}
          onClick={goToPayment}
        >
          <CheckCircle2 className="w-5 h-5" />
          Ir a pago
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div></div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border bg-gray-50 overflow-hidden">
                <button
                  className={`flex items-center gap-1 px-3 py-1 text-sm ${
                    viewMode === "cards"
                      ? "bg-slate-700 text-white"
                      : "text-slate-700"
                  }`}
                  onClick={() => setViewMode("cards")}
                  title="Ver como cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Cards
                </button>
                <button
                  className={`flex items-center gap-1 px-3 py-1 text-sm ${
                    viewMode === "table"
                      ? "bg-slate-700 text-white"
                      : "text-slate-700"
                  }`}
                  onClick={() => setViewMode("table")}
                  title="Ver como tabla"
                >
                  <TableProperties className="w-4 h-4" />
                  Tabla
                </button>
              </div>
            </div>
            <button
              type="button"
              className="fixed right-3 top-[calc(var(--app-shell-header-h)+0.75rem)] z-30 flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white shadow-lg xl:static xl:z-auto xl:shadow-sm"
              onClick={handleCartShortcut}
              aria-label="Abrir carrito"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{items.length} ítems</span>
              <span className="text-gray-300">|</span>
            </button>
          </div>

          <div
            className={`bg-white rounded-xl shadow p-3 space-y-3 flex flex-col ${
              isCardsView ? "md:h-[min(74vh,720px)] md:min-h-[420px]" : ""
            }`}
          >
            {isCardsView && (
              <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  ref={searchInputRef}
                  autoFocus
                  data-no-uppercase="true"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onInput={handleSearchTermInput}
                  placeholder="Buscar por código o nombre"
                  className="w-full border px-3 py-2 rounded-lg focus:ring focus:ring-slate-200 text-sm"
                />
                <span className="text-xs text-gray-500 sm:whitespace-nowrap">
                  {filteredProducts.length} resultados
                </span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Cargando productos...</span>
              </div>
            ) : (
              <div
                className={`flex-1 min-h-0 pr-1 ${
                  isCardsView ? "overflow-y-auto" : "overflow-visible"
                }`}
              >
                {isCardsView ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleProducts.map((product) => {
                      const image = product.images?.[0];
                      const stockValue = Number(product.cantidad ?? 0);

                      return (
                        <article
                          key={product.catalogKey}
                          className="border rounded-xl border-slate-200 bg-gray-50 p-3 hover:border-slate-300 transition-colors flex flex-col"
                        >
                          <div className="aspect-video rounded-lg overflow-hidden bg-white border flex items-center justify-center">
                            {image ? (
                              <img
                                src={image}
                                alt={product.nombre}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="text-sm text-gray-500">
                                Sin imagen
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex-1 flex flex-col gap-1">
                            <p className="text-xs text-gray-500">
                              {product.codigo}
                            </p>
                            <h3 className="text-sm font-semibold text-slate-800 line-clamp-2">
                              {product.nombre}
                            </h3>
                            {product.isVariation ? (
                              <p className="text-xs font-medium text-blue-700">
                                Variacion: {product.unidadMedida}
                              </p>
                            ) : null}
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>
                                Stock: {stockValue} {product.unidadMedida}
                              </span>
                              <span className="font-semibold text-slate-800">
                                S/ {priceLabel(product)}
                              </span>
                            </div>
                          </div>

                          <button
                            className="mt-3 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors text-sm"
                            onClick={() => handleAddProduct(product)}
                          >
                            <Plus className="w-4 h-4" />
                            Añadir
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <DataTable
                    data={sortedCatalogProducts}
                    columns={productColumns}
                    filterKeys={["codigo", "nombre", "unidadMedida"]}
                    onRowClick={handleAddProduct}
                    searchPlaceholder="Buscar por código o nombre"
                    globalFilterValue={searchTerm}
                    onGlobalFilterValueChange={setSearchTerm}
                  />
                )}
                {hasMoreProducts && (
                  <div
                    ref={loadMoreRef}
                    className="mt-3 h-10 flex items-center justify-center text-xs text-gray-500"
                  >
                    Cargando más productos...
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="hidden xl:block space-y-3 xl:sticky xl:top-0 xl:self-start">
          {renderCartPanel()}
        </section>
      </div>

      {mobileCartOpen && (
        <div className="xl:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Cerrar carrito"
            onClick={() => setMobileCartOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[min(84vh,720px)] rounded-t-2xl bg-slate-100 p-3 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-slate-700">
                Resumen de carrito
              </p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"
                onClick={() => setMobileCartOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-2.75rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              {renderCartPanel({ mobile: true })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
