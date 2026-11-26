import { Navigate, RouterProvider, createBrowserRouter } from "react-router";
import cashFlowRoutes from "./cashFlow/routes";
import maintenanceRoutes from "./maintenance/routes";
import productRoutes from "./products/routes";
import customerRoutes from "./customers/routes";
import salesRoutes from "./sales/routes";
import reportsRoutes from "./reports/routes";
import posRoutes from "./pos/routes";
import purchasesRoutes from "./purchases/routes";
import shoppingRoutes from "./shopping/routes";
import sendNoteRoutes from "./sendNote/routes";
import serviceInvoiceRoutes from "./serviceInvoices/routes";
import boletasSummaryRoutes from "./boletasSummary/routes";
import configurationRoutes from "./configuration/routes";
import accountingRoutes from "./accounting/routes";
import MainLayout from "./layout/MainLayout";
import { RedirectIfAuthenticated, RequireAuth } from "./guards/AuthGuard";
import LoginPage from "./auth/pages/LoginPage";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { ModuleAccessGuard } from "./guards/ModuleAccessGuard";
import { AccessDeniedPage } from "./AccessDeniedPage";
import warehouseRoutes from "./warehouse/routes";

const router = createBrowserRouter([
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RequireAuth>
        <ModuleAccessGuard />
      </RequireAuth>
    ),
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "access-denied", element: <AccessDeniedPage /> },
          {
            index: true,
            element: <Navigate to="/sales/html_capture/new" replace />,
          },
          ...productRoutes,
          ...customerRoutes,
          ...salesRoutes,
          ...reportsRoutes,
          ...posRoutes, // legacy direct routes (kept for compatibility if needed)
          ...purchasesRoutes, // legacy direct routes
          ...shoppingRoutes, // legacy direct routes
          ...sendNoteRoutes, // legacy direct routes
          ...serviceInvoiceRoutes,
          ...boletasSummaryRoutes,
          ...configurationRoutes,
          ...accountingRoutes,
          ...maintenanceRoutes,
          ...cashFlowRoutes,
          ...warehouseRoutes,
          { path: "*", element: <h1>404 - Not Found</h1> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
