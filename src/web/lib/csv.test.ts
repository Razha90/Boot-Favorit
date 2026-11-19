import { describe, expect, it } from "vitest";
import { classifyRows, detectDelimiter, parseCsv, tableToDrafts } from "./csv";

describe("detectDelimiter", () => {
  it("memilih koma, titik koma, atau tab dari baris pertama", () => {
    expect(detectDelimiter("nama,email\nA,b")).toBe(",");
    expect(detectDelimiter("nama;email;no\nA;b;c")).toBe(";");
    expect(detectDelimiter("nama\temail\nA\tb")).toBe("\t");
  });

  it("mengabaikan pemisah di dalam tanda kutip dan BOM", () => {
    expect(detectDelimiter('﻿"a;b;c";d\n')).toBe(";"); // hanya 1 titik koma di luar kutip
    expect(detectDelimiter('"a,b,c,d";x;y\n')).toBe(";");
  });

  it("satu kolom: bawaan koma", () => {
    expect(detectDelimiter("nama\nA\nB")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("memecah baris dan sel, CRLF maupun LF, tanpa baris kosong", () => {
    expect(parseCsv("a,b\r\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it('kutip ganda: koma dan baris baru di dalam sel, serta "" sebagai kutip', () => {
    expect(parseCsv('nama,deskripsi\n"Kopi, Rempah","Enak ""banget""\nbaris dua"')).toEqual([
      ["nama", "deskripsi"],
      ["Kopi, Rempah", 'Enak "banget"\nbaris dua'],
    ]);
  });

  it("membuang BOM dan merapikan spasi", () => {
    expect(parseCsv("﻿nama\n  Mie Ayam  \n")).toEqual([["nama"], ["Mie Ayam"]]);
  });

  it("titik koma ala Excel Indonesia", () => {
    expect(parseCsv("nama;email\nA;a@b.id")).toEqual([
      ["nama", "email"],
      ["A", "a@b.id"],
    ]);
  });

  it("sel kosong di tengah tetap dipertahankan; berkas kosong menghasilkan tabel kosong", () => {
    expect(parseCsv("a,,c\n1,,3")).toEqual([
      ["a", "", "c"],
      ["1", "", "3"],
    ]);
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv(" \n\n ")).toEqual([]);
  });

  it("baris terakhir tanpa baris baru tetap terbaca", () => {
    expect(parseCsv("a\nb")).toEqual([["a"], ["b"]]);
  });
});

describe("tableToDrafts: tajuk dan alias", () => {
  it("hanya kolom nama; kolom lain tidak ada", () => {
    const r = tableToDrafts(parseCsv("nama\nKopi\nMie"));
    expect(r.missingNameColumn).toBe(false);
    expect(r.columns).toEqual(["name"]);
    expect(r.rows.map((x) => [x.line, x.name, x.email])).toEqual([
      [2, "Kopi", ""],
      [3, "Mie", ""],
    ]);
  });

  it("alias kolom tidak membedakan huruf besar-kecil; urutan kolom bebas; kolom asing diabaikan", () => {
    const r = tableToDrafts(parseCsv("Email;NAMA BOOTH;Catatan;No Booth\nx@y.id;Kopi;abaikan;A1"));
    expect(r.rows[0]).toMatchObject({ name: "Kopi", email: "x@y.id", boothNo: "A1" });
    expect(r.columns).toEqual(["email", "name", "boothNo"]);
  });

  it("kolom institusi/fakultas/prodi dikenali (nama kolom apa pun dari daftar alias) dan masuk teamName", () => {
    for (const header of ["institusi", "Fakultas", "PRODI", "Program Studi", "asal_institusi"]) {
      const out = tableToDrafts([
        ["Nama", header],
        ["Kopi Rempah", "Fakultas Teknik"],
      ]);
      expect(out.columns).toEqual(["name", "teamName"]);
      expect(out.rows[0]?.teamName).toBe("Fakultas Teknik");
    }
  });

  it("institusi terlalu panjang ditandai galat pratinjau", () => {
    const [r] = classifyRows(
      [
        {
          line: 2,
          name: "A",
          boothNo: "",
          email: "",
          tagline: "",
          description: "",
          teamName: "x".repeat(200),
        },
      ],
      [],
    );
    expect(r?.status).toBe("error");
    expect(r?.issues).toEqual(["field_too_long"]);
  });

  it("tanpa kolom nama: ditandai", () => {
    expect(tableToDrafts(parseCsv("email,tagline\nx@y.id,t")).missingNameColumn).toBe(true);
  });

  it("tanpa tajuk dan satu kolom: dianggap daftar nama (ditempel dari spreadsheet)", () => {
    const r = tableToDrafts(parseCsv("Kopi Rempah\nMie Ayam\nEs Teh"));
    expect(r.missingNameColumn).toBe(false);
    expect(r.rows.map((x) => x.name)).toEqual(["Kopi Rempah", "Mie Ayam", "Es Teh"]);
    expect(r.rows[0]?.line).toBe(1);
  });

  it("tanpa tajuk dengan banyak kolom: tidak bisa ditebak", () => {
    expect(tableToDrafts(parseCsv("Kopi,A1\nMie,A2")).missingNameColumn).toBe(true);
  });

  it("berkas kosong", () => {
    expect(tableToDrafts([])).toEqual({ rows: [], columns: [], missingNameColumn: false });
  });
});

describe("classifyRows: pratinjau sebelum impor", () => {
  const draft = (line: number, over: Partial<Record<string, string>> = {}) => ({
    line,
    name: "Booth",
    boothNo: "",
    email: "",
    tagline: "",
    description: "",
    teamName: "",
    ...over,
  });

  it("baris yang hanya bernama: OK", () => {
    const [r] = classifyRows([draft(2, { name: "Kopi" })], []);
    expect(r).toMatchObject({ status: "ok", issues: [] });
  });

  it("galat: nama kosong, nama terlalu panjang, email tidak valid", () => {
    const rows = classifyRows(
      [
        draft(2, { name: "" }),
        draft(3, { name: "x".repeat(61) }),
        draft(4, { name: "A", email: "bukan-email" }),
      ],
      [],
    );
    expect(rows.map((r) => [r.status, r.issues[0]])).toEqual([
      ["error", "name_required"],
      ["error", "name_too_long"],
      ["error", "email_invalid"],
    ]);
  });

  it("email sudah dipakai di event dan email ganda dalam file (tanpa membedakan huruf besar-kecil)", () => {
    const rows = classifyRows(
      [
        draft(2, { name: "A", email: "Dipakai@x.id" }),
        draft(3, { name: "B", email: "unik@x.id" }),
        draft(4, { name: "C", email: "UNIK@x.id" }),
      ],
      [{ name: "Lama", email: "dipakai@x.id" }],
    );
    expect(rows.map((r) => r.issues)).toEqual([["email_in_use"], [], ["email_duplicate_in_file"]]);
    expect(rows.map((r) => r.status)).toEqual(["error", "ok", "error"]);
  });

  it("nama kembar (dengan booth yang ada atau dalam file): peringatan, bukan galat", () => {
    const rows = classifyRows(
      [draft(2, { name: "kopi rempah" }), draft(3, { name: "Baru" }), draft(4, { name: "BARU" })],
      [{ name: "Kopi Rempah", email: null }],
    );
    expect(rows.map((r) => r.status)).toEqual(["warning", "ok", "warning"]);
    expect(rows[0]?.issues).toEqual(["duplicate_name"]);
  });

  it("baris galat tidak ikut memengaruhi deteksi kembar baris lain", () => {
    const rows = classifyRows([draft(2, { name: "A", email: "x" }), draft(3, { name: "A" })], []);
    expect(rows[0]?.status).toBe("error");
    expect(rows[1]?.status).toBe("ok"); // baris 2 tidak terdaftar sebagai "sudah ada"
  });
});
