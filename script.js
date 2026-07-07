const lightbox = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox img");
const lightboxClose = document.querySelector(".lightbox-close");
const menuFilterButtons = document.querySelectorAll("[data-menu-filter]");
const plateCards = document.querySelectorAll("[data-menu-category]");
const currentYear = document.querySelector("[data-current-year]");
const backToTop = document.querySelector(".back-to-top");

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

menuFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.getAttribute("data-menu-filter");

    menuFilterButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });

    plateCards.forEach((card) => {
      const category = card.getAttribute("data-menu-category");
      card.hidden = filter !== "all" && category !== filter;
    });
  });
});

document.querySelectorAll("[data-photo]").forEach((button) => {
  button.addEventListener("click", () => {
    const source = button.getAttribute("data-photo");
    const image = button.querySelector("img");
    lightboxImage.src = source;
    lightboxImage.alt = image?.alt || "Bits and Bytes Cafe photo";
    lightbox.hidden = false;
    lightboxClose.focus();
  });
});

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
}

lightboxClose.addEventListener("click", closeLightbox);

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
  }
});

backToTop?.addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});
