import { Resvg } from '@resvg/resvg-js'
import terminalImage from 'terminal-image'

export type TerminalImageOptions = {
  width?: number | string
  height?: number | string
}

export async function renderImageInTerminal(
  svg: string,
  options: TerminalImageOptions = {}
) {
  const resvg = new Resvg(svg, { background: '#ffffff' })
  const png = resvg.render().asPng()

  const output = await terminalImage.buffer(png, options)
  process.stdout.write(output + '\n')
}
