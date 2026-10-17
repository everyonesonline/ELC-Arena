import { api, h, mount, pageHeader, toast, slugName, fmtDateTime, modal, formRow, textInput, emptyState } from './api.js';

export const CANVAS_W = 1754; // A4 landscape @ 150dpi
export const CANVAS_H = 1240;

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = "'Segoe UI', system-ui, Arial, sans-serif";

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(ctx, text, x, y) {
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function fitFont(ctx, text, family, weight, startPx, maxWidth, italic = false) {
  let size = startPx;
  const style = italic ? 'italic ' : '';
  do {
    ctx.font = `${style}${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 24);
  return size;
}

function ornament(ctx, x, y, color, size = 8) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function spaced(text, gap = '\u2009') {
  return String(text).split('').join(gap);
}

/**
 * Draw a certificate.
 * payload: { values:{student_name,quiz_name,marks,score_detail,date,wording_top,statement,
 *                    center_name,center_tagline,signature_name,signature_title,note},
 *            labels:{marks,date,score_of},
 *            design:{cert_title,cert_primary_color,cert_accent_color,cert_border} }
 */
export function drawCertificate(canvas, payload) {
  const d = payload.design || {};
  const v = payload.values || {};
  const labels = payload.labels || { marks: 'Marks', date: 'Date of Issue', score_of: 'out of' };
  const W = CANVAS_W;
  const H = CANVAS_H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const primary = d.cert_primary_color || '#1a3a6b';
  const accent = d.cert_accent_color || '#c9a227';
  const border = d.cert_border || 'classic';

  // paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // subtle wash
  const wash = ctx.createRadialGradient(W / 2, 0, 60, W / 2, 0, W);
  wash.addColorStop(0, hexA(primary, 0.05));
  wash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // borders
  ctx.strokeStyle = primary;
  if (border === 'classic') {
    ctx.lineWidth = 10;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, W - 108, H - 108);
    for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
      ornament(ctx, x, y, accent, 22);
    }
  } else if (border === 'modern') {
    ctx.lineWidth = 5;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.fillStyle = accent;
    ctx.fillRect(28, 28, 26, H - 56);
    ctx.fillStyle = primary;
    ctx.fillRect(54, 28, 6, H - 56);
  } else if (border === 'elegant') {
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(52, 52, W - 104, H - 104);
    ornament(ctx, W / 2, 40, accent, 16);
    ornament(ctx, W / 2, H - 40, accent, 16);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(W / 2, 40, 26, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.lineWidth = 3;
    ctx.strokeRect(46, 46, W - 92, H - 92);
  }

  const cx = W / 2;

  // center name (required)
  ctx.fillStyle = accent;
  fitFont(ctx, spaced(v.center_name || "Everyone's Learning Center"), SERIF, 'bold', 40, W - 260);
  drawCentered(ctx, spaced(v.center_name || "Everyone's Learning Center"), cx, 140);

  ctx.fillStyle = hexA(primary, 0.75);
  ctx.font = `italic 24px ${SANS}`;
  drawCentered(ctx, v.center_tagline || '', cx, 180);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 170, 205);
  ctx.lineTo(cx + 170, 205);
  ctx.stroke();
  ornament(ctx, cx, 205, accent, 12);

  // title
  ctx.fillStyle = primary;
  const title = v.cert_title || payload.design?.cert_title || 'Certificate of Achievement';
  fitFont(ctx, title, SERIF, 'bold', 78, W - 320);
  drawCentered(ctx, title, cx, 300);

  // wording before name
  ctx.fillStyle = '#3b455c';
  ctx.font = `italic 30px ${SERIF}`;
  drawCentered(ctx, v.wording_top || 'This is to certify that', cx, 368);

  // student name (required)
  ctx.fillStyle = primary;
  const nameSize = fitFont(ctx, v.student_name || 'Student Name', SERIF, 'bold', 88, W - 340, true);
  ctx.font = `italic bold ${nameSize}px ${SERIF}`;
  drawCentered(ctx, v.student_name || 'Student Name', cx, 460);
  // underline flourish
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 330, 486);
  ctx.lineTo(cx + 330, 486);
  ctx.stroke();

  // statement + quiz name (required)
  ctx.fillStyle = '#3b455c';
  ctx.font = `28px ${SERIF}`;
  const stmtLines = wrapText(ctx, v.statement || 'has successfully completed the quiz', W - 460);
  let y = 540;
  for (const line of stmtLines) {
    drawCentered(ctx, line, cx, y);
    y += 40;
  }
  ctx.fillStyle = primary;
  const quizSize = fitFont(ctx, `“${v.quiz_name}”`, SERIF, 'bold', 52, W - 360);
  ctx.font = `bold ${quizSize}px ${SERIF}`;
  drawCentered(ctx, `“${v.quiz_name}”`, cx, y + 34);
  y += 34;

  // marks (required) — drawn as one centred line so nothing can overlap
  ctx.font = `bold 42px ${SERIF}`;
  const marksText = v.score_detail
    ? `${labels.marks || 'Marks'}: ${v.marks} (${v.score_detail})`
    : `${labels.marks || 'Marks'}: ${v.marks}`;
  ctx.fillStyle = accent;
  const boxW = Math.min(W - 380, ctx.measureText(marksText).width + 100);
  const boxY = y + 66;
  roundRect(ctx, cx - boxW / 2, boxY, boxW, 80, 16);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = primary;
  drawCentered(ctx, marksText, cx, boxY + 54);
  y = boxY + 80;

  // date of issue (required)
  ctx.fillStyle = '#3b455c';
  ctx.font = `26px ${SANS}`;
  drawCentered(ctx, `${labels.date || 'Date of Issue'}: ${v.date}`, cx, y + 46);
  y += 46;

  if (v.note) {
    ctx.fillStyle = hexA(primary, 0.75);
    ctx.font = `italic 22px ${SANS}`;
    const noteLines = wrapText(ctx, v.note, W - 560);
    for (const line of noteLines.slice(0, 2)) {
      y += 32;
      drawCentered(ctx, line, cx, y + 30);
    }
  }

  // signature block
  const sigY = H - 150;
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, sigY);
  ctx.lineTo(560, sigY);
  ctx.stroke();
  ctx.fillStyle = primary;
  ctx.font = `italic bold 34px ${SERIF}`;
  drawCentered(ctx, v.signature_name || '', 380, sigY - 18);
  ctx.fillStyle = '#3b455c';
  ctx.font = `22px ${SANS}`;
  drawCentered(ctx, v.signature_title || '', 380, sigY + 32);
  ctx.font = `18px ${SANS}`;
  drawCentered(ctx, v.cert_wording_bottom_label || 'Signature', 380, sigY + 62);

  // seal
  drawSeal(ctx, W - 330, H - 235, 92, accent, primary, v.marks);

  return canvas;
}

function drawSeal(ctx, x, y, r, accent, primary, marks) {
  ctx.save();
  ctx.translate(x, y);
  // ribbon tails
  ctx.fillStyle = hexA(primary, 0.9);
  ctx.beginPath();
  ctx.moveTo(-16, r - 14);
  ctx.lineTo(-30, r + 52);
  ctx.lineTo(0, r + 34);
  ctx.lineTo(30, r + 52);
  ctx.lineTo(16, r - 14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf3';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = accent;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r - 16, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = hexA(accent, 0.6);
  ctx.stroke();

  ctx.fillStyle = primary;
  ctx.textAlign = 'center';
  ctx.font = `bold 40px ${SERIF}`;
  ctx.fillText('E', 0, -6);
  ctx.font = `bold 17px ${SANS}`;
  ctx.fillText('ELC', 0, 24);
  if (marks) {
    ctx.font = `bold 20px ${SANS}`;
    ctx.fillStyle = accent;
    ctx.fillText(String(marks), 0, 56);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, alpha) {
  let c = String(hex || '').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return `rgba(26,58,107,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function downloadCertificate(canvas, payload) {
  const v = payload.values || {};
  const filename = `${slugName(v.student_name)}-${slugName(v.quiz_name)}-certificate.png`;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Certificate downloaded', 'success');
  }, 'image/png');
}

export function certificateStage(payload) {
  const canvas = h('canvas', { class: 'certificate-canvas' });
  drawCertificate(canvas, payload);
  return canvas;
}

// ---------- student/admin certificate page ----------
export async function renderCertificateView(root, issuanceId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading certificate…')));
  let data;
  try {
    data = await api(`/api/issuances/${issuanceId}`);
  } catch (err) {
    mount(
      root,
      pageHeader('Certificate'),
      h('div', { class: 'panel' }, h('p', { class: 'muted' }, err.message))
    );
    return;
  }
  const payload = data.certificate;
  const canvas = certificateStage(payload);

  const actions = [];
  actions.push(
    h(
      'button',
      {
        class: 'btn accent',
        onClick: () => downloadCertificate(canvas, payload),
      },
      '⬇ Download certificate (PNG)'
    )
  );
  if (data.can_edit && history.length > 1) actions.push(h('button', { class: 'btn', onClick: () => history.back() }, 'Back'));
  else actions.push(h('a', { class: 'btn', href: '#/student' }, 'Back to dashboard'));

  mount(
    root,
    pageHeader(
      'Certificate of Achievement',
      `${payload.values.student_name} · ${payload.values.quiz_name} · ${payload.values.marks}`,
      ...actions
    ),
    h(
      'div',
      { class: 'panel' },
      h('p', { class: 'muted', style: 'margin-bottom:14px' }, `Issued ${fmtDateTime(payload.issued_at)}`),
      canvas
    )
  );

  // assign download handler that re-renders fresh (canvas already drawn)
  return canvas;
}