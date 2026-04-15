import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import { readFileSync } from 'node:fs'

const cwd = process.cwd()
const tsconfig = JSON.parse(readFileSync(new URL('./tsconfig.json', import.meta.url)))
const paths = tsconfig.compilerOptions?.paths ?? {}

const aliases = Object.entries(paths).map(([alias, targets]) => ({
  prefix: alias.replace('/*', ''),
  target: targets[0].replace('/*', '')
}))

export function resolve(specifier, context, nextResolve) {
  for (const { prefix, target } of aliases) {
    if (specifier.startsWith(prefix + '/') || specifier === prefix) {
      const suffix = specifier.slice(prefix.length)
      const resolved = resolvePath(cwd, target + suffix)
      return nextResolve(pathToFileURL(resolved).href, context)
    }
  }
  return nextResolve(specifier, context)
}
