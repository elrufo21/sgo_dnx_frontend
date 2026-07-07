import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Package,
  UserCheck,
  DollarSign,
  Menu,
  X,
  Settings2,
  SlidersHorizontal,
  StoreIcon,
  ChevronDown,
  CopySlashIcon,
  Landmark,
  ReceiptText,
  FileInput,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/shared/ui/toast";
import UserFormBase from "@/components/UserFormBase";
import { PASSWORD_EXPIRATION_LOCK_ENABLED } from "@/config";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { useUsersStore } from "@/store/users/users.store";
import type { User } from "@/store/users/users.store";

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
const PASSWORD_POLICY_MESSAGE =
  "La contrasena debe tener minimo 6 caracteres, una mayuscula, una minuscula y un numero";

export default function MainLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState(""); // 🔍 buscador
  const { pathname } = useLocation();
  const openDialog = useDialogStore((state) => state.openDialog);

  const user = useAuthStore((state) => state.user);
  const passwordExpiresAt = useAuthStore((state) => state.passwordExpiresAt);
  const isPasswordExpired = useAuthStore((state) => state.isPasswordExpired);
  const logout = useAuthStore((state) => state.logout);

  const users = useUsersStore((state) => state.users);
  const fetchUsers = useUsersStore((state) => state.fetchUsers);
  const updateUser = useUsersStore((state) => state.updateUser);

  const passwordDialogOpenedRef = useRef(false);
  const resolvingUserRef = useRef(false);
  const userLoadErrorNotifiedRef = useRef(false);
  const authSessionUserIdentity = useMemo(() => {
    const toPositiveNumber = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const normalizeId = (value: unknown) => String(value ?? "").trim();

    const normalizeAlias = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase();

    const stateUserIdRaw = normalizeId(user?.id);
    const statePersonalIdRaw = normalizeId(user?.personalId);
    const stateUserId = toPositiveNumber(user?.id);
    const statePersonalId = toPositiveNumber(user?.personalId);
    const stateAlias = normalizeAlias(user?.username);

    if (typeof window === "undefined") {
      return {
        userIdRaw: stateUserIdRaw,
        personalIdRaw: statePersonalIdRaw,
        userId: stateUserId,
        personalId: statePersonalId,
        alias: stateAlias,
      };
    }

    try {
      const raw = window.localStorage.getItem("sgo.auth.session");
      if (!raw) {
        return {
          userIdRaw: stateUserIdRaw,
          personalIdRaw: statePersonalIdRaw,
          userId: stateUserId,
          personalId: statePersonalId,
          alias: stateAlias,
        };
      }
      const parsed = JSON.parse(raw) as {
        id?: unknown;
        usuarioID?: unknown;
        user?: {
          id?: unknown;
          userId?: unknown;
          usuarioID?: unknown;
          personalId?: unknown;
          username?: unknown;
          UsuarioAlias?: unknown;
        };
      } | null;

      const storageUserId =
        toPositiveNumber(parsed?.user?.id) ||
        toPositiveNumber(parsed?.user?.userId) ||
        toPositiveNumber(parsed?.user?.usuarioID) ||
        toPositiveNumber(parsed?.usuarioID) ||
        toPositiveNumber(parsed?.id);
      const storageUserIdRaw =
        normalizeId(parsed?.user?.id) ||
        normalizeId(parsed?.user?.userId) ||
        normalizeId(parsed?.user?.usuarioID) ||
        normalizeId(parsed?.usuarioID) ||
        normalizeId(parsed?.id);
      const storagePersonalId = toPositiveNumber(parsed?.user?.personalId);
      const storagePersonalIdRaw = normalizeId(parsed?.user?.personalId);
      const storageAlias =
        normalizeAlias(parsed?.user?.username) ||
        normalizeAlias(parsed?.user?.UsuarioAlias);

      return {
        userIdRaw: stateUserIdRaw || storageUserIdRaw,
        personalIdRaw: statePersonalIdRaw || storagePersonalIdRaw,
        userId: stateUserId || storageUserId,
        personalId: statePersonalId || storagePersonalId,
        alias: stateAlias || storageAlias,
      };
    } catch {
      return {
        userIdRaw: stateUserIdRaw,
        personalIdRaw: statePersonalIdRaw,
        userId: stateUserId,
        personalId: statePersonalId,
        alias: stateAlias,
      };
    }
  }, [user?.id, user?.personalId, user?.username]);

  const hasSessionIdentity = useMemo(() => {
    const identity = authSessionUserIdentity;
    return Boolean(
      identity.userId ||
      identity.personalId ||
      identity.userIdRaw ||
      identity.personalIdRaw ||
      identity.alias,
    );
  }, [authSessionUserIdentity]);
  const userInitial =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    "?";
  const userSessionLabel = useMemo(() => {
    const record = user as Record<string, unknown> | null | undefined;
    const role = String(record?.role ?? "").trim();
    return role || "Sesión activa";
  }, [user]);

  const passwordExpirationDateLabel = useMemo(() => {
    if (!passwordExpiresAt) return "fecha no disponible";
    const parsed = Date.parse(passwordExpiresAt);
    if (Number.isNaN(parsed)) return passwordExpiresAt;
    return new Date(parsed).toLocaleDateString("es-PE");
  }, [passwordExpiresAt]);

  const currentUserForPasswordUpdate = useMemo<User | null>(() => {
    const { userId, personalId, alias } = authSessionUserIdentity;
    if (!userId && !personalId && !alias) return null;

    return (
      users.find((item) => Number(item.UsuarioID) === userId) ??
      users.find((item) => Number(item.PersonalId) === personalId) ??
      users.find(
        (item) =>
          String(item.UsuarioAlias ?? "")
            .trim()
            .toLowerCase() === alias,
      ) ??
      null
    );
  }, [authSessionUserIdentity, users]);

  const resolveCurrentUserFromStore = useCallback((): User | null => {
    const { userId, personalId, alias, userIdRaw, personalIdRaw } =
      authSessionUserIdentity;
    if (!userId && !personalId && !alias && !userIdRaw && !personalIdRaw)
      return null;

    const rows = useUsersStore.getState().users;
    const normalizeId = (value: unknown) => String(value ?? "").trim();
    const rowMatchesRawId = (row: User) =>
      normalizeId(row.UsuarioID) === userIdRaw ||
      normalizeId(row.PersonalId) === personalIdRaw ||
      normalizeId(row.UsuarioID) === personalIdRaw ||
      normalizeId(row.PersonalId) === userIdRaw;

    return (
      rows.find((item) => Number(item.UsuarioID) === userId) ??
      rows.find((item) => Number(item.PersonalId) === personalId) ??
      rows.find((item) => Number(item.UsuarioID) === personalId) ??
      rows.find((item) => Number(item.PersonalId) === userId) ??
      rows.find((item) => rowMatchesRawId(item)) ??
      rows.find(
        (item) =>
          String(item.UsuarioAlias ?? "")
            .trim()
            .toLowerCase() === alias,
      ) ??
      null
    );
  }, [authSessionUserIdentity]);

  const ensureCurrentUserLoaded =
    useCallback(async (): Promise<User | null> => {
      const inMemory = resolveCurrentUserFromStore();
      if (inMemory) return inMemory;

      const attempts: Array<"" | "ACTIVO" | "INACTIVO"> = [
        "",
        "ACTIVO",
        "INACTIVO",
      ];
      for (const estado of attempts) {
        await fetchUsers(estado);
        const found = resolveCurrentUserFromStore();
        if (found) return found;
      }

      return null;
    }, [fetchUsers, resolveCurrentUserFromStore]);

  const openPasswordExpiredDialog = useCallback(
    (row: User) => {
      openDialog({
        title: "Cambiar la contraseña",
        content: (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Tu clave ha vencido. Debes cambiar la contraseña para continuar
              usando el sistema.
            </p>
            <p className="text-sm text-slate-700">
              Fecha de vencimiento:{" "}
              <span className="font-semibold">
                {passwordExpirationDateLabel}
              </span>
            </p>
            <UserFormBase
              variant="modal"
              mode="edit"
              fieldsMode="password-only"
              initialData={row}
              onSave={() => true}
            />
          </div>
        ),
        confirmText: "Guardar contraseña",
        cancelText: "Cerrar sesión",
        maxWidth: "sm",
        fullWidth: true,
        disableBackdropClose: true,
        onCancel: () => {
          logout();
          navigate("/login", { replace: true });
        },
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<User> & {
            ConfirmClave?: string;
          };

          const password = data.UsuarioClave ?? "";
          const confirmPassword = data.ConfirmClave ?? "";

          if (!password || !confirmPassword || password !== confirmPassword) {
            toast.error("Las contrasenas no coinciden");
            return false;
          }

          if (!PASSWORD_POLICY_REGEX.test(password)) {
            toast.error(PASSWORD_POLICY_MESSAGE);
            return false;
          }

          const updated = await updateUser(row.UsuarioID, {
            PersonalId: Number(data.PersonalId ?? row.PersonalId ?? 0),
            UsuarioAlias: (
              data.UsuarioAlias ??
              row.UsuarioAlias ??
              user?.username ??
              ""
            ).trim(),
            UsuarioClave: password,
            UsuarioFechaReg:
              data.UsuarioFechaReg ??
              row.UsuarioFechaReg ??
              new Date().toISOString(),
            UsuarioEstado: data.UsuarioEstado ?? row.UsuarioEstado ?? "ACTIVO",
            UsuarioSerie: data.UsuarioSerie ?? row.UsuarioSerie ?? "B001",
            EnviaBoleta: data.EnviaBoleta ?? row.EnviaBoleta ?? 0,
            EnviarFactura: data.EnviarFactura ?? row.EnviarFactura ?? 0,
            EnviaNC: data.EnviaNC ?? row.EnviaNC ?? 0,
            EnviaND: data.EnviaND ?? row.EnviaND ?? 0,
            Administrador: data.Administrador ?? row.Administrador ?? 0,
            area: row.area,
          });

          if (!updated) {
            toast.error("No se pudo actualizar la contraseña.");
            return false;
          }

          await fetchUsers("ACTIVO");
          toast.success("Contrasena actualizada correctamente");
          logout();
          navigate("/login", { replace: true });
          return true;
        },
      });
    },
    [
      fetchUsers,
      openDialog,
      logout,
      navigate,
      passwordExpirationDateLabel,
      updateUser,
      user?.username,
    ],
  );

  useEffect(() => {
    if (!PASSWORD_EXPIRATION_LOCK_ENABLED || !isPasswordExpired) {
      passwordDialogOpenedRef.current = false;
      resolvingUserRef.current = false;
      userLoadErrorNotifiedRef.current = false;
      return;
    }

    if (!hasSessionIdentity) return;
    if (passwordDialogOpenedRef.current) return;
    if (resolvingUserRef.current) return;

    let cancelled = false;
    resolvingUserRef.current = true;

    const run = async () => {
      const row =
        currentUserForPasswordUpdate ?? (await ensureCurrentUserLoaded());
      if (cancelled) return;

      if (!row) {
        if (!userLoadErrorNotifiedRef.current) {
          userLoadErrorNotifiedRef.current = true;
          toast.error(
            "No se pudo cargar el usuario completo para cambiar la contraseña.",
          );
        }
        return;
      }

      userLoadErrorNotifiedRef.current = false;
      passwordDialogOpenedRef.current = true;
      openPasswordExpiredDialog(row);
    };

    void run().finally(() => {
      if (!cancelled) {
        resolvingUserRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentUserForPasswordUpdate,
    ensureCurrentUserLoaded,
    hasSessionIdentity,
    isPasswordExpired,
    openPasswordExpiredDialog,
  ]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen || typeof document === "undefined") return;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!userMenuOpen || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (userMenuContainerRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  const navItems = useMemo(() => {
    const boletasSummaryItem = {
      label: "Resumen de boletas",
      to: "/sales/boletas_summary",
      icon: <CopySlashIcon size={18} />,
    };

    const items = [
      {
        label: "Ventas",
        to: "/sales/pos",
        icon: <DollarSign size={18} />,
      },
      {
        label: "Ventas Form",
        to: "/sales/html_capture/new",
        icon: <FileInput size={18} />,
      },
      {
        label: "Lista de ventas ",
        to: "/sales/order_notes",
        icon: <CopySlashIcon size={18} />,
        state: { resetOrderNotesFilters: true },
      },
      {
        label: "Control de flujo de caja",
        to: "/cash_flow_control",
        icon: <StoreIcon />,
      },
      { label: "Compras", to: "/shopping", icon: <CopySlashIcon size={18} /> },
      {
        label: "Facturas servicio",
        to: "/service-invoices",
        icon: <ReceiptText size={18} />,
      },
      { label: "Productos", to: "/products", icon: <Package size={18} /> },
      { label: "Cliente", to: "/customers", icon: <UserCheck size={18} /> },
      {
        label: "Contabilidad",
        to: "/accounting",
        icon: <Landmark size={18} />,
      },
      {
        label: "Mantenimiento",
        to: "/maintenance",
        icon: <Settings2 />,
      },
      {
        label: "Configuración",
        to: "/configuration",
        icon: <SlidersHorizontal size={18} />,
      },
    ];

    if (user?.boletaPorLote !== false) {
      items.splice(2, 0, boletasSummaryItem);
    }
    return items;
  }, [user?.boletaPorLote]);

  const filteredItems = navItems.filter((item) =>
    item.label.toUpperCase().includes(search.toUpperCase()),
  );

  // Render de items del menú
  const renderNavItem = (
    item: (typeof navItems)[0],
    alwaysShowLabel = false,
  ) => {
    const active = pathname === item.to || pathname.startsWith(item.to + "/");

    return (
      <Link
        key={item.to}
        to={item.to}
        state={item.state}
        className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          !open && !alwaysShowLabel ? "justify-center" : "justify-start"
        } ${
          active
            ? "bg-slate-700 text-white shadow-sm"
            : "text-slate-200 hover:bg-slate-700/70 hover:text-white"
        }`}
        title={!open && !alwaysShowLabel ? item.label : undefined}
        onClick={() => setMobileOpen(false)}
      >
        {item.icon}
        {(open || alwaysShowLabel) && (
          <span className="truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-100">
      <aside
        className={`hidden md:flex shrink-0 flex-col bg-[#1f2b30] shadow-xl transition-all duration-300 ${
          open
            ? "w-[var(--app-shell-sidebar-open)]"
            : "w-[var(--app-shell-sidebar-collapsed)]"
        }`}
      >
        <div className="relative flex items-center border-b border-slate-700/70 px-3 py-3">
          <h1
            className={`truncate text-base font-semibold text-white transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            DNX VENTAS
          </h1>

          <button
            onClick={() => setOpen(!open)}
            className={`ml-auto rounded-md p-2 text-white transition-colors hover:bg-slate-700 ${
              !open ? "absolute right-2 top-1/2 -translate-y-1/2" : ""
            }`}
          >
            <Menu size={20} />
          </button>
        </div>

        {open && (
          <div className="mt-3 px-3">
            <input
              type="text"
              placeholder="Buscar módulo..."
              data-no-uppercase="true"
              className="h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Navegación */}
        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
          {(search ? filteredItems : navItems).map((item) =>
            renderNavItem(item),
          )}
        </nav>

        <div className="border-t border-slate-700/70 px-3 py-3 text-center text-xs text-slate-400">
          {open && "© 2025 Mi Empresa"}
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#222d32]/55 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[var(--app-shell-sidebar-open)] flex-col bg-[#1f2b30] text-white shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
          <h1 className="text-base font-semibold text-white">DNX VENTAS</h1>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-2 transition-colors hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 px-3">
          <input
            type="text"
            placeholder="Buscar módulo..."
            data-no-uppercase="true"
            className="h-11 w-full rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
          {(search ? filteredItems : navItems).map((item) =>
            renderNavItem(item, true),
          )}
        </nav>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="h-[var(--app-shell-header-h)] bg-[#96312a] px-2 text-white shadow sm:px-4 lg:px-5 xl:px-6">
          <div className="mx-auto flex h-full w-full max-w-[var(--app-shell-content-max)] items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                className="rounded-md p-2 transition-colors hover:bg-slate-500 md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              <h2 className="line-clamp-1 text-base font-semibold sm:text-lg lg:text-xl">
                Panel de Control
              </h2>
            </div>

            <div ref={userMenuContainerRef} className="relative shrink-0">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/20 sm:gap-3 sm:px-3 sm:py-2"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-900 sm:h-9 sm:w-9">
                  {userInitial}
                </div>
                <div className="hidden min-w-0 sm:flex flex-col text-left leading-tight text-white">
                  <span className="text-sm font-semibold">
                    {user?.displayName ?? user?.username ?? "Usuario"}
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {userSessionLabel}
                  </span>
                </div>
                <ChevronDown size={16} className="text-white/80" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-slate-100 bg-white text-slate-800 shadow-lg">
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      navigate("/login", { replace: true });
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-main-scroll flex-1 overflow-y-auto bg-slate-100 px-[var(--app-shell-main-px)] py-[var(--app-shell-main-py)] min-h-0">
          <div className="mx-auto w-full max-w-[var(--app-shell-content-max)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
