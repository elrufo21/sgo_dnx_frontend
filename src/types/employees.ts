export type Personal = {
  personalId: number; // numeric(20,0) -> number; usar string si backend devuelve > 9e15
  personalNombres?: string | null;
  personalApellidos?: string | null;
  areaId?: number | null;
  personalCodigo?: string | null;
  personalNacimiento?: string | null; // date, formato YYYY-MM-DD
  personalIngreso?: string | null; // texto libre
  personalDni?: string | null;
  personalDireccion?: string | null;
  personalTelefono?: string | null;
  personalEmail?: string | null;
  personalEstado?: string | null;
  personalImagen?: string | null; // base64 o URL
  companiaId?: number | null;
};

// Alias de compatibilidad con nomenclatura anterior
export type Employee = Personal;
