const { name, tagline, sites } = window.SITE;
document.getElementById("name").textContent = name;
document.getElementById("tagline").textContent = tagline;
document.getElementById("year").textContent = new Date().getFullYear();

const grid = document.getElementById("sites");
sites.forEach((s, i) => {
  const a = document.createElement("a");
  a.className = "card";
  a.href = s.url;
  a.style.setProperty("--c", s.color || "#a78bfa");
  a.style.setProperty("--d", `${0.15 + i * 0.1}s`);
  a.innerHTML = `
    <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${s.icon || '<circle cx="12" cy="12" r="9"/>'}</svg></span>
    <span class="txt"><strong></strong><small></small></span>
    <span class="arrow" aria-hidden="true">↗</span>`;
  a.querySelector("strong").textContent = s.name;
  a.querySelector("small").textContent = s.desc;
  a.addEventListener("pointermove", (e) => {
    const r = a.getBoundingClientRect();
    a.style.setProperty("--x", `${e.clientX - r.left}px`);
    a.style.setProperty("--y", `${e.clientY - r.top}px`);
  });
  grid.append(a);
});
