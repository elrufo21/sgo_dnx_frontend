import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Area } from "@/types/maintenance";

export const areaListConfig: ModuleListConfig<Area> = {
  basePath: "/maintenance/areas",
  columns: [{ key: "area", header: "Area" }],
  createLabel: "+ Anadir area",
  deleteMessage: "Seguro que deseas eliminar esta area?",
};
