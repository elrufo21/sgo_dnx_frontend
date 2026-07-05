import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "sonner/dist/styles.css";
import App from "./app/App.tsx";
import { Toaster } from "@/shared/ui/toast";
import { queryClient } from "./shared/queryClient";
import { AppErrorBoundary } from "./app/AppErrorBoundary.tsx";

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  document.body?.classList.add("notranslate");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <App />
        <Toaster position="top-right" richColors />
      </AppErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
