/** Живой градиент-меш из трёх размытых пятен. Анимация на CSS, замирает при reduced motion. */
export function MeshBackground() {
  return (
    <div className="mesh" aria-hidden>
      <div className="mesh__blob" />
      <div className="mesh__blob" />
      <div className="mesh__blob" />
    </div>
  );
}
