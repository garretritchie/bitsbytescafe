const lightbox = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox img");
const lightboxClose = document.querySelector(".lightbox-close");

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
