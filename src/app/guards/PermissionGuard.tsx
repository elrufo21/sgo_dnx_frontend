import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/app/auth/store/auth.store";
import { hasPermission } from "../../shared/security/permissions";

export function PermissionGuard({ permission, fallback = "/" }: { permission: string; fallback?: string }) {
  const user = useAuthStore((state) => state.user);
  return hasPermission(user, permission) ? <Outlet /> : <Navigate to={fallback} replace />;
}
