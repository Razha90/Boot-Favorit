import type { ProductView } from "@shared/api-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ImageUploader } from "../../components/shared/ImageUploader";
import { SafeImage } from "../../components/shared/SafeImage";
import { ActionButton } from "../../components/ui/ActionButton";
import { Badge, Card } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Form";
import { QueryState } from "../../components/ui/states";
import { copy } from "../../lib/copy";
import { formatRupiah } from "../../lib/format";
import { mediaUrl } from "../../lib/media-url";
import type { BoothScope } from "./scope";
import type { EditorProps } from "./types";

const emptyForm = { name: "", price: "", compare: "", category: "", badge: "", terms: false };

/** Produk & harga (A14). Sepenuhnya opsional; foto produk juga opsional. */
export function ProductsCard({ scope, refresh }: Pick<EditorProps, "scope" | "refresh">) {
  const q = useQuery({
    queryKey: ["booth-editor", "products", scope.boothId],
    queryFn: () => scope.products(),
  });
  const reload = async () => {
    await q.refetch();
    await refresh();
  };
  const [f, setF] = useState(emptyForm);
  const price = f.price === "" ? null : Number(f.price);
  const compare = f.compare === "" ? null : Number(f.compare);
  const valid =
    f.name.trim() !== "" &&
    price !== null &&
    Number.isInteger(price) &&
    price >= 0 &&
    (compare === null || (Number.isInteger(compare) && compare > price));

  return (
    <Card title={copy.admin.products.title}>
      <p className="text-sm text-muted">{copy.admin.products.hint}</p>
      <QueryState loading={q.isLoading} error={q.error}>
        {q.data?.products.length === 0 && (
          <p className="text-sm text-muted">{copy.admin.products.empty}</p>
        )}
        <ul className="grid gap-3">
          {q.data?.products.map((p) => (
            <ProductRow key={p.id} product={p} scope={scope} reload={reload} />
          ))}
        </ul>
      </QueryState>

      <h3 className="mt-2 text-sm font-bold">{copy.admin.products.add}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={copy.admin.products.name}>
          {(id) => (
            <Input
              id={id}
              value={f.name}
              maxLength={60}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          )}
        </Field>
        <Field label={copy.admin.products.price} info={copy.admin.products.priceInfo}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          )}
        </Field>
        <Field label={copy.admin.products.compare} info={copy.admin.products.compareInfo}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={f.compare}
              onChange={(e) => setF({ ...f, compare: e.target.value })}
            />
          )}
        </Field>
        <Field label={copy.admin.products.category}>
          {(id) => (
            <Input
              id={id}
              value={f.category}
              maxLength={20}
              onChange={(e) => setF({ ...f, category: e.target.value })}
            />
          )}
        </Field>
        <Field label={copy.admin.products.badge}>
          {(id) => (
            <Select id={id} value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })}>
              <option value="">{copy.admin.common.none}</option>
              <option value="limited">{copy.admin.products.badges.limited}</option>
              <option value="new">{copy.admin.products.badges.new}</option>
            </Select>
          )}
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={f.terms}
          onChange={(e) => setF({ ...f, terms: e.target.checked })}
        />
        {copy.admin.products.terms}
      </label>
      <div>
        <ActionButton
          variant="primary"
          disabled={!valid}
          resetOn={JSON.stringify(f)}
          action={async (ctx) => {
            await scope.createProduct(
              {
                name: f.name,
                priceIdr: price,
                comparePriceIdr: compare,
                category: f.category,
                badge: f.badge || null,
                termsConfirmed: f.terms,
              },
              ctx,
            );
            setF({ ...emptyForm, terms: f.terms });
            await reload();
          }}
        >
          {copy.admin.products.addButton}
        </ActionButton>
      </div>
    </Card>
  );
}

function ProductRow({
  product: p,
  scope,
  reload,
}: {
  product: ProductView;
  scope: BoothScope;
  reload: () => Promise<unknown>;
}) {
  const hidden = p.status !== "active";
  return (
    <li className="grid gap-2 rounded-card border-(length:--border-w) border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <SafeImage src={mediaUrl(p.keyThumb)} aspect="1/1" className="size-14 rounded-card" />
        <div className="grid gap-0.5">
          <span className="font-bold">{p.name}</span>
          <span className="text-sm text-muted">
            {formatRupiah(p.priceIdr)}
            {p.comparePriceIdr
              ? ` (${copy.admin.products.was} ${formatRupiah(p.comparePriceIdr)})`
              : ""}
            {p.category ? ` · ${p.category}` : ""}
          </span>
        </div>
        <span className="flex flex-wrap gap-1">
          {p.isFeatured && <Badge tone="primary">{copy.admin.products.featured}</Badge>}
          {p.status !== "active" && (
            <Badge tone="accent">{copy.admin.products.status[p.status]}</Badge>
          )}
        </span>
        <span className="ml-auto flex flex-wrap gap-1">
          {!p.isFeatured && p.status === "active" && (
            <ActionButton
              size="sm"
              action={async (ctx) => {
                await scope.setFeatured(p.id, ctx);
                await reload();
              }}
            >
              {copy.admin.products.makeFeatured}
            </ActionButton>
          )}
          <ActionButton
            size="sm"
            action={async (ctx) => {
              await scope.patchProduct(p.id, { status: hidden ? "active" : "hidden" }, ctx);
              await reload();
            }}
          >
            {hidden ? copy.admin.products.show : copy.admin.products.hide}
          </ActionButton>
          <ActionButton
            size="sm"
            variant="danger"
            action={async (ctx) => {
              await scope.deleteProduct(p.id, ctx);
              await reload();
            }}
          >
            {copy.admin.common.delete}
          </ActionButton>
        </span>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-muted">{copy.admin.products.photo}</summary>
        <div className="mt-2 grid gap-2">
          {p.keyThumb && (
            <ActionButton
              size="sm"
              variant="danger"
              action={async (ctx) => {
                await scope.removeProductPhoto(p.id, ctx);
                await reload();
              }}
            >
              {copy.admin.products.removePhoto}
            </ActionButton>
          )}
          <ImageUploader
            kind="product"
            label={copy.admin.products.uploadPhoto}
            onUpload={(image, ctx) => scope.upload("product", image, ctx, p.id)}
            onUploaded={reload}
          />
        </div>
      </details>
    </li>
  );
}
