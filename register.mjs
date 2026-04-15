import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('ts-node/esm', pathToFileURL('./'))
register(new URL('./path-aliases.mjs', import.meta.url))
