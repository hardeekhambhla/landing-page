const { name, tagline, sites } = window.SITE;
document.getElementById("name").textContent = name;
document.getElementById("tagline").textContent = tagline;
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("sites").append(
  ...sites.map((s) => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = s.url;
    a.innerHTML = `<span class="icon"></span><strong></strong><small></small>`;
    a.querySelector(".icon").textContent = s.icon || "→";
    a.querySelector("strong").textContent = s.name;
    a.querySelector("small").textContent = s.desc;
    return a;
  })
);
