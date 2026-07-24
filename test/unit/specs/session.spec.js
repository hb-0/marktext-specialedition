import { expect } from 'chai'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import {
  buildSession,
  saveSession,
  loadSession,
  clearSession,
  getRestoreDirectory
} from '../../../src/main/utils/session'

describe('session utils', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-session-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('buildSession converts renderer tabs to session tabs', () => {
    const state = {
      tabs: [{
        id: 't1',
        pathname: '/foo.md',
        filename: 'foo.md',
        isSaved: true,
        markdown: '',
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 3,
        cursor: { anchor: { key: '1' } },
        history: { stack: [], index: -1 }
      }]
    }
    const session = buildSession(state, 't1')
    expect(session.activeTabId).to.equal('t1')
    expect(session.tabs[0].isModified).to.equal(false)
    expect(session.tabs[0].isUntitled).to.equal(false)
    expect(session.tabs[0].restoreFileName).to.equal(undefined)
  })

  it('getRestoreDirectory returns a restore subdirectory', () => {
    const restoreDir = getRestoreDirectory(tmpDir)
    expect(restoreDir).to.equal(path.join(tmpDir, 'restore'))
  })

  it('buildSession marks unsaved tab as modified and assigns restore file', () => {
    const state = {
      tabs: [{
        id: 't2',
        pathname: '/foo.md',
        filename: 'foo.md',
        isSaved: false,
        markdown: 'hello',
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 3,
        cursor: null,
        history: { stack: [], index: -1 }
      }]
    }
    const session = buildSession(state, 't2')
    expect(session.tabs[0].isModified).to.equal(true)
    expect(session.tabs[0].restoreFileName).to.match(/^restore-t2-/)
  })

  it('buildSession preserves markdown on session tabs', () => {
    const state = {
      tabs: [{
        id: 't1',
        pathname: '/foo.md',
        filename: 'foo.md',
        isSaved: false,
        markdown: 'hello world',
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 3,
        cursor: null,
        history: { stack: [], index: -1 }
      }]
    }
    const session = buildSession(state, 't1')
    expect(session.tabs[0].markdown).to.equal('hello world')
  })

  it('saveSession writes modified markdown to restore files', async () => {
    const session = {
      openedRootDirectory: '',
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        pathname: '',
        filename: 'Untitled-1',
        isUntitled: true,
        isModified: false,
        markdown: 'hello',
        options: {},
        cursor: null,
        history: { stack: [], index: -1 },
        restoreFileName: 'restore-t1-x.md'
      }]
    }
    await saveSession(session, tmpDir)
    const loaded = await loadSession(tmpDir, session)
    expect(loaded.tabs[0].markdown).to.equal('hello')
  })

  it('saveSession does not mutate the input session', async () => {
    const session = {
      openedRootDirectory: '',
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        pathname: '',
        filename: 'Untitled-1',
        isUntitled: true,
        isModified: false,
        markdown: 'do not delete me',
        options: {},
        cursor: null,
        history: { stack: [], index: -1 },
        restoreFileName: 'restore-t1-x.md'
      }]
    }
    await saveSession(session, tmpDir)
    expect(session.tabs[0].markdown).to.equal('do not delete me')
  })

  it('clearSession removes restore files', async () => {
    const session = {
      openedRootDirectory: '',
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        pathname: '',
        filename: 'Untitled-1',
        isUntitled: true,
        isModified: false,
        markdown: 'hello',
        options: {},
        cursor: null,
        history: { stack: [], index: -1 },
        restoreFileName: 'restore-t1-x.md'
      }]
    }
    await saveSession(session, tmpDir)
    const restorePath = path.join(getRestoreDirectory(tmpDir), 'restore-t1-x.md')
    expect(await fs.access(restorePath).then(() => true).catch(() => false)).to.equal(true)

    await clearSession(tmpDir, session)
    expect(await fs.access(restorePath).then(() => true).catch(() => false)).to.equal(false)
  })
})
