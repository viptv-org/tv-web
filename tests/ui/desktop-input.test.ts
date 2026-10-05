import { fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { installDesktopPointerInput } from '../../src/ui/desktopInput';

it('blocks desktop shortcuts, tabbing and button focus while preserving clicked text editing', async () => {
  document.body.innerHTML = '<button>Play</button><input type="text"><input type="range">';
  const release = installDesktopPointerInput();
  const shortcut = vi.fn();
  window.addEventListener('keydown', shortcut);
  try {
    const button = document.querySelector('button')!;
    const input = document.querySelector<HTMLInputElement>('input[type=text]')!;
    expect(button.tabIndex).toBe(-1);
    button.focus();
    expect(document.activeElement).not.toBe(button);
    for (const key of ['Tab', 'Escape', ' ', 'ArrowRight', 'MediaPlayPause']) {
      expect(fireEvent.keyDown(button, { key })).toBe(false);
    }
    expect(shortcut).not.toHaveBeenCalled();
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(fireEvent.keyDown(input, { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(false);
    const late = document.createElement('button');
    document.body.append(late);
    await Promise.resolve();
    expect(late.tabIndex).toBe(-1);
  } finally {
    release();
    window.removeEventListener('keydown', shortcut);
    document.body.replaceChildren();
  }
});
