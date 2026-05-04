export function printLn(...strings: string[]) {
  process.stdout.write(strings.join(' ') + '\n')
}
