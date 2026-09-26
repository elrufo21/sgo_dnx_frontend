import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth/auth.store";
import { hasPermission } from "./permissions";

export function PermissionGuard({ permission, fallback = "/" }: { permission: string; fallback?: string }) {
  const user = useAuthStore((state) => state.user);
  return hasPermission(user, permission) ? <Outlet /> : <Navigate to={fallback} replace />;
}
