import AreaCreate from "./areas/areaCreate";
import AreaEdit from "./areas/areaEdit";
import ComputerCreate from "./computers/computersCreate";
import ComputerEdit from "./computers/computersEdit";
import ComputerList from "./computers/computersList";
import EmployeeCreate from "./employees/pages/employeeCreate";
import EmployeeEdit from "./employees/pages/employeeEdit";
import EmployeeListPage from "./employees/employeeListPage";
import MaintenanceDashboard from "./pages/MaintenanceDashboard";
import UserCreate from "./users/pages/userCreate";
import UserEdit from "./users/pages/userEdit";
import UserList from "./users/pages/userList";
import CategoryCreate from "./categories/categoriesCreate";
import CategoryEdit from "./categories/categoriesEdit";
import { GenericList } from "@/shared/listing/GenericList";
import ProviderCreate from "./providers/providerCreate";
import ProviderEdit from "./providers/providerEdit";
import HolidayCreate from "./holidays/holidayCreate";
import HolidayEdit from "./holidays/holidayEdit";
import BoletasSummaryPage from "@/features/boletasSummary/pages/BoletasSummaryPage";

export default [
  {
    path: "maintenance",
    element: <MaintenanceDashboard />,
    handle: {
      breadcrumb: [{ label: "Mantenimiento" }],
    },
  },

  {
    path: "maintenance/areas",
    element: <GenericList moduleKey="areas" />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Áreas" },
      ],
    },
  },
  {
    path: "maintenance/areas/create",
    element: <AreaCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Áreas", to: "/maintenance/areas" },
        { label: "Crear área" },
      ],
    },
  },
  {
    path: "maintenance/areas/:id/edit",
    element: <AreaEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Áreas", to: "/maintenance/areas" },
        { label: "Editar área" },
      ],
    },
  },

  {
    path: "maintenance/categories",
    element: <GenericList moduleKey="categories" />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Categorías" },
      ],
    },
  },
  {
    path: "maintenance/categories/create",
    element: <CategoryCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Categorías", to: "/maintenance/categories" },
        { label: "Crear categoría" },
      ],
    },
  },
  {
    path: "maintenance/categories/:id/edit",
    element: <CategoryEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Categorías", to: "/maintenance/categories" },
        { label: "Editar categoría" },
      ],
    },
  },

  {
    path: "maintenance/providers",
    element: <GenericList moduleKey="providers" />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Proveedores" },
      ],
    },
  },
  {
    path: "maintenance/providers/create",
    element: <ProviderCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Proveedores", to: "/maintenance/providers" },
        { label: "Crear proveedor" },
      ],
    },
  },
  {
    path: "maintenance/providers/:id/edit",
    element: <ProviderEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Proveedores", to: "/maintenance/providers" },
        { label: "Editar proveedor" },
      ],
    },
  },

  {
    path: "maintenance/holidays",
    element: <GenericList moduleKey="holidays" />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Feriados" },
      ],
    },
  },
  {
    path: "maintenance/holidays/create",
    element: <HolidayCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Feriados", to: "/maintenance/holidays" },
        { label: "Crear feriado" },
      ],
    },
  },
  {
    path: "maintenance/holidays/:id/edit",
    element: <HolidayEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Feriados", to: "/maintenance/holidays" },
        { label: "Editar feriado" },
      ],
    },
  },

  {
    path: "maintenance/computers",
    element: <ComputerList />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Computadoras" },
      ],
    },
  },
  {
    path: "maintenance/computers/create",
    element: <ComputerCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Computadoras", to: "/maintenance/computers" },
        { label: "Crear computadora" },
      ],
    },
  },
  {
    path: "maintenance/computers/:id/edit",
    element: <ComputerEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Computadoras", to: "/maintenance/computers" },
        { label: "Editar computadora" },
      ],
    },
  },

  {
    path: "maintenance/employees",
    element: <EmployeeListPage />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Empleados" },
      ],
    },
  },
  {
    path: "maintenance/employees/create",
    element: <EmployeeCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Empleados", to: "/maintenance/employees" },
        { label: "Crear empleados" },
      ],
    },
  },
  {
    path: "maintenance/employees/:id/edit",
    element: <EmployeeEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Empleados", to: "/maintenance/employees" },
        { label: "Editar empleados" },
      ],
    },
  },

  {
    path: "maintenance/users",
    element: <UserList />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Usuarios" },
      ],
    },
  },
  {
    path: "maintenance/users/create",
    element: <UserCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Usuarios", to: "/maintenance/users" },
        { label: "Crear usuario" },
      ],
    },
  },
  {
    path: "maintenance/users/:id/edit",
    element: <UserEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Usuarios", to: "/maintenance/users" },
        { label: "Editar usuario" },
      ],
    },
  },
  {
    path: "maintenance/boletas_summary",
    element: <BoletasSummaryPage />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Resumen de boletas" },
      ],
    },
  },
];
