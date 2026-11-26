import { GlobalDialog } from "@/components/common/GlobalDialog";
import { InputHistoryGuard } from "./InputHistoryGuard";
import "../shared/styles/app.css";
import Router from "./routes";

function App() {
  return (
    <>
      <InputHistoryGuard />
      <GlobalDialog />
      <Router />
    </>
  );
}

export default App;
