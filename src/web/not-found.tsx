import { Link } from "react-router";
import { copy } from "./lib/copy";
import { useAreaTheme } from "./lib/use-area-theme";

export function Component() {
  useAreaTheme("seru", "kertas");
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-24">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{copy.notFound.title}</h1>
      <p className="text-muted">{copy.notFound.body}</p>
      <Link
        to="/"
        className="w-fit rounded-chip border-(length:--border-w) border-line bg-primary px-5 py-2 font-bold text-primary-fg shadow-card"
      >
        {copy.notFound.back}
      </Link>
    </main>
  );
}
