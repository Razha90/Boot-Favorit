import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import type { ActionContext } from "../../lib/action";
import { copy } from "../../lib/copy";
import type { ConvertedImage, ImageConvertError, ImageKind } from "../../lib/image/convert-to-webp";
import { ActionButton } from "../ui/ActionButton";
import { Spinner } from "../ui/Spinner";
import { SafeImage } from "./SafeImage";

export interface ImageUploaderProps {
  kind: ImageKind;
  label: string;
  /** Unggah hasil konversi. `ctx.key` WAJIB dikirim sebagai Idempotency-Key. */
  onUpload: (image: ConvertedImage, ctx: ActionContext) => Promise<unknown>;
  onUploaded?: () => void;
  disabled?: boolean;
}

/**
 * Pilih/tarik gambar → konversi WebP di browser (modul dimuat saat file dipilih) → pratinjau → unggah.
 * Satu komponen untuk logo, foto booth, dan foto produk (explore.md B15).
 */
export function ImageUploader({ kind, label, onUpload, onUploaded, disabled }: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [converted, setConverted] = useState<ConvertedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Bebaskan URL pratinjau begitu tidak dipakai.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setConverting(true);
    setConverted(null);
    setPreviewUrl(null);
    try {
      const { convertToWebp } = await import("../../lib/image/convert-to-webp");
      const result = await convertToWebp(file, kind);
      setConverted(result);
      setPreviewUrl(URL.createObjectURL(result.thumb));
    } catch (err) {
      const code = (err as ImageConvertError).code;
      setError(
        code && code in copy.image.errors
          ? copy.image.errors[code]
          : copy.image.errors.decode_failed,
      );
    } finally {
      setConverting(false);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) void handleFile(e.dataTransfer.files[0]);
  }

  function clear() {
    setConverted(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid cursor-pointer place-items-center gap-1 rounded-card border-(length:--border-w) border-dashed border-line px-4 py-6 text-center text-sm ${dragging ? "bg-primary-soft" : "bg-surface-raised"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className="font-bold">{label}</span>
        <span className="text-muted">
          {copy.image.choose} {copy.image.dropHint}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || converting}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>

      {converting && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> {copy.image.converting}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {converted && previewUrl && (
        <div className="flex items-center gap-3">
          <SafeImage src={previewUrl} alt="" className="size-20 rounded-card" />
          <ActionButton
            variant="primary"
            action={(ctx) => onUpload(converted, ctx)}
            onSuccess={() => {
              clear();
              onUploaded?.();
            }}
          >
            {copy.image.upload}
          </ActionButton>
          <button type="button" className="text-sm text-muted underline" onClick={clear}>
            Batal
          </button>
        </div>
      )}
    </div>
  );
}
