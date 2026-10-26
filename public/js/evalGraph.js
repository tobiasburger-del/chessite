// Evaluation over the whole game as a small area chart. Your side's share is
// the light area at the bottom; your counted errors are coloured dots.
// Clicking picks the nearest move.
const { winChance } = globalThis.MoveClassifier;

const HEIGHT = 64;
const NS = "http://www.w3.org/2000/svg";

// scores[i]: White-POV score after ply i (index 0 = start) or null.
// marks: [{ ply, classification }]. flip: true when you played Black.
export function renderEvalGraph(svg, { scores, marks, flip, onSelect }) {
  const plies = scores.length - 1;
  let current = 0;

  // Your win % per ply; unknown evals carry the previous value.
  let last = 50;
  const yours = scores.map((s) => {
    if (s) last = winChance(s);
    return flip ? 100 - last : last;
  });

  function draw() {
    const width = Math.max(120, svg.clientWidth || svg.parentElement.clientWidth);
    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
    svg.innerHTML = "";
    const x = (ply) => (plies ? (ply / plies) * width : 0);
    const y = (pct) => HEIGHT - (pct / 100) * HEIGHT;

    add("rect", { class: "eg-bg", x: 0, y: 0, width, height: HEIGHT });
    const line = yours.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" L");
    add("path", { class: "eg-area", d: `M0,${HEIGHT} L${line} L${width},${HEIGHT} Z` });
    add("line", { class: "eg-mid", x1: 0, x2: width, y1: HEIGHT / 2, y2: HEIGHT / 2 });
    add("line", { class: "eg-current", x1: x(current), x2: x(current), y1: 0, y2: HEIGHT });
    for (const m of marks) {
      add("circle", {
        class: `eg-dot cls-${m.classification}`,
        cx: x(m.ply),
        cy: y(yours[m.ply]),
        r: 3.5,
      });
    }
  }

  function add(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
    return el;
  }

  svg.addEventListener("click", (e) => {
    const box = svg.getBoundingClientRect();
    const ply = Math.round(((e.clientX - box.left) / box.width) * plies);
    onSelect(Math.max(0, Math.min(plies, ply)));
  });
  window.addEventListener("resize", draw);
  draw();

  return {
    setCurrent(ply) {
      current = ply;
      draw();
    },
  };
}
