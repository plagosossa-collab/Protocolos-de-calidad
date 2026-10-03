"use client";

/** Reduce la foto (lado mayor 1600 px, JPEG) antes de subirla y envía el formulario sola. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.8));
}

export function PhotoInput({ name }: { name: string }) {
  return (
    <label className="btn small secondary" style={{ cursor: "pointer" }}>
      📷 Agregar foto
      <input
        type="file"
        name={name}
        accept="image/*"
        hidden
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          const dt = new DataTransfer();
          dt.items.add(new File([await shrink(file)], "foto.jpg", { type: "image/jpeg" }));
          input.files = dt.files;
          input.form?.requestSubmit();
        }}
      />
    </label>
  );
}
