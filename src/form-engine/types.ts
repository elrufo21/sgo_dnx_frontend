export type FormMode = "create" | "edit" | "view";

export type Validator =
  | { type: "required"; message?: string }
  | { type: "pattern"; value: RegExp; message?: string }
  | { type: "min"; value: number; message?: string }
  | { type: "max"; value: number; message?: string }
  | { type: "custom"; fn: (value: any, all: any) => true | string };

export type Transform = (value: any, all: any) => any;

export type OptionSource =
  | { type: "static"; options: { value: any; label: string }[] }
  | { type: "store"; key: string }
  | { type: "async"; fetcher: () => Promise<{ value: any; label: string }[]> };

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea";
  placeholder?: string;
  validators?: Validator[];
  transforms?: { normalize?: Transform; serialize?: Transform };
  options?: OptionSource;
  hidden?: (ctx: { mode: FormMode; values: any }) => boolean;
  disabled?: (ctx: { mode: FormMode; values: any }) => boolean;
  colSpan?: { base?: number; md?: number; lg?: number };
  extraProps?: Record<string, any>;
}

export interface SectionConfig {
  id: string;
  title?: string;
  fields: string[];
  columns?: number;
}

export interface FormConfig {
  id: string;
  title: { create: string; edit: string };
  actions?: { showNew?: boolean; showDelete?: boolean };
  fields: FieldConfig[];
  sections: SectionConfig[];
  defaults?: (initial?: any, mode?: FormMode) => any;
}
