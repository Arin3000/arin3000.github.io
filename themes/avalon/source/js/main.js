const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.16 });

document.querySelectorAll('.section-reveal, .art-item').forEach((el) => revealObserver.observe(el));

function copyableTextFromBlock(block) {
  const codeLines = block.querySelectorAll('td.code .line');
  if (codeLines.length) {
    return Array.from(codeLines).map((line) => line.textContent).join('\n');
  }

  const code = block.querySelector('code');
  if (code) return code.textContent || '';

  return block.textContent || '';
}

async function writeClipboardText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Fall back to the selection-based copy path below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Copy command failed');
}

document.querySelectorAll('.article-content figure.highlight, .article-content pre').forEach((block) => {
  if (block.closest('.copy-code-block')) return;
  if (block.matches('pre') && block.closest('figure.highlight')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'copy-code-block';
  const button = document.createElement('button');
  button.className = 'copy-code-button';
  button.type = 'button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code');

  block.parentNode.insertBefore(wrapper, block);
  wrapper.appendChild(button);
  wrapper.appendChild(block);

  button.addEventListener('click', async () => {
    const text = copyableTextFromBlock(block);
    try {
      await writeClipboardText(text);
      button.textContent = 'Copied';
      button.classList.add('is-copied');
      window.setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('is-copied');
      }, 1400);
    } catch (error) {
      button.textContent = 'Failed';
      window.setTimeout(() => {
        button.textContent = 'Copy';
      }, 1400);
    }
  });
});

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
