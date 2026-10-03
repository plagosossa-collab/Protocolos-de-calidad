const HEX = /^#[0-9a-f]{6}$/i;

export const DEFAULT_BRAND = "#1f4e79";

export function safeBrand(color: string | null | undefined): string {
  return color && HEX.test(color) ? color : DEFAULT_BRAND;
}

/** Color de texto legible (blanco o casi negro) sobre el color de marca. */
export function inkOn(color: string): string {
  const c = safeBrand(color).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111827" : "#ffffff";
}
