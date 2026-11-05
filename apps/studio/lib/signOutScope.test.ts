/**
 * supabase-js signs out with `scope: 'global'` unless it is told otherwise, and
 * the console signs in against the Supabase project every Taskclan product
 * shares. So an unscoped sign-out here ends the account's sessions in every
 * product, on every device: between 2026-10-29 and 11-01, TalentKit's sign-outs
 * did exactly that to Intelligence and this console. Every sign-out names its
 * scope: `{ scope: 'local' }` for this browser, and 'others' or 'global' only
 * where ending the other sessions is the point (the password forms).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const BASE = join(__dirname, '..', '..', '..')
const ROOTS = ['apps/studio', 'packages/common']
// API docs: code samples shown to customers for their own projects' auth, not calls.
const ALLOWED = new Set<string>([
  'apps/studio/components/interfaces/Docs/Snippets.ts',
  'apps/studio/components/interfaces/ProjectAPIDocs/ProjectAPIDocs.constants.ts',
])

const SKIP = new Set(['node_modules', '.next', '__tests__', 'dist', 'build', 'coverage'])
const SOURCE = /\.[cm]?[jt]sx?$/
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
// `auth.signOut()`, `gotrueClient.signOut({})`, or the method handed on as a
// callback (an onClick handler would pass its click event in as the options).
const UNSCOPED =
  /\b(?:auth|gotrueClient)\s*\??\.\s*signOut\b(?:\s*\(\s*(?:\{\s*\}\s*)?\)|(?!\s*\())/g

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : sourceFiles(child)
    return SOURCE.test(entry.name) && !TEST.test(entry.name) ? [child] : []
  })
}

/** Comment lines are blanked (keeping line numbers), so prose about signOut() doesn't count. */
function codeOnly(text: string): string {
  return text
    .split('\n')
    .map((line) => (/^\s*(?:\/\/|\/?\*|\{\/\*)/.test(line) ? '' : line))
    .join('\n')
}

function unscopedSignOuts(): string[] {
  return ROOTS.flatMap((root) => sourceFiles(join(BASE, root)))
    .filter((file) => !ALLOWED.has(relative(BASE, file)))
    .flatMap((file) => {
      const code = codeOnly(readFileSync(file, 'utf8'))
      return [...code.matchAll(UNSCOPED)].map(
        (match) => `${relative(BASE, file)}:${code.slice(0, match.index).split('\n').length}`
      )
    })
}

describe('sign-out scope', () => {
  it('every Supabase sign-out names its scope', () => {
    expect(unscopedSignOuts()).toEqual([])
  })

  it('notices an unscoped sign-out', () => {
    // Proves the scan can fail: the same pattern over lines that have one.
    expect('const result = await gotrueClient.signOut()'.match(UNSCOPED)).not.toBeNull()
    expect('onClick={auth.signOut}'.match(UNSCOPED)).not.toBeNull()
    expect("await auth.signOut({ scope: 'others' })".match(UNSCOPED)).toBeNull()
  })
})
