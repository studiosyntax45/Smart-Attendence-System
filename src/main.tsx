import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Providers } from "@/src/providers";
import { router } from "@/src/router";
import { PageSkeleton } from "@/components/page-skeleton";
import "@/src/fonts.css";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} future={{ v7_startTransition: true }} fallbackElement={<PageSkeleton />} />
    </Providers>
  </StrictMode>
);
