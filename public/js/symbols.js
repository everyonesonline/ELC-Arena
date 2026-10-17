// Symbol palettes for math & science input (teacher question editing + student answers)

const PALETTES = {
  Math: [
    '÷', '×', '−', '±', '≠', '≈', '≤', '≥', '√', '∛', '∑', '∏', '∫', '∂', '∞', 'π',
    '∅', '∈', '∉', '∪', '∩', '⊂', '⊆', '∀', '∃', '∠', '∥', '°', '′', '″', '²', '³',
    '¹', 'ⁿ', '½', '¼', '¾', '∴', '∵', '∝', '∼', '≅', '≡', '⊥', '·', '⁄', '‰',
  ],
  Greek: [
    'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ',
    'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Δ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω',
    'Γ', 'Π', 'Α', 'Β', 'Σ', 'Φ',
  ],
  Science: [
    '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '⁺', '⁻', '⇌', '→', '⇐', '⇔',
    '↑', '↓', '⇌', '⟳', '⚡', '⚛', '🧪', '⚗', '🌡', '📡', '🔬', '☀', '☁', '💧',
    '⋅', '⨯', 'Ω', '°C', '°F', 'kJ', 'mg', 'mL', '⟶', '⇄', '⇒',
  ],
};

export function attachSymbolPalette(button, input) {
  let popover = null;

  const close = () => {
    if (popover) {
      popover.remove();
      popover = null;
      document.removeEventListener('click', outside);
    }
  };
  const outside = (e) => {
    if (popover && !popover.contains(e.target) && e.target !== button) close();
  };

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (popover) {
      close();
      return;
    }
    popover = build(() => close(), input);
    (button.closest('.symbol-wrap') || button.parentElement).append(popover);
    setTimeout(() => document.addEventListener('click', outside), 0);
  });
}

function build(close, input) {
  const names = Object.keys(PALETTES);
  let current = names[0];
  const wrap = document.createElement('div');
  wrap.className = 'symbol-pop';

  const tabs = document.createElement('div');
  tabs.className = 'symbol-tabs';
  const grid = document.createElement('div');
  grid.className = 'symbol-grid';

  const renderGrid = () => {
    grid.innerHTML = '';
    for (const sym of PALETTES[current]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = `Insert ${sym}`;
      b.textContent = sym;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        insertAtCursor(input, sym);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });
      grid.append(b);
    }
  };

  for (const name of names) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    if (name === current) btn.classList.add('active');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      current = name;
      [...tabs.children].forEach((t) => t.classList.toggle('active', t === btn));
      renderGrid();
    });
    tabs.append(btn);
  }

  const head = document.createElement('h4');
  head.textContent = 'Math & science symbols';

  wrap.append(head, tabs, grid);
  renderGrid();
  return wrap;
}

export function insertAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  // wrap selection in the symbol when it is a relation-ish string? just insert
  input.value = before + text + after;
  const caret = start + text.length;
  input.setSelectionRange(caret, caret);
}

export function symbolButton(input, label = 'Symbols ∑') {
  const wrap = document.createElement('span');
  wrap.className = 'symbol-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn sm';
  btn.textContent = label;
  wrap.append(btn);
  attachSymbolPalette(btn, input);
  return wrap;
}