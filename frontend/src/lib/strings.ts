// JSON section labels carry a leading emoji for other surfaces; the calm
// editorial layout anchors sections with a terracotta rule instead.
export function stripEmoji(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u, "");
}
