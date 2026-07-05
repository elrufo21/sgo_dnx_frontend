import type { ReactNode } from "react";

export type ListColumn<T> = {
  key?: keyof T;
  header: string;
  id?: string;
  render?: (row: T) => ReactNode;
};

export interface ModuleListConfig<T> {
  basePath: string;
  columns: ListColumn<T>[];
  idKey?: keyof T & string;
  createLabel?: string;
  deleteMessage?: string;
   filterKeys?: (keyof T & string)[];
  renderFilters?: ReactNode;
}
