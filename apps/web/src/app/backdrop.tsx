/** Drifting grid and a few hard-edged shapes behind everything. CSS-only: no canvas, no JS loop,
 *  and it disappears under `prefers-reduced-motion` or calm mode (see globals.css). */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none">
      <div className="nb-grid" />
      <div className="nb-blob nb-blob-1 -left-16 top-24 hidden md:block" />
      <div className="nb-blob nb-blob-2 right-10 top-1/3 hidden md:block" />
      <div className="nb-blob nb-blob-3 -right-12 bottom-16 hidden lg:block" />
    </div>
  );
}
