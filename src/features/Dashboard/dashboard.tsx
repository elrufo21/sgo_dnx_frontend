import TicketDocument from "@/components/Ticket";
import { pdf, PDFViewer } from "@react-pdf/renderer";

const Dashboard = () => {
  const handlePrint = async () => {
    const blob = await pdf(<TicketDocument />).toBlob();
    const url = URL.createObjectURL(blob);

    const win = window.open(url);

    if (win) {
      win.onload = () => {
        win.focus();
        win.print();
      };
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Dashboard</h1>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>
      </div>

      <div className="h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <PDFViewer style={{ width: "100%", height: "100%" }}>
          <TicketDocument />
        </PDFViewer>
      </div>
    </div>
  );
};
export default Dashboard;
