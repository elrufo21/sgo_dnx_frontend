import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { allPermissionCodes, permissionGroups } from "@/shared/security/permissions";
import Checkbox from "@mui/material/Checkbox";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Save, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type PermissionForm = {
  areaId: string;
  userId: string;
};

type PermissionProfileResponse = { permisos?: { codigo?: string; permitido?: boolean; permisoArea?: boolean; excepcionUsuario?: boolean | null }[] };
type Override = "inherit" | "allow" | "deny";
type PermissionUser = { id: number; areaId: number; alias: string; nombre: string; administrador: boolean };

export default function PermissionsSettingsPage({ mode = "area" }: { mode?: "area" | "user" }) {
  const [areas, setAreas] = useState<{ id: number; area: string }[]>([]);
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [usersError, setUsersError] = useState("");
  const [enabledPermissions, setEnabledPermissions] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [areaPermissions, setAreaPermissions] = useState<Set<string>>(new Set());
  const [profileError, setProfileError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const methods = useForm<PermissionForm>({
    defaultValues: { areaId: "", userId: "" },
  });
  const selectedAreaId = useWatch({ control: methods.control, name: "areaId" });
  const selectedUserId = useWatch({ control: methods.control, name: "userId" });

  useEffect(() => {
    void apiRequest<{ id: number; area: string }[]>({ url: buildApiUrl("/Permisos/areas") }).then((result) => {
      if (Array.isArray(result)) setAreas(result);
      else setUsersError("No se pudieron cargar las áreas.");
    });
    if (mode === "user") {
      void apiRequest<PermissionUser[]>({ url: buildApiUrl("/Permisos/usuarios") }).then((result) => {
        if (Array.isArray(result)) setUsers(result);
        else setUsersError("No se pudieron cargar los usuarios.");
      });
    }
  }, [mode]);

  const selectedArea = useMemo(
    () => areas.find((area) => String(area.id) === selectedAreaId),
    [areas, selectedAreaId],
  );
  const areaUsers = useMemo(() => {
    if (!selectedArea) return users;
    return users.filter(
      (user) => user.areaId === Number(selectedAreaId),
    );
  }, [selectedArea, selectedAreaId, users]);
  const selectedUser = useMemo(
    () => areaUsers.find((user) => String(user.id) === selectedUserId),
    [areaUsers, selectedUserId],
  );
  const isAreaProfile = mode === "area";
  const allEnabled = enabledPermissions.size === allPermissionCodes.length;

  const togglePermission = (code: string) => {
    setEnabledPermissions((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    setEnabledPermissions(
      allEnabled ? new Set<string>() : new Set<string>(allPermissionCodes),
    );
  };

  useEffect(() => {
    setProfileError("");
    setOverrides({});
    if (!selectedAreaId || (!isAreaProfile && !selectedUserId)) {
      setEnabledPermissions(new Set<string>());
      setAreaPermissions(new Set<string>());
      setLoadingProfile(false);
      return;
    }

    let active = true;
    setLoadingProfile(true);
    const query = new URLSearchParams({ areaId: selectedAreaId });
    if (selectedUserId) query.set("usuarioId", selectedUserId);
    void apiRequest<PermissionProfileResponse>({
      url: buildApiUrl(`/Permisos/perfil?${query.toString()}`),
    }).then((response) => {
      if (!active) return;
      const permisos = (response as PermissionProfileResponse)?.permisos;
      if (!Array.isArray(permisos) || permisos.length !== allPermissionCodes.length ||
          permisos.some((permission) => typeof permission.permisoArea !== "boolean" || !("excepcionUsuario" in permission))) {
        setProfileError("No se pudo cargar el perfil. Verifica la conexión y la actualización de permisos en el servidor.");
        setEnabledPermissions(new Set());
        return;
      }
      setAreaPermissions(new Set(permisos.filter((p) => p.permisoArea).map((p) => p.codigo?.toUpperCase()).filter((code): code is string => Boolean(code))));
      setOverrides(Object.fromEntries(permisos.map((p) => [p.codigo?.toUpperCase() ?? "", p.excepcionUsuario === null ? "inherit" : p.excepcionUsuario ? "allow" : "deny"])));
      setEnabledPermissions(new Set(
        permisos
          .filter((permission) => permission.permitido)
          .map((permission) => permission.codigo?.toUpperCase())
          .filter((code): code is string => Boolean(code)),
      ));
    }).finally(() => {
      if (active) setLoadingProfile(false);
    });

    return () => { active = false; };
  }, [selectedAreaId, selectedUserId, isAreaProfile]);

  const saveProfile = async () => {
    if (!selectedAreaId || (!isAreaProfile && !selectedUserId) || profileError) {
      toast.warning("Selecciona un perfil válido antes de guardar.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest({
        url: buildApiUrl("/Permisos/perfil"),
        method: "PUT",
        data: {
          areaId: Number(selectedAreaId),
          usuarioId: isAreaProfile ? null : Number(selectedUserId),
          permisos: allPermissionCodes.map((codigo) => ({
            codigo,
            permitido: isAreaProfile ? enabledPermissions.has(codigo) : overrides[codigo] === "allow",
            heredar: !isAreaProfile && overrides[codigo] === "inherit",
          })),
        },
      });
      if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        toast.error("No se pudieron guardar los permisos.");
        return;
      }
      toast.success("Permisos guardados correctamente. Los usuarios deben volver a iniciar sesión para actualizar el menú.");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{isAreaProfile ? "Permisos por área" : "Permisos por usuario"}</h1>
          <p className="text-sm text-slate-500">{isAreaProfile ? "Configura los permisos que hereda cada área." : "Configura excepciones sobre los permisos del área."}</p>
        </div>
      </div>

      <HookForm methods={methods} onSubmit={() => undefined} preventSubmitOnEnter>
        <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 sm:p-6">
          <HookFormSelect
            name="areaId"
            label="Área"
            disabled={saving}
            options={[
              { value: "", label: "Selecciona un área" },
              ...areas.map((area) => ({ value: String(area.id), label: area.area })),
            ]}
            onChange={() => methods.setValue("userId", "")}
          />
          {!isAreaProfile && <HookFormSelect
            name="userId"
            label="Usuario"
            disabled={!selectedAreaId || saving}
            options={[
              { value: "", label: "Selecciona un usuario" },
              ...areaUsers.map((user) => ({
                value: String(user.id),
                label: user.nombre?.trim() || user.alias || `Usuario ${user.id}`,
              })),
            ]}
            helperText={selectedAreaId && areaUsers.length === 0 ? "No hay usuarios activos en esta área." : "Selecciona el usuario del área."}
          />}
        </section>
      </HookForm>

      {usersError && <p role="alert" className="text-sm text-red-700">{usersError}</p>}
      {selectedUser?.administrador && <p role="alert" className="text-sm text-amber-800">Este usuario es administrador y tiene acceso total; sus excepciones no limitan su acceso.</p>}
      {profileError && <p role="alert" className="text-sm text-red-700">{profileError}</p>}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-[#B23636]/10 p-2 text-[#B23636]">
              {isAreaProfile ? <ShieldCheck className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {isAreaProfile ? "Perfil del área" : "Excepción por usuario"}
              </p>
              <p className="text-sm text-slate-500">
                {selectedUser
                  ? `${selectedUser.nombre?.trim() || selectedUser.alias} · ${selectedArea?.area ?? "Sin área"}`
                  : selectedArea?.area ?? "Selecciona un área para empezar"}
              </p>
            </div>
          </div>
          {isAreaProfile && <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox checked={allEnabled} onChange={toggleAll} disabled={!selectedAreaId || loadingProfile || !!profileError} sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} />
            Permitir todo
          </label>}
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {permissionGroups.map((group) => (
            <div key={group.title} className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{group.title}</h2>
              <div className="mt-3 space-y-2">
                {group.permissions.map(([code, label, description]) => {
                  const checked = enabledPermissions.has(code);
                  return (
                    <div key={code} className="flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      {isAreaProfile ? <Checkbox checked={checked} onChange={() => togglePermission(code)} disabled={!selectedAreaId || loadingProfile || !!profileError} size="small" sx={{ mt: -0.5, color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} /> : null}
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{label}</span>
                        <span className="block text-xs text-slate-500">{description}</span>
                        {!isAreaProfile && <>
                          <span className="block text-xs text-slate-500">Área: {areaPermissions.has(code) ? "Permitido" : "Denegado"} · Efectivo: {(overrides[code] === "allow" || (overrides[code] === "inherit" && areaPermissions.has(code))) ? "Permitido" : "Denegado"}</span>
                          <ToggleButtonGroup exclusive size="small" value={overrides[code] ?? "inherit"} disabled={!selectedUserId || loadingProfile || !!profileError || !!selectedUser?.administrador} onChange={(_, value: Override | null) => { if (value) setOverrides((current) => ({ ...current, [code]: value })); }} aria-label={`Permiso ${label}`}>
                            <ToggleButton value="inherit">Heredar</ToggleButton><ToggleButton value="allow">Permitir</ToggleButton><ToggleButton value="deny">Denegar</ToggleButton>
                          </ToggleButtonGroup>
                        </>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-4 sm:px-6">
          <button type="button" onClick={() => void saveProfile()} disabled={!selectedAreaId || (!isAreaProfile && !selectedUserId) || loadingProfile || saving || !!profileError || !!selectedUser?.administrador} className="inline-flex items-center gap-2 rounded-lg bg-[#B23636] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#932b2b] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar permisos"}
          </button>
        </div>
      </section>
    </div>
  );
}
