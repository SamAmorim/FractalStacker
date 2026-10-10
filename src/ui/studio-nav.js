export function bindStudioNav() {
  const nav = document.querySelector(".studio-nav");
  if (!nav || typeof IntersectionObserver === "undefined") {
    return;
  }

  const links = new Map();
  nav.querySelectorAll('a[href^="#"]').forEach(function (link) {
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (target) {
      links.set(target, link);
    }
  });

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      const link = links.get(entry.target);
      if (link) {
        link.classList.toggle("in-view", entry.isIntersecting);
      }
    });
  }, { rootMargin: "-20% 0px -35% 0px" });

  links.forEach(function (_link, target) {
    observer.observe(target);
  });
}
