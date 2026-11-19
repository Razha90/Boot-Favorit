import { describe, expect, it } from "vitest";
import {
  findBoundaryViolations,
  findRawImgViolations,
  findTokenViolations,
  resolveSpec,
} from "./lib/rules.mjs";

const rules = (list) => list.map((v) => v.rule);

describe("lint-tokens", () => {
  const file = "src/web/components/ui/Badge.tsx";

  it("menolak warna hex, fungsi warna, dan palet bawaan Tailwind", () => {
    expect(rules(findTokenViolations(file, 'const a = "#1EB05F";'))).toEqual(["token-color"]);
    expect(rules(findTokenViolations(file, 'style={{ color: "rgb(0 0 0)" }}'))).toEqual([
      "token-color",
    ]);
    expect(rules(findTokenViolations(file, '<p className="text-gray-700">x</p>'))).toEqual([
      "token-color",
    ]);
    expect(rules(findTokenViolations(file, '<p className="bg-white">x</p>'))).toEqual([
      "token-color",
    ]);
  });

  it("menolak nama font dan font-family literal", () => {
    expect(rules(findTokenViolations(file, "font-family: DM Sans;"))).toContain("token-font");
    expect(rules(findTokenViolations(file, '<p className="font-[Caveat]">x</p>'))).toContain(
      "token-font",
    );
  });

  it("menerima token dan tidak salah tangkap", () => {
    const ok = '<a href="#top" className="bg-primary text-primary-fg font-display">x</a>';
    expect(findTokenViolations(file, ok)).toEqual([]);
  });

  it("mengizinkan warna dan font di theme.css dan fonts.css", () => {
    expect(findTokenViolations("src/web/styles/theme.css", "--primary: #1eb05f;")).toEqual([]);
    expect(findTokenViolations("src/web/styles/fonts.css", "@import 'DM Sans';")).toEqual([]);
  });

  it("menghormati lint-ignore pada baris yang sama", () => {
    const line = 'const a = "#fff"; // lint-ignore: token-color';
    expect(findTokenViolations(file, line)).toEqual([]);
  });
});

describe("no-raw-img", () => {
  it("menolak <img>, new Image(), dan background-image", () => {
    const f = "src/web/areas/event/pages/home.tsx";
    expect(rules(findRawImgViolations(f, '<img src="a.webp" />'))).toEqual(["raw-img"]);
    expect(rules(findRawImgViolations(f, "const i = new Image();"))).toEqual(["raw-img"]);
    expect(rules(findRawImgViolations(f, "background-image: url(x);"))).toEqual(["raw-img"]);
  });

  it("tidak menandai komentar maupun berkas tes yang hanya membahas <img>", () => {
    const f = "src/web/components/shared/RatingStars.tsx";
    expect(findRawImgViolations(f, "// bukan background-image, tetapi gradasi")).toEqual([]);
    expect(findRawImgViolations(f, "/** gambar: <img> hanya di SafeImage */")).toEqual([]);
    expect(findRawImgViolations(f, " * lihat <img> di SafeImage")).toEqual([]);
    expect(findRawImgViolations("src/web/x/Foo.test.tsx", '<img src="a" />')).toEqual([]);
    expect(
      findRawImgViolations("src/web/test/assertions.ts", "container.querySelector('img') // <img>"),
    ).toEqual([]);
    // Kode sungguhan di berkas non-tes tetap ditolak.
    expect(findRawImgViolations(f, '<img src="a" />')).toHaveLength(1);
  });

  it("mengizinkan <img> di SafeImage saja", () => {
    const text = "<img src={src} />";
    expect(findRawImgViolations("src/web/components/shared/SafeImage.tsx", text)).toEqual([]);
    expect(findRawImgViolations("src/web/components/shared/Other.tsx", text)).toHaveLength(1);
  });
});

describe("lint-boundaries", () => {
  it("menyelesaikan alias dan path relatif", () => {
    expect(resolveSpec("src/web/areas/admin/a.ts", "../event/x")).toBe("src/web/areas/event/x");
    expect(resolveSpec("src/web/areas/admin/a.ts", "@web/areas/event/x")).toBe(
      "src/web/areas/event/x",
    );
    expect(resolveSpec("src/web/a.ts", "react")).toBeNull();
  });

  it("menolak impor antar-area, termasuk import() dinamis", () => {
    const f = "src/web/areas/admin/pages/home.tsx";
    expect(rules(findBoundaryViolations(f, 'import { X } from "../../event/pages/home";'))).toEqual(
      ["boundary"],
    );
    expect(
      rules(findBoundaryViolations(f, 'const m = import("@web/areas/booth/layout");')),
    ).toEqual(["boundary"]);
  });

  it("mengizinkan impor ke components, lib, dan area sendiri", () => {
    const f = "src/web/areas/admin/pages/home.tsx";
    const ok = [
      'import { ComingSoon } from "../../../components/ui/ComingSoon";',
      'import { copy } from "@web/lib/copy";',
      'import { Local } from "../layout";',
    ].join("\n");
    expect(findBoundaryViolations(f, ok)).toEqual([]);
  });

  it("menjaga arah lapisan: shared tak boleh impor web/worker; ui tak boleh impor shared/areas", () => {
    expect(
      findBoundaryViolations("src/shared/config.ts", 'import x from "../web/lib/copy";'),
    ).toHaveLength(1);
    expect(
      findBoundaryViolations("src/web/components/ui/A.tsx", 'import x from "../shared/B";'),
    ).toHaveLength(1);
    expect(
      findBoundaryViolations("src/worker/index.ts", 'import x from "../web/lib/copy";'),
    ).toHaveLength(1);
  });

  it("web boleh `import type` dari worker, tetapi tidak impor nilai", () => {
    const f = "src/web/lib/api.ts";
    expect(findBoundaryViolations(f, 'import type { AppType } from "../../worker/index";')).toEqual(
      [],
    );
    expect(findBoundaryViolations(f, 'import { app } from "../../worker/index";')).toHaveLength(1);
  });
});
