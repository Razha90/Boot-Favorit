import { createBrowserRouter } from "react-router";

// File ini sengaja KECIL: hanya peta rute, tanpa isi halaman (explore.md B16).
// Setiap area dimuat terpisah lewat lazy(); bundle awal tidak berisi kode area mana pun.
// Halaman booth (/b/:boothId) adalah chunk sendiri, terpisah dari halaman event.
export const router = createBrowserRouter([
  {
    lazy: () => import("./areas/event/layout"),
    children: [
      { index: true, lazy: () => import("./areas/event/pages/home") },
      { path: "b/:boothId", lazy: () => import("./areas/event/pages/booth") },
      { path: "results", lazy: () => import("./areas/event/pages/results") },
    ],
  },
  {
    lazy: () => import("./areas/booth/layout"),
    children: [
      { path: "register", lazy: () => import("./areas/booth/pages/register") },
      { path: "booth/*", lazy: () => import("./areas/booth/pages/portal") },
    ],
  },
  {
    path: "screen",
    lazy: () => import("./areas/screen/layout"),
    children: [{ index: true, lazy: () => import("./areas/screen/pages/screen") }],
  },
  {
    path: "admin",
    lazy: () => import("./areas/admin/layout"),
    children: [
      { index: true, lazy: () => import("./areas/admin/pages/events") },
      { path: "e/:id", lazy: () => import("./areas/admin/pages/event") },
      { path: "e/:id/booths", lazy: () => import("./areas/admin/pages/booths") },
      { path: "e/:id/moderation", lazy: () => import("./areas/admin/pages/moderation") },
      { path: "e/:id/booths/import", lazy: () => import("./areas/admin/pages/import") },
      { path: "e/:id/booths/:bid", lazy: () => import("./areas/admin/pages/booth") },
      { path: "*", lazy: () => import("./not-found") },
    ],
  },
  // Galeri komponen: HANYA mode dev. `import.meta.env.DEV` bernilai false saat build, sehingga cabang
  // ini dan kodenya tidak ikut ke produksi.
  ...(import.meta.env.DEV
    ? [{ path: "dev/components", lazy: () => import("./dev/ComponentGallery") }]
    : []),
  { path: "*", lazy: () => import("./not-found") },
]);
