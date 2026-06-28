/**
 * ImgKitLab - shared browser-side image tool utilities
 * All processing stays local; no uploads.
 */

const ImgKitLab = {
  MAX_FILE_SIZE: 25 * 1024 * 1024,
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  },

  formatPercent(saved, original) {
    if (!original) return '0%';
    return `${Math.round((saved / original) * 100)}%`;
  },

  validateFile(file) {
    if (!file) return 'Please select an image file.';
    if (!file.type.startsWith('image/')) {
      return 'Only image files are supported (JPG, PNG, WebP, GIF).';
    }
    if (file.size > this.MAX_FILE_SIZE) {
      return `File is too large. Maximum size is ${this.formatFileSize(this.MAX_FILE_SIZE)}.`;
    }
    return null;
  },

  loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const error = this.validateFile(file);
      if (error) {
        reject(new Error(error));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image. The file may be corrupted.'));
      };
      img.src = url;
    });
  },

  imageToCanvas(img, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width ?? img.naturalWidth;
    canvas.height = height ?? img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  },

  canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to process image. Try a different format or browser.'));
        },
        mimeType,
        quality
      );
    });
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getBaseName(filename) {
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(0, dot) : filename;
  },

  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  },

  showMessage(el, text, type = 'error') {
    if (!el) return;
    el.textContent = text;
    el.className = `message visible message-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  },

  hideMessage(el) {
    if (!el) return;
    el.className = 'message';
    el.textContent = '';
    el.removeAttribute('role');
    el.removeAttribute('aria-live');
  },

  setLoading(el, visible) {
    if (!el) return;
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  },

  showControls(el) {
    if (!el) return;
    el.classList.add('is-visible');
    el.removeAttribute('hidden');
  },

  hideControls(el) {
    if (!el) return;
    el.classList.remove('is-visible');
    el.setAttribute('hidden', '');
  },

  showPreview(el) {
    if (!el) return;
    el.classList.add('visible');
  },

  hidePreview(el) {
    if (!el) return;
    el.classList.remove('visible');
  },

  showStatsBar(el, html) {
    if (!el) return;
    if (html !== undefined) el.innerHTML = html;
    el.classList.add('is-visible');
    el.removeAttribute('hidden');
  },

  hideStatsBar(el) {
    if (!el) return;
    el.classList.remove('is-visible');
    el.setAttribute('hidden', '');
  },

  initDropZone(dropZone, fileInput, onFile) {
    const label = dropZone.querySelector('.drop-zone-label')?.textContent?.trim()
      || 'Upload image. Click to browse or drag and drop a file.';
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute('aria-label', label);

    const handleFile = (file) => {
      if (file) onFile(file);
    };

    const openPicker = () => fileInput.click();

    dropZone.addEventListener('click', (e) => {
      if (e.target === fileInput) return;
      openPicker();
    });

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
      dropZone.setAttribute('aria-dropeffect', 'copy');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
      dropZone.removeAttribute('aria-dropeffect');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      dropZone.removeAttribute('aria-dropeffect');
      handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      handleFile(fileInput.files[0]);
    });

    fileInput.setAttribute('aria-label', label);
  },

  setupRangeSlider(slider, valueEl, formatter) {
    if (slider.min) slider.setAttribute('aria-valuemin', slider.min);
    if (slider.max) slider.setAttribute('aria-valuemax', slider.max);

    const update = () => {
      const val = slider.value;
      const text = formatter ? formatter(val) : val;
      valueEl.textContent = text;
      slider.setAttribute('aria-valuenow', val);
      slider.setAttribute('aria-valuetext', text);
    };
    slider.addEventListener('input', update);
    update();
  },

  renderPreview(img, container) {
    container.innerHTML = '';
    const clone = img.cloneNode();
    clone.style.maxWidth = '100%';
    clone.style.maxHeight = '280px';
    container.appendChild(clone);
  },

  cropCanvas(img, x, y, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    return canvas;
  },

  circleCropCanvas(img, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas;
  },

  async canvasToIco(sourceCanvas, size = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, size, size);
    const pngBlob = await this.canvasToBlob(canvas, 'image/png');
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const offset = 22;
    const total = offset + pngBytes.length;
    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    bytes[6] = size >= 256 ? 0 : size;
    bytes[7] = size >= 256 ? 0 : size;
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, pngBytes.length, true);
    view.setUint32(18, offset, true);
    bytes.set(pngBytes, offset);
    return new Blob([buffer], { type: 'image/x-icon' });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  document.querySelectorAll('.site-nav a[data-nav]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && path.endsWith(href.replace(/^\.\.\//, '').replace(/^\//, ''))) {
      link.classList.add('active');
    }
  });

  document.querySelectorAll('.site-nav:not([aria-label])').forEach((nav) => {
    nav.setAttribute('aria-label', 'Main navigation');
  });

  document.querySelectorAll('.loading').forEach((el) => {
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.controls[hidden]').forEach((el) => {
    el.classList.remove('is-visible');
  });
});
