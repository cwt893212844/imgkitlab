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

  async readImageMetadata(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const items = [];
    const blocks = [];

    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      this._scanJpegSegments(bytes, view, items, blocks);
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      this._scanPngChunks(bytes, view, items, blocks);
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      this._scanWebpChunks(bytes, view, items, blocks);
    }

    const seen = new Set();
    const unique = items.filter((item) => {
      const key = `${item.label}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      items: unique,
      blocks,
      hasMetadata: unique.length > 0 || blocks.length > 0,
    };
  },

  _scanJpegSegments(bytes, view, items, blocks) {
    let i = 2;
    while (i < bytes.length - 3) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xda) break;
      if (marker === 0xd9) break;
      if (marker >= 0xd0 && marker <= 0xd9) { i += 2; continue; }
      const len = view.getUint16(i + 2, false);
      const start = i + 4;
      const end = start + len - 2;
      if (marker === 0xe1 && end <= bytes.length) {
        if (this._isExifHeader(bytes, start)) {
          blocks.push('EXIF');
          items.push(...this._parseExifBlock(bytes, view, start + 6));
        } else if (this._isXmpHeader(bytes, start)) {
          blocks.push('XMP');
          items.push({ label: 'XMP metadata', value: 'Adobe XMP packet embedded' });
        }
      } else if (marker === 0xed && end <= bytes.length) {
        const header = this._ascii(bytes, start, Math.min(14, end - start));
        if (header.startsWith('Photoshop 3.0')) {
          blocks.push('IPTC');
          items.push({ label: 'IPTC / Photoshop metadata', value: 'Caption, keywords, or copyright may be present' });
        }
      } else if (marker === 0xe2 && end <= bytes.length) {
        blocks.push('ICC Profile');
        items.push({ label: 'ICC color profile', value: 'Embedded color profile data' });
      }
      i += 2 + len;
    }
  },

  _scanPngChunks(bytes, view, items, blocks) {
    let i = 8;
    while (i + 12 <= bytes.length) {
      const len = view.getUint32(i, false);
      const type = this._ascii(bytes, i + 4, 4);
      const start = i + 8;
      const end = start + len;
      if (end > bytes.length) break;
      if (type === 'eXIf') {
        blocks.push('EXIF');
        items.push(...this._parseExifBlock(bytes, view, start));
      } else if (type === 'tEXt') {
        blocks.push('PNG text');
        const chunk = this._readPngText(bytes, start, end);
        if (chunk) items.push(chunk);
      } else if (type === 'iTXt') {
        blocks.push('PNG text');
        const chunk = this._readPngITxt(bytes, start, end);
        if (chunk) items.push(chunk);
      } else if (type === 'iCCP') {
        blocks.push('ICC Profile');
        items.push({ label: 'ICC color profile', value: 'Embedded color profile data' });
      }
      i = end + 4;
    }
  },

  _scanWebpChunks(bytes, view, items, blocks) {
    if (bytes.length < 12) return;
    let i = 12;
    while (i + 8 <= bytes.length) {
      const type = this._ascii(bytes, i, 4);
      const len = view.getUint32(i + 4, true);
      const start = i + 8;
      const end = start + len + (len % 2);
      if (end > bytes.length) break;
      if (type === 'EXIF') {
        blocks.push('EXIF');
        items.push(...this._parseExifBlock(bytes, view, start));
      } else if (type === 'XMP ') {
        blocks.push('XMP');
        items.push({ label: 'XMP metadata', value: 'Adobe XMP packet embedded' });
      }
      i = end;
    }
  },

  _isExifHeader(bytes, offset) {
    return this._ascii(bytes, offset, 4) === 'Exif' && bytes[offset + 4] === 0 && bytes[offset + 5] === 0;
  },

  _isXmpHeader(bytes, offset) {
    return this._ascii(bytes, offset, 29) === 'http://ns.adobe.com/xap/1.0/\0';
  },

  _ascii(bytes, offset, len) {
    let s = '';
    for (let i = 0; i < len && offset + i < bytes.length; i++) {
      const c = bytes[offset + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  },

  _readPngText(bytes, start, end) {
    let i = start;
    while (i < end && bytes[i] !== 0) i++;
    if (i >= end) return null;
    const key = this._ascii(bytes, start, i - start);
    const value = this._ascii(bytes, i + 1, end - i - 1);
    return key ? { label: `PNG ${key}`, value: value || '(empty)' } : null;
  },

  _readPngITxt(bytes, start, end) {
    let i = start;
    while (i < end && bytes[i] !== 0) i++;
    if (i >= end) return null;
    const key = this._ascii(bytes, start, i - start);
    const comp = bytes[i + 1];
    let textStart = i + 5;
    while (textStart < end && bytes[textStart] !== 0) textStart++;
    textStart++;
    while (textStart < end && bytes[textStart] !== 0) textStart++;
    textStart++;
    const value = comp === 0
      ? this._ascii(bytes, textStart, end - textStart)
      : '(compressed text chunk)';
    return key ? { label: `PNG ${key}`, value: value || '(empty)' } : null;
  },

  _parseExifBlock(bytes, view, tiffStart) {
    const items = [];
    if (tiffStart + 8 > bytes.length) return items;
    const le = bytes[tiffStart] === 0x49;
    const ifd0 = view.getUint32(tiffStart + 4, le);
    this._parseExifIfd(bytes, view, tiffStart, tiffStart + ifd0, le, items);
    return items;
  },

  _parseExifIfd(bytes, view, tiffStart, ifdOffset, le, items, depth = 0) {
    if (depth > 4 || ifdOffset + 2 > bytes.length) return;
    const count = view.getUint16(ifdOffset, le);
    const gps = {};
    for (let i = 0; i < count; i++) {
      const entry = ifdOffset + 2 + i * 12;
      if (entry + 12 > bytes.length) break;
      const tag = view.getUint16(entry, le);
      const type = view.getUint16(entry + 2, le);
      const cnt = view.getUint32(entry + 4, le);
      const value = this._readExifValue(bytes, view, tiffStart, entry + 8, type, cnt, le);
      if (tag === 0x8769 && value !== null) {
        this._parseExifIfd(bytes, view, tiffStart, tiffStart + value, le, items, depth + 1);
      } else if (tag === 0x8825 && value !== null) {
        this._parseGpsIfd(bytes, view, tiffStart, tiffStart + value, le, gps);
      } else {
        const label = this._EXIF_TAG_NAMES[tag];
        if (label && value !== null && value !== '') {
          items.push({ label, value: String(value) });
        }
      }
    }
    if (gps.lat !== undefined && gps.lng !== undefined) {
      items.push({ label: 'GPS coordinates', value: `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` });
    }
  },

  _parseGpsIfd(bytes, view, tiffStart, ifdOffset, le, gps) {
    if (ifdOffset + 2 > bytes.length) return;
    const count = view.getUint16(ifdOffset, le);
    const parts = {};
    for (let i = 0; i < count; i++) {
      const entry = ifdOffset + 2 + i * 12;
      if (entry + 12 > bytes.length) break;
      const tag = view.getUint16(entry, le);
      const type = view.getUint16(entry + 2, le);
      const cnt = view.getUint32(entry + 4, le);
      const value = this._readExifValue(bytes, view, tiffStart, entry + 8, type, cnt, le);
      parts[tag] = value;
    }
    if (Array.isArray(parts[0x0002]) && parts[0x0001]) {
      gps.lat = this._gpsToDecimal(parts[0x0002], parts[0x0001]);
    }
    if (Array.isArray(parts[0x0004]) && parts[0x0003]) {
      gps.lng = this._gpsToDecimal(parts[0x0004], parts[0x0003]);
    }
  },

  _gpsToDecimal(parts, ref) {
    const d = parts[0];
    const m = parts[1];
    const s = parts[2];
    let dec = d + m / 60 + s / 3600;
    if (ref === 'S' || ref === 'W') dec *= -1;
    return dec;
  },

  _readExifValue(bytes, view, tiffStart, entry, type, count, le) {
    const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 };
    const size = (typeSizes[type] || 1) * count;
    let dataOffset = entry;
    if (size > 4) {
      dataOffset = tiffStart + view.getUint32(entry, le);
    }
    if (dataOffset < 0 || dataOffset >= bytes.length) return null;
    if (type === 2 || type === 7) {
      return this._ascii(bytes, dataOffset, count);
    }
    if (type === 3 && count === 1) {
      return view.getUint16(dataOffset, le);
    }
    if (type === 4 && count === 1) {
      return view.getUint32(dataOffset, le);
    }
    if (type === 5 && count >= 1) {
      const num = view.getUint32(dataOffset, le);
      const den = view.getUint32(dataOffset + 4, le);
      if (!den) return null;
      const val = num / den;
      if (count === 1 && num === 1) return `1/${den}`;
      return Number.isInteger(val) ? val : val.toFixed(2);
    }
    if (type === 5 && count === 3) {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const off = dataOffset + i * 8;
        const num = view.getUint32(off, le);
        const den = view.getUint32(off + 4, le);
        out.push(den ? num / den : 0);
      }
      return out;
    }
    if (type === 10 && count === 3) {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const off = dataOffset + i * 8;
        const num = view.getInt32(off, le);
        const den = view.getInt32(off + 4, le);
        out.push(den ? num / den : 0);
      }
      return out;
    }
    return null;
  },

  _EXIF_TAG_NAMES: {
    0x010e: 'Image description',
    0x010f: 'Camera make',
    0x0110: 'Camera model',
    0x0112: 'Orientation',
    0x0131: 'Software',
    0x0132: 'Date modified',
    0x013b: 'Artist',
    0x8298: 'Copyright',
    0x9003: 'Date taken',
    0x9004: 'Date digitized',
    0x920a: 'Focal length (mm)',
    0x829a: 'Exposure time',
    0x829d: 'F-number',
    0x8827: 'ISO',
    0x9201: 'Shutter speed',
    0x9204: 'Exposure bias',
    0x9209: 'Flash',
    0x9207: 'Metering mode',
    0x9208: 'Light source',
    0xa002: 'Image width',
    0xa003: 'Image height',
    0xa405: 'Focal length (35mm equiv)',
    0xa433: 'Lens make',
    0xa434: 'Lens model',
  },

  renderMetadataPanel(container, data) {
    if (!container) return;
    const { items, blocks, hasMetadata } = data;
    const blockText = blocks.length ? [...new Set(blocks)].join(', ') : '';
    let html = '<div class="metadata-privacy-banner" role="note">';
    html += '<strong>Read locally only.</strong> Metadata is inspected on your device and is never uploaded to any server.';
    html += '</div>';

    if (hasMetadata) {
      if (blockText) {
        html += `<p class="metadata-blocks">Embedded blocks found: <span>${blockText}</span></p>`;
      }
      if (items.length) {
        html += '<dl class="metadata-list">';
        items.forEach(({ label, value }) => {
          html += `<div class="metadata-row"><dt>${label}</dt><dd>${this._escapeHtml(value)}</dd></div>`;
        });
        html += '</dl>';
      } else {
        html += '<p class="metadata-note">Embedded metadata blocks were detected, but no common EXIF fields could be decoded.</p>';
      }
    } else {
      html += '<p class="metadata-note">No embedded EXIF, XMP, IPTC, or PNG text metadata was detected. Re-encoding still produces a clean pixel-only file.</p>';
    }

    container.innerHTML = html;
    container.classList.add('is-visible');
    container.removeAttribute('hidden');
  },

  hideMetadataPanel(container) {
    if (!container) return;
    container.innerHTML = '';
    container.classList.remove('is-visible');
    container.setAttribute('hidden', '');
  },

  _escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  /** Scale to cover target box, center-crop overflow — no aspect distortion */
  coverCropCanvas(img, width, height, opts = {}) {
    const zoom = opts.zoom ?? 1;
    const panX = opts.panX ?? 0;
    const panY = opts.panY ?? 0;
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const baseScale = Math.max(width / srcW, height / srcH);
    const scale = baseScale * zoom;
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    let offsetX = (width - drawW) / 2 + panX;
    let offsetY = (height - drawH) / 2 + panY;
    offsetX = Math.min(0, Math.max(width - drawW, offsetX));
    offsetY = Math.min(0, Math.max(height - drawH, offsetY));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    return canvas;
  },

  clampPan(imgW, imgH, targetW, targetH, zoom, panX, panY) {
    const baseScale = Math.max(targetW / imgW, targetH / imgH);
    const scale = baseScale * zoom;
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const maxPanX = Math.max(0, (drawW - targetW) / 2);
    const maxPanY = Math.max(0, (drawH - targetH) / 2);
    return {
      panX: Math.min(maxPanX, Math.max(-maxPanX, panX)),
      panY: Math.min(maxPanY, Math.max(-maxPanY, panY)),
    };
  },

  _canvasPointer(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const rx = canvas.width / rect.width;
    const ry = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * rx, y: (e.clientY - rect.top) * ry };
  },

  _clampCropRect(x, y, w, h, imgW, imgH, minSize = 1) {
    w = Math.max(minSize, w);
    h = Math.max(minSize, h);
    x = Math.max(0, Math.min(x, imgW - w));
    y = Math.max(0, Math.min(y, imgH - h));
    w = Math.min(w, imgW - x);
    h = Math.min(h, imgH - y);
    return { x, y, w, h };
  },

  initRectCropEditor(canvas, { getImage, getCrop, setCrop, onChange }) {
    const HANDLE = 9;
    const HANDLE_CURSORS = {
      nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
      se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
    };
    let displayScale = 1;
    let mode = null;
    let activeHandle = null;
    let startPointer = null;
    let startCrop = null;

    const ctx = canvas.getContext('2d');

    const handlesFor = (x, y, w, h) => ([
      { id: 'nw', cx: x, cy: y },
      { id: 'n', cx: x + w / 2, cy: y },
      { id: 'ne', cx: x + w, cy: y },
      { id: 'e', cx: x + w, cy: y + h / 2 },
      { id: 'se', cx: x + w, cy: y + h },
      { id: 's', cx: x + w / 2, cy: y + h },
      { id: 'sw', cx: x, cy: y + h },
      { id: 'w', cx: x, cy: y + h / 2 },
    ]);

    const hitHandle = (px, py, crop) => {
      const sx = crop.x * displayScale;
      const sy = crop.y * displayScale;
      const sw = crop.w * displayScale;
      const sh = crop.h * displayScale;
      for (const h of handlesFor(sx, sy, sw, sh)) {
        if (Math.abs(px - h.cx) <= HANDLE && Math.abs(py - h.cy) <= HANDLE) return h.id;
      }
      return null;
    };

    const inCrop = (px, py, crop) => {
      const sx = crop.x * displayScale;
      const sy = crop.y * displayScale;
      const sw = crop.w * displayScale;
      const sh = crop.h * displayScale;
      return px >= sx && px <= sx + sw && py >= sy && py <= sy + sh;
    };

    const toImage = (px, py) => ({
      x: Math.round(px / displayScale),
      y: Math.round(py / displayScale),
    });

    const draw = () => {
      const img = getImage();
      if (!img) return;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const maxH = 400;
      const maxW = 640;
      displayScale = Math.min(1, maxH / imgH, maxW / imgW);
      const dw = Math.max(1, Math.round(imgW * displayScale));
      const dh = Math.max(1, Math.round(imgH * displayScale));
      canvas.width = dw;
      canvas.height = dh;
      ctx.drawImage(img, 0, 0, dw, dh);

      const crop = getCrop();
      const sx = crop.x * displayScale;
      const sy = crop.y * displayScale;
      const sw = crop.w * displayScale;
      const sh = crop.h * displayScale;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, dw, sy);
      ctx.fillRect(0, sy + sh, dw, dh - sy - sh);
      ctx.fillRect(0, sy, sx, sh);
      ctx.fillRect(sx + sw, sy, dw - sx - sw, sh);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      ctx.strokeStyle = 'oklch(0.55 0.18 250)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'oklch(0.55 0.18 250)';
      ctx.lineWidth = 1.5;
      for (const h of handlesFor(sx, sy, sw, sh)) {
        ctx.fillRect(h.cx - 4, h.cy - 4, 8, 8);
        ctx.strokeRect(h.cx - 4.5, h.cy - 4.5, 9, 9);
      }
    };

    const applyResize = (handle, px, py) => {
      const img = getImage();
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const p = toImage(px, py);
      const s = startCrop;
      let x = s.x;
      let y = s.y;
      let x2 = s.x + s.w;
      let y2 = s.y + s.h;

      if (handle.includes('w')) x = p.x;
      if (handle.includes('e')) x2 = p.x;
      if (handle.includes('n')) y = p.y;
      if (handle.includes('s')) y2 = p.y;

      if (x2 - x < 1) {
        if (handle.includes('w')) x = x2 - 1;
        else x2 = x + 1;
      }
      if (y2 - y < 1) {
        if (handle.includes('n')) y = y2 - 1;
        else y2 = y + 1;
      }

      setCrop(this._clampCropRect(
        Math.min(x, x2), Math.min(y, y2),
        Math.abs(x2 - x), Math.abs(y2 - y),
        imgW, imgH
      ));
    };

    const onPointerDown = (e) => {
      const img = getImage();
      if (!img) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pos = this._canvasPointer(canvas, e);
      const crop = getCrop();
      const handle = hitHandle(pos.x, pos.y, crop);

      startPointer = pos;
      startCrop = { ...crop };

      if (handle) {
        mode = 'resize';
        activeHandle = handle;
        canvas.style.cursor = HANDLE_CURSORS[handle];
      } else if (inCrop(pos.x, pos.y, crop)) {
        mode = 'move';
        canvas.style.cursor = 'move';
      } else {
        mode = 'create';
        canvas.style.cursor = 'crosshair';
        const p = toImage(pos.x, pos.y);
        setCrop({ x: p.x, y: p.y, w: 1, h: 1 });
      }
      draw();
    };

    const onPointerMove = (e) => {
      const img = getImage();
      if (!img) return;
      const pos = this._canvasPointer(canvas, e);
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      if (!mode) {
        const crop = getCrop();
        const handle = hitHandle(pos.x, pos.y, crop);
        if (handle) canvas.style.cursor = HANDLE_CURSORS[handle];
        else if (inCrop(pos.x, pos.y, crop)) canvas.style.cursor = 'move';
        else canvas.style.cursor = 'crosshair';
        return;
      }

      e.preventDefault();
      if (mode === 'create') {
        const p1 = toImage(startPointer.x, startPointer.y);
        const p2 = toImage(pos.x, pos.y);
        setCrop(this._clampCropRect(
          Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
          Math.max(1, Math.abs(p2.x - p1.x)), Math.max(1, Math.abs(p2.y - p1.y)),
          imgW, imgH
        ));
      } else if (mode === 'move') {
        const dx = Math.round((pos.x - startPointer.x) / displayScale);
        const dy = Math.round((pos.y - startPointer.y) / displayScale);
        setCrop(this._clampCropRect(
          startCrop.x + dx, startCrop.y + dy,
          startCrop.w, startCrop.h, imgW, imgH
        ));
      } else if (mode === 'resize') {
        applyResize(activeHandle, pos.x, pos.y);
      }
      draw();
      if (onChange) onChange();
    };

    const onPointerUp = (e) => {
      if (!mode) return;
      mode = null;
      activeHandle = null;
      startPointer = null;
      startCrop = null;
      canvas.style.cursor = 'crosshair';
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (onChange) onChange();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return {
      redraw: draw,
      destroy() {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
      },
    };
  },

  initCoverFrameEditor(canvas, { getImage, getTarget, getFrame, setFrame, onChange }) {
    let mode = null;
    let startPointer = null;
    let startFrame = null;
    let frameRect = { x: 0, y: 0, w: 0, h: 0 };
    let displayRatio = 1;

    const ctx = canvas.getContext('2d');

    const layout = () => {
      const target = getTarget();
      const aspect = target.w / target.h;
      let fw = canvas.width * 0.88;
      let fh = fw / aspect;
      if (fh > canvas.height * 0.88) {
        fh = canvas.height * 0.88;
        fw = fh * aspect;
      }
      frameRect = {
        x: (canvas.width - fw) / 2,
        y: (canvas.height - fh) / 2,
        w: fw,
        h: fh,
      };
      displayRatio = fw / target.w;
    };

    const draw = () => {
      const img = getImage();
      const target = getTarget();
      if (!img || !target.w) return;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const maxH = 400;
      const maxW = 640;
      const bgScale = Math.min(1, maxH / imgH, maxW / imgW);
      const dw = Math.max(1, Math.round(imgW * bgScale));
      const dh = Math.max(1, Math.round(imgH * bgScale));
      canvas.width = dw;
      canvas.height = dh;
      layout();

      const frame = getFrame();
      const baseScale = Math.max(target.w / imgW, target.h / imgH);
      const scale = baseScale * frame.zoom;
      const drawW = imgW * scale * displayRatio;
      const drawH = imgH * scale * displayRatio;
      let ox = frameRect.x + (frameRect.w - drawW) / 2 + frame.panX * displayRatio;
      let oy = frameRect.y + (frameRect.h - drawH) / 2 + frame.panY * displayRatio;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, dw, dh);
      ctx.clip();
      ctx.drawImage(img, ox, oy, drawW, drawH);
      ctx.restore();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, dw, frameRect.y);
      ctx.fillRect(0, frameRect.y + frameRect.h, dw, dh - frameRect.y - frameRect.h);
      ctx.fillRect(0, frameRect.y, frameRect.x, frameRect.h);
      ctx.fillRect(frameRect.x + frameRect.w, frameRect.y, dw - frameRect.x - frameRect.w, frameRect.h);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(frameRect.x + 0.5, frameRect.y + 0.5, frameRect.w - 1, frameRect.h - 1);
      ctx.strokeStyle = 'oklch(0.55 0.18 250)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frameRect.x + 1.5, frameRect.y + 1.5, frameRect.w - 3, frameRect.h - 3);
    };

    const inFrame = (px, py) =>
      px >= frameRect.x && px <= frameRect.x + frameRect.w &&
      py >= frameRect.y && py <= frameRect.y + frameRect.h;

    const onPointerDown = (e) => {
      if (!getImage() || !getTarget().w) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pos = this._canvasPointer(canvas, e);
      startPointer = pos;
      startFrame = { ...getFrame() };
      mode = inFrame(pos.x, pos.y) ? 'pan' : null;
      if (mode) canvas.style.cursor = 'move';
    };

    const onPointerMove = (e) => {
      const img = getImage();
      const target = getTarget();
      if (!img || !target.w) return;
      const pos = this._canvasPointer(canvas, e);

      if (!mode) {
        canvas.style.cursor = inFrame(pos.x, pos.y) ? 'move' : 'default';
        return;
      }

      e.preventDefault();
      const dx = (pos.x - startPointer.x) / displayRatio;
      const dy = (pos.y - startPointer.y) / displayRatio;
      const clamped = this.clampPan(
        img.naturalWidth, img.naturalHeight,
        target.w, target.h,
        startFrame.zoom,
        startFrame.panX + dx,
        startFrame.panY + dy
      );
      setFrame({ ...startFrame, ...clamped });
      draw();
      if (onChange) onChange();
    };

    const onPointerUp = (e) => {
      if (!mode) return;
      mode = null;
      startPointer = null;
      startFrame = null;
      canvas.style.cursor = 'move';
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (onChange) onChange();
    };

    const onWheel = (e) => {
      const img = getImage();
      const target = getTarget();
      if (!img || !target.w || !inFrame(this._canvasPointer(canvas, e).x, this._canvasPointer(canvas, e).y)) return;
      e.preventDefault();
      const frame = getFrame();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const zoom = Math.min(3, Math.max(1, frame.zoom + delta));
      const clamped = this.clampPan(img.naturalWidth, img.naturalHeight, target.w, target.h, zoom, frame.panX, frame.panY);
      setFrame({ zoom, ...clamped });
      draw();
      if (onChange) onChange();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return {
      redraw: draw,
      resetFrame() {
        setFrame({ zoom: 1, panX: 0, panY: 0 });
        draw();
      },
      destroy() {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
      },
    };
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
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;

    const maxH = 280;
    const scale = Math.min(1, maxH / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    canvas.getContext('2d').drawImage(img, 0, 0, dw, dh);

    const preview = document.createElement('img');
    preview.alt = 'Preview';
    preview.style.maxWidth = '100%';
    preview.style.maxHeight = '280px';
    preview.src = canvas.toDataURL('image/png');
    container.appendChild(preview);
  },

  showUploadPreview({ file, img, previewArea, originalPreview, originalMeta, resultPreview, resultMeta, metaText }) {
    if (originalPreview) {
      originalPreview.innerHTML = '';
      this.renderPreview(img, originalPreview);
    }
    if (originalMeta) {
      originalMeta.textContent = metaText
        ?? `${file.name} · ${this.formatFileSize(file.size)} · ${img.naturalWidth}×${img.naturalHeight}`;
    }
    if (resultPreview) resultPreview.innerHTML = '';
    if (resultMeta) resultMeta.textContent = '';
    if (previewArea) previewArea.classList.add('visible');
  },

  buildCompressionStats(originalSize, resultSize) {
    const saved = originalSize - resultSize;
    if (saved > 0) {
      return [
        `<span>Original: ${this.formatFileSize(originalSize)}</span>`,
        `<span>Compressed: ${this.formatFileSize(resultSize)}</span>`,
        `<span class="saved">Saved ${this.formatFileSize(saved)} (${this.formatPercent(saved, originalSize)})</span>`,
      ].join('');
    }
    const extra = resultSize - originalSize;
    return [
      `<span>Original: ${this.formatFileSize(originalSize)}</span>`,
      `<span>Output: ${this.formatFileSize(resultSize)}</span>`,
      `<span class="stats-warn">+${this.formatFileSize(extra)} larger — try WebP/JPEG or lower quality</span>`,
    ].join('');
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
