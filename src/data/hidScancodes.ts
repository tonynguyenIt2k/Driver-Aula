/**
 * Standard USB HID Usage Tables (Usage Page 0x07 Keyboard/Keypad, 0x0C Consumer, 0x01 Mouse)
 * Used by real AULA / SinoWealth / EVVision / Compx firmware keymap tables.
 */

// KeyboardEvent.code -> USB HID Usage ID (Page 0x07)
export const USB_HID_SCANCODES: Record<string, number> = {
  // Letters
  KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07, KeyE: 0x08, KeyF: 0x09,
  KeyG: 0x0a, KeyH: 0x0b, KeyI: 0x0c, KeyJ: 0x0d, KeyK: 0x0e, KeyL: 0x0f,
  KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13, KeyQ: 0x14, KeyR: 0x15,
  KeyS: 0x16, KeyT: 0x17, KeyU: 0x18, KeyV: 0x19, KeyW: 0x1a, KeyX: 0x1b,
  KeyY: 0x1c, KeyZ: 0x1d,

  // Digits
  Digit1: 0x1e, Digit2: 0x1f, Digit3: 0x20, Digit4: 0x21, Digit5: 0x22,
  Digit6: 0x23, Digit7: 0x24, Digit8: 0x25, Digit9: 0x26, Digit0: 0x27,

  // Control & Whitespace
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c,
  Minus: 0x2d, Equal: 0x2e, BracketLeft: 0x2f, BracketRight: 0x30,
  Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39,

  // Function Keys F1-F24
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  F13: 0x68, F14: 0x69, F15: 0x6a, F16: 0x6b, F17: 0x6c, F18: 0x6d,
  F19: 0x6e, F20: 0x6f, F21: 0x70, F22: 0x71, F23: 0x72, F24: 0x73,

  // Navigation
  PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48, Insert: 0x49,
  Home: 0x4a, PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
  ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,

  // Numpad
  NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55,
  NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58,
  Numpad1: 0x59, Numpad2: 0x5a, Numpad3: 0x5b, Numpad4: 0x5c,
  Numpad5: 0x5d, Numpad6: 0x5e, Numpad7: 0x5f, Numpad8: 0x60,
  Numpad9: 0x61, Numpad0: 0x62, NumpadDecimal: 0x63,

  // Modifiers
  ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
  ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
  ContextMenu: 0x65,
};

// Consumer Media Control Usages (Page 0x0C)
export const USB_CONSUMER_CODES: Record<string, number> = {
  AudioVolumeUp: 0x00e9,
  AudioVolumeDown: 0x00ea,
  AudioVolumeMute: 0x00e2,
  MediaPlayPause: 0x00cd,
  MediaTrackNext: 0x00b5,
  MediaTrackPrevious: 0x00b6,
  MediaStop: 0x00b7,
  LaunchCalculator: 0x0192,
  LaunchWebBrowser: 0x0196,
  LaunchMyComputer: 0x0194,
};

// Mouse Action Codes
export const MOUSE_ACTION_CODES: Record<string, number> = {
  MouseLeft: 0x01,
  MouseRight: 0x02,
  MouseMiddle: 0x04,
  MouseBack: 0x08,
  MouseForward: 0x10,
  MouseDoubleClick: 0x11,
  MouseScrollUp: 0x20,
  MouseScrollDown: 0x21,
};

// Standard 32-bit AULA/EVVision key entry encoding:
// [typeByte, modifierByte, hidUsageLo, hidUsageHi]
export function encodeAulaKeyAction(type: string, value: string): [number, number, number, number] {
  if (type === 'disabled') {
    return [0x00, 0x00, 0x00, 0x00];
  }
  if (type === 'media' && USB_CONSUMER_CODES[value] !== undefined) {
    const code = USB_CONSUMER_CODES[value];
    return [0x03, 0x00, code & 0xff, (code >> 8) & 0xff];
  }
  if (type === 'mouse' && MOUSE_ACTION_CODES[value] !== undefined) {
    return [0x04, 0x00, MOUSE_ACTION_CODES[value], 0x00];
  }
  if (type === 'rgb') {
    const rgbMap: Record<string, number> = {
      RGB_MODE_NEXT: 0x01,
      RGB_MODE_PREV: 0x02,
      RGB_BRIGHTNESS_UP: 0x03,
      RGB_BRIGHTNESS_DOWN: 0x04,
      RGB_SPEED_UP: 0x05,
      RGB_SPEED_DOWN: 0x06,
      RGB_TOGGLE: 0x07,
    };
    return [0x06, 0x00, rgbMap[value] ?? 0x01, 0x00];
  }
  const usage = USB_HID_SCANCODES[value] ?? 0x00;
  // Modifiers (0xE0..0xE7)
  if (usage >= 0xe0 && usage <= 0xe7) {
    const modBit = 1 << (usage - 0xe0);
    return [0x01, modBit, 0x00, 0x00];
  }
  return [0x02, 0x00, usage, 0x00];
}
