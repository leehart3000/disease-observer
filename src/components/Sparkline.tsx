const WIDTH = 120;
const HEIGHT = 32;
/** Space around the line, so the stroke and the end dot are not clipped. */
const PAD = 3;

/**
 * The points of a polyline for `values`, oldest first, fitted to a box of
 * `WIDTH` by `HEIGHT`. A series that does not change is drawn across the
 * middle.
 */
export function sparklinePoints(values: readonly number[]): Array<[number, number]> {
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return values.map((value, index) => {
    const x = PAD + (index / (values.length - 1)) * (WIDTH - 2 * PAD);
    const y = range === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((value - min) / range) * (HEIGHT - 2 * PAD);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
}

/**
 * A small line of recent values, drawn as inline SVG on the server, with no
 * JavaScript. It is decorative and hidden from screen readers: the text
 * that goes with it says what it shows. It draws nothing for fewer than two
 * values.
 */
export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const points = sparklinePoints(values);
  const [endX, endY] = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      focusable="false"
      data-testid="sparkline"
      className="h-8 w-[7.5rem] text-brand"
    >
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endX} cy={endY} r="2.5" fill="currentColor" />
    </svg>
  );
}
