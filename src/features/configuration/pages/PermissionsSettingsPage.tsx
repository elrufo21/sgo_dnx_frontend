import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import { useUsersStore } from "@/store/users/users.store";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { allPermissionCodes, permissionGroups } from "@/shared/security/permissions";
import Checkbox from "@mui/material/Checkbox";
import { Save, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type PermissionForm = {
  areaId: string;
  userId: string;
};

type PermissionProfileResponse = { permisos?: { codigo?: string; permitido?: boolean }[] };

export default function PermissionsSettingsPage() {
  const areas = useMaintenanceStore((state) => state.areas);
  const fetchAreas = useMaintenanceStore((state) => state.fetchAreas);
  const users = useUsersStore((state) => state.users);
  const fetchUsers = useUsersStore((state) => state.fetchUsers);
  const [enabledPermissions, setEnabledPermissions] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const methods = useForm<PermissionForm>({
    defaultValues: { areaId: "", userId: "" },
  });
  const selectedAreaId = useWatch({ control: methods.control, name: "areaId" });
  const selectedUserId = useWatch({ control: methods.control, name: "userId" });

  useEffect(() => {
    void fetchAreas();
    void fetchUsers();
  }, [fetchAreas, fetchUsers]);

  const selectedArea = useMemo(
    () => areas.find((area) => String(area.id) === selectedAreaId),
    [areas, selectedAreaId],
  );
  const areaUsers = useMemo(() => {
    if (!selectedArea) return users;
    return users.filter(
      (user) => user.area?.trim().toUpperCase() === selectedArea.area.trim().toUpperCase(),
    );
  }, [selectedArea, users]);
  const selectedUser = useMemo(
    () => areaUsers.find((user) => String(user.UsuarioID) === selectedUserId),
    [areaUsers, selectedUserId],
  );
  const isAreaProfile = !selectedUserId;
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
    if (!selectedAreaId) {
      setEnabledPermissions(new Set<string>());
      return;
    }

    let active = true;
    setLoadingProfile(true);
    const query = new URLSearchParams({ areaId: selectedAreaId });
    if (selectedUserId) query.set("usuarioId", selectedUserId);
    void apiRequest<PermissionProfileResponse>({
      url: buildApiUrl(`/Permisos/perfil?${query.toString()}`),
      fallback: { permisos: [] },
    }).then((response) => {
      if (!active) return;
      const permisos = Array.isArray((response as PermissionProfileResponse)?.permisos)
        ? (response as PermissionProfileResponse).permisos ?? []
        : [];
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
  }, [selectedAreaId, selectedUserId]);

  const saveProfile = async () => {
    if (!selectedAreaId) {
      toast.warning("Selecciona un área antes de guardar.");
      return;
    }
    setSaving(true);
    await apiRequest({
      url: buildApiUrl("/Permisos/perfil"),
      method: "PUT",
      data: {
        areaId: Number(selectedAreaId),
        usuarioId: selectedUserId ? Number(selectedUserId) : null,
        permisos: allPermissionCodes.map((codigo) => ({ codigo, permitido: enabledPermissions.has(codigo) })),
      },
    });
    setSaving(false);
    toast.success("Permisos guardados correctamente.");
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Permisos</h1>
          <p className="text-sm text-slate-500">Configura el perfil del área y las excepciones de cada usuario.</p>
        </div>
      </div>

      <HookForm methods={methods} onSubmit={() => undefined} preventSubmitOnEnter>
        <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 sm:p-6">
          <HookFormSelect
            name="areaId"
            label="Área"
            options={[
              { value: "", label: "Selecciona un área" },
              ...areas.map((area) => ({ value: String(area.id), label: area.area })),
            ]}
            onChange={() => methods.setValue("userId", "")}
          />
          <HookFormSelect
            name="userId"
            label="Usuario (opcional)"
            disabled={!selectedAreaId}
            options={[
              { value: "", label: "Aplicar al perfil del área" },
              ...areaUsers.map((user) => ({
                value: String(user.UsuarioID),
                label: user.Nombre?.trim() || user.UsuarioAlias || `Usuario ${user.UsuarioID}`,
              })),
            ]}
            helperText={selectedAreaId && areaUsers.length === 0 ? "No hay usuarios activos en esta área." : "Déjalo vacío para configurar el perfil base del área."}
          />
        </section>
      </HookForm>

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
                  ? `${selectedUser.Nombre?.trim() || selectedUser.UsuarioAlias} · ${selectedArea?.area ?? "Sin área"}`
                  : selectedArea?.area ?? "Selecciona un área para empezar"}
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox checked={allEnabled} onChange={toggleAll} disabled={!selectedAreaId || loadingProfile} sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} />
            Permitir todo
          </label>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {permissionGroups.map((group) => (
            <div key={group.title} className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{group.title}</h2>
              <div className="mt-3 space-y-2">
                {group.permissions.map(([code, label, description]) => {
                  const checked = enabledPermissions.has(code);
                  return (
                    <label key={code} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <Checkbox checked={checked} onChange={() => togglePermission(code)} disabled={!selectedAreaId || loadingProfile} size="small" sx={{ mt: -0.5, color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{label}</span>
                        <span className="block text-xs text-slate-500">{description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-4 sm:px-6">
          <button type="button" onClick={() => void saveProfile()} disabled={!selectedAreaId || loadingProfile || saving} className="inline-flex items-center gap-2 rounded-lg bg-[#B23636] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#932b2b] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar permisos"}
          </button>
        </div>
      </section>
    </div>
  );
}
