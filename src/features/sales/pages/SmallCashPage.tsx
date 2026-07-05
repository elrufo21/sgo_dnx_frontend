import { useForm } from "react-hook-form";
import { toast } from "@/shared/ui/toast";
import { getLocalDateISO } from "@/shared/helpers/localDate";

type SmallCashForm = {
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  descripcion: string;
};

const today = getLocalDateISO();

export default function SmallCashPage() {
  const { register, handleSubmit, reset } = useForm<SmallCashForm>({
    defaultValues: {
      fecha: today,
      tipo: "INGRESO",
      monto: 0,
      descripcion: "",
    },
  });

  const onSubmit = (values: SmallCashForm) => {
    toast.success("Movimiento registrado (demo)", {
      description: `${values.tipo} - S/ ${values.monto.toFixed(
        2
      )} el ${values.fecha}`,
    });
    reset({ ...values, monto: 0, descripcion: "" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-gray-800">Caja chica</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
              {...register("fecha")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
              {...register("tipo")}
            >
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Monto</label>
          <input
            type="number"
            step="0.01"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
            {...register("monto", { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
            placeholder="Detalle del movimiento"
            {...register("descripcion")}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
