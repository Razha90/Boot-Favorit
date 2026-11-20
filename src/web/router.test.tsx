// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootLayout } from "./router";

afterEach(cleanup);

describe("RootLayout ScrollRestoration", () => {
  it("pindah dari beranda ke halaman booth otomatis scroll ke paling atas (0, 0)", async () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;

    const r = createMemoryRouter(
      [
        {
          Component: RootLayout,
          children: [
            {
              path: "/",
              element: <Link to="/b/booth-1">Buka booth</Link>,
            },
            {
              path: "/b/:boothId",
              element: <h1>Halaman Booth</h1>,
            },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={r} />);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Buka booth" }));

    expect(await screen.findByRole("heading", { name: "Halaman Booth" })).toBeTruthy();
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });
});
