import { Resvg } from '@resvg/resvg-js'
import terminalImage from 'terminal-image'

const MAX_KITTY_DIMENSION = 10000

export type TerminalImageOptions = {
  width?: number | string
  height?: number | string
}

export async function renderImageInTerminal(
  svg: string,
  options: TerminalImageOptions = {}
) {
  const png = renderPng(svg, { fitMaxDimension: false })
  const { width, height } = readPngDimensions(png)

  let finalPng = png
  if (width > MAX_KITTY_DIMENSION || height > MAX_KITTY_DIMENSION) {
    finalPng = renderPng(svg, { fitMaxDimension: true })
  }

  const output = await terminalImage.buffer(finalPng, options)
  process.stdout.write(output + '\n')
}

function readPngDimensions(png: Buffer): { width: number; height: number } {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  }
}

export function renderPng(
  svg: string,
  options: { fitMaxDimension?: boolean; scale?: number } = {}
): Buffer {
  if (options.scale && options.scale > 0 && options.scale !== 1) {
    return new Resvg(svg, {
      background: '#ffffff',
      fitTo: { mode: 'zoom', value: options.scale },
    })
      .render()
      .asPng()
  }

  if (!options.fitMaxDimension) {
    return new Resvg(svg, { background: '#ffffff' }).render().asPng()
  }

  let png = new Resvg(svg, {
    background: '#ffffff',
    fitTo: { mode: 'height', value: MAX_KITTY_DIMENSION },
  })
    .render()
    .asPng()

  if (readPngDimensions(png).width > MAX_KITTY_DIMENSION) {
    png = new Resvg(svg, {
      background: '#ffffff',
      fitTo: { mode: 'width', value: MAX_KITTY_DIMENSION },
    })
      .render()
      .asPng()
  }

  return png
}
