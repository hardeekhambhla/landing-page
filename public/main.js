const { name, tagline, sites } = window.SITE;
document.getElementById("name").textContent = name;
document.getElementById("tagline").textContent = tagline;
document.getElementById("year").textContent = new Date().getFullYear();

const track = document.getElementById("track");
const dotsEl = document.getElementById("dots");
const [prev, next] = ["prev", "next"].map((c) => document.querySelector(`.nav.${c}`));

const cards = sites.map((s, i) => {
  const a = document.createElement("a");
  a.className = "card";
  a.href = s.url;
  a.innerHTML = `
    <span class="top"><span class="idx"></span><span class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span></span>
    <svg class="art" viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.art || ""}</svg>
    <span class="txt"><strong></strong><small></small></span>
    <span class="host"></span>`;
  a.querySelector(".idx").textContent = String(i + 1).padStart(2, "0");
  a.querySelector("strong").textContent = s.name;
  a.querySelector("small").textContent = s.desc;
  a.querySelector(".host").textContent = new URL(s.url).host;
  return a;
});
track.append(...cards);

const step = () => cards[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 16);
const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
// reachable snap positions; trailing cards collapse into the end position
const positions = () => [...new Set(cards.map((_, i) => Math.round(Math.min(i * step(), maxScroll()))))];

let dots = [];
function buildDots() {
  const n = positions().length;
  if (dots.length === n) return;
  dots = Array.from({ length: n }, (_, i) => {
    const d = document.createElement("button");
    d.setAttribute("role", "tab");
    d.setAttribute("aria-label", `Page ${i + 1}`);
    d.addEventListener("click", () => goTo(i));
    return d;
  });
  dotsEl.replaceChildren(...dots);
}
const current = () => {
  const p = positions();
  return p.reduce((best, v, i) => (Math.abs(v - track.scrollLeft) < Math.abs(p[best] - track.scrollLeft) ? i : best), 0);
};
const goTo = (i) => {
  const p = positions();
  track.scrollTo({ left: p[Math.max(0, Math.min(i, p.length - 1))], behavior: "smooth" });
};

function update() {
  buildDots();
  const overflow = maxScroll() > 2;
  const i = current();
  const last = positions().length - 1;
  const vw = track.getBoundingClientRect();
  dots.forEach((d, n) => d.setAttribute("aria-selected", n === i));
  // only cards fully in view are bright; cut-off ones are dimmed
  cards.forEach((c) => {
    const r = c.getBoundingClientRect();
    c.classList.toggle("active", !overflow || (r.left >= vw.left - 2 && r.right <= vw.right + 2));
  });
  dotsEl.hidden = !overflow || last < 1;
  prev.hidden = next.hidden = !overflow;
  prev.disabled = i === 0;
  next.disabled = i === last;
}

prev.addEventListener("click", () => goTo(current() - 1));
next.addEventListener("click", () => goTo(current() + 1));
track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
addEventListener("resize", update);
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") next.click();
  if (e.key === "ArrowLeft") prev.click();
});
update();
