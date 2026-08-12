import terminalImage from 'terminal-image'
import { readPngDimensions, renderPng } from './image.js'

const MAX_KITTY_DIMENSION = 10000
const TERMINAL_IMAGE_SCALE = 3

export type TerminalImageOptions = {
  width?: number | string
  height?: number | string
}

export async function renderImageInTerminal(
  svg: string,
  options: TerminalImageOptions = {}
) {
  const png = renderPng(svg, { scale: TERMINAL_IMAGE_SCALE })
  const { width, height } = readPngDimensions(png)

  let finalPng = png
  if (width > MAX_KITTY_DIMENSION || height > MAX_KITTY_DIMENSION) {
    finalPng = renderPng(svg, { fitMaxDimension: true })
  }

  let output: string
  if (options.height === undefined) {
    output = await terminalImage.buffer(finalPng, {
      ...options,
      height: 0,
      preserveAspectRatio: false,
    })
  } else {
    output = await terminalImage.buffer(finalPng, options)
  }
  process.stdout.write(output + '\n')
}
