import crypto from 'crypto'
import path from 'path'
import fsPromises from 'fs/promises'
import log from 'electron-log'

export const RESTORE_DIR_NAME = 'restore'

export const getRestoreDirectory = userDataPath => {
  return path.join(userDataPath, RESTORE_DIR_NAME)
}

export const buildSession = (editorState, activeTabId, openedRootDirectory = '') => {
  return {
    openedRootDirectory,
    activeTabId,
    tabs: editorState.tabs.map(tab => {
      const isUntitled = !tab.pathname
      const isModified = !tab.isSaved
      const needsRestoreFile = isUntitled || isModified
      const sessionTab = {
        id: tab.id,
        pathname: tab.pathname || '',
        filename: tab.filename,
        isUntitled,
        isModified,
        options: {
          encoding: tab.encoding,
          lineEnding: tab.lineEnding,
          adjustLineEndingOnSave: tab.adjustLineEndingOnSave,
          trimTrailingNewline: tab.trimTrailingNewline
        },
        cursor: tab.cursor,
        history: tab.history,
        markdown: tab.markdown
      }
      if (needsRestoreFile) {
        sessionTab.restoreFileName = `restore-${tab.id}-${crypto.randomUUID()}.md`
      }
      return sessionTab
    })
  }
}

export const saveSession = async (session, userDataPath) => {
  const restoreDir = getRestoreDirectory(userDataPath)
  await fsPromises.mkdir(restoreDir, { recursive: true })

  // Avoid mutating the caller's session; clone tabs and each tab object.
  const clonedSession = {
    ...session,
    tabs: session.tabs.map(tab => ({ ...tab }))
  }

  // Write restore files for tabs that need them.
  for (const tab of clonedSession.tabs) {
    if (tab.restoreFileName) {
      const restorePath = path.join(restoreDir, tab.restoreFileName)
      await fsPromises.writeFile(restorePath, tab.markdown || '', 'utf8')
      // Remove markdown from serializable metadata to avoid duplication.
      delete tab.markdown
    }
  }

  return clonedSession
}

export const loadSession = async (userDataPath, sessionMeta) => {
  if (!Array.isArray(sessionMeta.tabs)) {
    log.warn('Invalid session: tabs is not an array')
    return { openedRootDirectory: '', activeTabId: null, tabs: [] }
  }
  const restoreDir = getRestoreDirectory(userDataPath)
  const session = {
    openedRootDirectory: sessionMeta.openedRootDirectory || '',
    activeTabId: sessionMeta.activeTabId,
    tabs: []
  }

  for (const tab of sessionMeta.tabs) {
    const loadedTab = { ...tab }
    if (tab.restoreFileName) {
      const restorePath = path.join(restoreDir, tab.restoreFileName)
      try {
        loadedTab.markdown = await fsPromises.readFile(restorePath, 'utf8')
      } catch (err) {
        loadedTab.markdown = ''
        loadedTab.isMissing = true
      }
    } else {
      loadedTab.markdown = ''
    }
    session.tabs.push(loadedTab)
  }

  return session
}

export const clearSession = async (userDataPath, sessionMeta) => {
  if (!sessionMeta || !sessionMeta.tabs) return
  const restoreDir = getRestoreDirectory(userDataPath)
  for (const tab of sessionMeta.tabs) {
    if (tab.restoreFileName) {
      try {
        await fsPromises.unlink(path.join(restoreDir, tab.restoreFileName))
      } catch (err) {
        // Ignore missing files.
      }
    }
  }
}
