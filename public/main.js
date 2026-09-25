const { name, tagline, sites } = window.SITE;
document.getElementById("name").textContent = name;
document.getElementById("tagline").textContent = tagline;
document.getElementById("year").textContent = new Date().getFullYear();

const track = document.getElementById("track");
const dotsEl = document.getElementById("dots");
const [prev, next] = ["prev", "next"].map((c) => document.querySelector(`.nav.${c}`));

const cards = sites.map((s) => {
  const a = document.createElement("a");
  a.className = "card";
  a.href = s.url;
  a.innerHTML = `
    <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${s.icon || '<circle cx="12" cy="12" r="9"/>'}</svg></span>
    <span class="txt"><strong></strong><small></small></span>
    <span class="open">Open</span>`;
  a.querySelector("strong").textContent = s.name;
  a.querySelector("small").textContent = s.desc;
  return a;
});
track.append(...cards);

const dots = cards.map((_, i) => {
  const d = document.createElement("button");
  d.setAttribute("role", "tab");
  d.setAttribute("aria-label", `Go to ${sites[i].name}`);
  d.addEventListener("click", () => goTo(i));
  return d;
});
dotsEl.append(...dots);

const step = () => cards[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 16);
const goTo = (i) => track.scrollTo({ left: Math.max(0, Math.min(i, cards.length - 1)) * step(), behavior: "smooth" });

function update() {
  const max = track.scrollWidth - track.clientWidth;
  const overflow = max > 2;
  const atEnd = overflow && track.scrollLeft >= max - 2;
  const i = atEnd ? cards.length - 1 : Math.round(track.scrollLeft / step());
  dots.forEach((d, n) => d.setAttribute("aria-selected", n === i));
  cards.forEach((c, n) => c.classList.toggle("active", !overflow || n === i));
  dotsEl.hidden = !overflow;
  prev.hidden = next.hidden = !overflow;
  prev.disabled = track.scrollLeft <= 2;
  next.disabled = atEnd;
}

prev.addEventListener("click", () => goTo(Math.round(track.scrollLeft / step()) - 1));
next.addEventListener("click", () => goTo(Math.round(track.scrollLeft / step()) + 1));
track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
addEventListener("resize", update);
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") next.click();
  if (e.key === "ArrowLeft") prev.click();
});
update();
