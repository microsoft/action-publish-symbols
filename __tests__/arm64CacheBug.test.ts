/**
 * Regression test for the ARM64 tool-cache bug in updateSymbolClient.
 *
 * Root cause: find() was called with a hardcoded 'x64' arch, but tc.cacheDir()
 * caches using the machine's actual arch (os.arch()). On ARM64 runners this means
 * the cache is written to `.../SymbolClient/{version}/arm64` but the lookup always
 * checks `.../SymbolClient/{version}/x64` — a permanent cache miss.
 *
 * Consequence: every invocation of the action in the same job attempted a fresh
 * download + tc.cacheDir() call. The second call's tc.cacheDir() tried to rmRF the
 * arm64 directory that was still in use from the first call, producing:
 *   EPERM: operation not permitted, unlink '...SymbolClient/.../arm64'
 *
 * Fix: remove the hardcoded 'x64' from the find() call so it defaults to os.arch(),
 * matching what tc.cacheDir() uses.
 */

import * as ps from '../src/PublishSymbols'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as io from '@actions/io'
import axios from 'axios'

jest.mock('axios')

const CACHE_DIR = process.env['RUNNER_TOOL_CACHE'] as string
const TOOL_NAME = 'SymbolClient'
const VERSION = '20.270.37102.7'

// Simulate what tc.cacheDir() does: write the tool to {CACHE}/{name}/{version}/{arch}
// and create a {arch}.complete marker file.
async function simulateCacheDir(arch: string): Promise<string> {
  const toolPath = path.join(CACHE_DIR, TOOL_NAME, VERSION, arch)
  await io.mkdirP(toolPath)
  fs.writeFileSync(`${toolPath}.complete`, '')
  return toolPath
}

async function cleanCache(): Promise<void> {
  const toolPath = path.join(CACHE_DIR, TOOL_NAME)
  if (fs.existsSync(toolPath)) {
    await io.rmRF(toolPath)
  }
}

// ---------------------------------------------------------------------------
// 1. Demonstrate the bug: find() with hardcoded 'x64' misses the arm64 cache
// ---------------------------------------------------------------------------
describe('find() arch mismatch bug', () => {
  beforeEach(cleanCache)
  afterEach(cleanCache)

  it('returns empty string for x64 when tool is cached as arm64 (the bug)', async () => {
    await simulateCacheDir('arm64')

    // This is the BUGGY call that was in the original code.
    // It always looks for x64 regardless of the actual machine arch.
    const result = ps.find(TOOL_NAME, VERSION, 'x64')

    expect(result).toBe('')
  })

  it('finds the cache when arch matches what tc.cacheDir() wrote (the fix)', async () => {
    const arch = os.arch() // same default used by tc.cacheDir()
    await simulateCacheDir(arch)

    // This is the FIXED call — no hardcoded arch, defaults to os.arch().
    const result = ps.find(TOOL_NAME, VERSION)

    expect(result).not.toBe('')
    expect(result).toContain(arch)
  })
})

// ---------------------------------------------------------------------------
// 2. Demonstrate the consequence: updateSymbolClient() re-downloads every time
//    when find() always misses, causing the EPERM on the second cacheDir call.
// ---------------------------------------------------------------------------
describe('updateSymbolClient() called twice in the same job', () => {
  const FAKE_DOWNLOAD_URI = 'https://example.com/symbol.app.buildtask.zip'

  let cacheDirMock: jest.SpyInstance

  beforeEach(async () => {
    await cleanCache()

    // Mock axios so getSymbolClientVersion() returns our fixed version without
    // making real network calls. On non-Windows, the code uses axios.get; on
    // Windows it uses axios.head. Mock both to be safe.
    const mockedAxios = axios as jest.Mocked<typeof axios>
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {version: VERSION, uri: FAKE_DOWNLOAD_URI}
    })
    mockedAxios.head.mockResolvedValue({
      status: 200,
      headers: {'symbol-client-version': VERSION}
    })

    // downloadSymbolClient calls tc.downloadTool internally.
    jest.spyOn(tc, 'downloadTool').mockResolvedValue('/tmp/fake/symbol.app.buildtask.zip')

    // unzipSymbolClient calls tc.extractZip (Windows) or exec.exec (non-Windows) internally.
    jest.spyOn(tc, 'extractZip').mockResolvedValue('/tmp/fake/symbol.app.buildtask')
    jest.spyOn(exec, 'exec').mockResolvedValue(0)

    // Simulate tc.cacheDir(): cache at os.arch() and return the path.
    cacheDirMock = jest.spyOn(tc, 'cacheDir').mockImplementation(async () => {
      return simulateCacheDir(os.arch())
    })
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await cleanCache()
  })

  it('only downloads once when called twice (fix: find() uses os.arch())', async () => {
    // First call: cache miss → download → cache written as os.arch()
    await ps.updateSymbolClient('testAccount', 'https://example.com', 'pat')
    expect(tc.downloadTool).toHaveBeenCalledTimes(1)
    expect(cacheDirMock).toHaveBeenCalledTimes(1)

    // Second call: should be a cache hit → no download, no cacheDir
    await ps.updateSymbolClient('testAccount', 'https://example.com', 'pat')
    expect(tc.downloadTool).toHaveBeenCalledTimes(1) // still 1 — not called again
    expect(cacheDirMock).toHaveBeenCalledTimes(1) // still 1 — not called again
  })
})
