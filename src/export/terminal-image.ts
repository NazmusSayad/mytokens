import terminalImage from 'terminal-image'
import { readPngDimensions, renderPng } from './image.js'

const MAX_KITTY_DIMENSION = 10000

export type TerminalImageOptions = {
  width?: number | string
  height?: number | string
}

export async function renderImageInTerminal(
  svg: string,
  options: TerminalImageOptions = {}
) {
  const basePng = renderPng(svg)
  const { width: baseWidth } = readPngDimensions(basePng)
  const cellWidth = await readTerminalCellWidth()
  const targetWidth = (process.stdout.columns ?? 80) * (cellWidth ?? 0)

  let png = basePng
  if (targetWidth > baseWidth) {
    png = renderPng(svg, { scale: targetWidth / baseWidth })
  }

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

async function readTerminalCellWidth(): Promise<number | undefined> {
  if (!process.stdin.isTTY || process.stdin.isRaw) {
    return undefined
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(done, 100)

    function done(width?: number) {
      clearTimeout(timeout)
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      resolve(width)
    }

    function onData(data: Buffer) {
      const match = /\u001B\[6;\d+;(\d+)t/.exec(data.toString())
      if (match) {
        done(Number(match[1]))
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on('data', onData)
    process.stdout.write('\u001B[16t')
  })
}
