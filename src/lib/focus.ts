/**
 * Focus a text box only on devices with a mouse or stylus. On phones and tablets focusing a box pops the keyboard
 * up over the screen, so the till never does it by itself there.
 */
export function focusIfDesktop(el: HTMLElement | null | undefined) {
  try {
    if (el && window.matchMedia("(pointer: fine)").matches) el.focus();
  } catch { /* ignore */ }
}
