const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.16 });

document.querySelectorAll('.section-reveal, .art-item').forEach((el) => revealObserver.observe(el));

const lightbox = document.querySelector('.lightbox');
const lightboxImage = document.querySelector('.lightbox-image');
const closeButton = document.querySelector('.lightbox-close');

document.querySelectorAll('[data-lightbox]').forEach((button) => {
  button.addEventListener('click', () => {
    lightboxImage.src = button.dataset.lightbox;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  });
});

function closeLightbox() {
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
}

closeButton.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
});
