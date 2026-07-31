// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace, ProjectGroup } from '../../../../shared/types'
import type * as NewWorkspaceModule from '@/lib/new-workspace'

const mocks = vi.hoisted(() => ({
  activateAndRevealFolderWorkspace: vi.fn(),
  ensureAgentStartupInTerminal: vi.fn()
}))

// Why: importOriginal keeps the real resolveStartupLaunchDraftText, so the
// invariant test below exercises the shipped gate instead of a copy of it.
vi.mock('@/lib/worktree-activation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, activateAndRevealFolderWorkspace: mocks.activateAndRevealFolderWorkspace }
})

vi.mock('@/lib/new-workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof NewWorkspaceModule>()
  return {
    ...actual,
    ensureAgentStartupInTerminal: mocks.ensureAgentStartupInTerminal
  }
})

import { useAppStore } from '@/store'
import { decideInitialAgentTabViewMode } from '@/lib/native-chat-initial-view-mode'
import { resolveStartupLaunchDraftText } from '@/lib/worktree-activation'
import { submitFolderWorkspaceCreate } from './folder-workspace-composer-submit'

function makeProjectGroup(): ProjectGroup {
  return {
    id: 'group-1',
    name: 'Platform',
    parentPath: '/repo/platform',
    parentGroupId: null,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
}

function makeFolderWorkspace(overrides: Partial<FolderWorkspace> = {}): FolderWorkspace {
  return {
    id: 'folder-workspace-1',
    projectGroupId: 'group-1',
    name: 'hi',
    folderPath: '/repo/platform/hi',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}
describe('folder-workspace draft: seeded set == chat-opening set', () => {
  const ISSUE_URL = 'https://github.com/stablyai/orca/issues/42'
  const linkedIssue = {
    provider: 'github' as const,
    type: 'issue' as const,
    number: 42,
    title: 'Restore linked quick-create',
    url: ISSUE_URL,
    repoId: 'repo-1'
  }

  beforeEach(() => {
    mocks.activateAndRevealFolderWorkspace.mockReturnValue({ primaryTabId: 'tab-1' })
    useAppStore.setState({ nativeChatLaunchDraftByTabId: {} })
    Object.assign(window, {
      api: { agentTrust: { markTrusted: vi.fn().mockResolvedValue(undefined) } }
    })
  })

  afterEach(() => {
    mocks.activateAndRevealFolderWorkspace.mockReset()
    mocks.ensureAgentStartupInTerminal.mockReset()
    useAppStore.setState({ nativeChatLaunchDraftByTabId: {} })
    Reflect.deleteProperty(window, 'api')
    vi.restoreAllMocks()
  })

  // Why: `claude` takes its draft on argv, so `startupPlan.draftPrompt` stays
  // undefined; `codex` gets a startup paste and sets it. Both must reach the
  // view-mode gate, and both must agree with what the composer actually holds.
  it.each([
    ['argv-prefill', 'claude' as const, '', true],
    ['argv-prefill multi-line', 'claude' as const, 'Reproduce on Windows first', true],
    ['startup-paste', 'codex' as const, '', true],
    ['startup-paste multi-line', 'codex' as const, 'Reproduce on Windows first', true]
  ])('%s', async (_label, quickAgent, note, expectMirrored) => {
    await submitFolderWorkspaceCreate({
      projectGroup: makeProjectGroup(),
      name: '',
      lastAutoName: '',
      linkedWorkItem: linkedIssue,
      note,
      quickAgent,
      autoRenameBranchFromWork: false,
      agentCmdOverrides: {},
      createFolderWorkspace: vi.fn(async () => makeFolderWorkspace()),
      onOpenChange: vi.fn()
    })

    const startup = mocks.activateAndRevealFolderWorkspace.mock.calls[0]?.[1]?.startup
    const seeded = useAppStore.getState().nativeChatLaunchDraftByTabId['tab-1'] != null
    const draftText = resolveStartupLaunchDraftText(startup)
    const opensInChat =
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: true,
        agent: quickAgent,
        ...(draftText != null
          ? { promptDelivery: 'draft' as const, launchDraftText: draftText }
          : {})
      }) === 'chat'

    // The draft always reaches the TUI, whichever way it is delivered.
    expect(`${startup?.command ?? ''}${startup?.draftPrompt ?? ''}`).toContain(ISSUE_URL)
    expect(seeded).toBe(expectMirrored)
    expect(opensInChat).toBe(expectMirrored)
  })
})
