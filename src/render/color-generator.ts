import { webcrypto } from 'node:crypto';

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    return val.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export async function colorGenerator(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await webcrypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);

  const hue = ((bytes[0] * 256 + bytes[1]) / 65535) * 360;
  const saturation = 65 + (bytes[2] / 255) * 35;
  const lightness = 40 + (bytes[3] / 255) * 20;

  return hslToHex(hue, saturation, lightness);
}
