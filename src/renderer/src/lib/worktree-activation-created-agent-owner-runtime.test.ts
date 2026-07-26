import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { useAppStore } from '@/store'
import { ensureWebRuntimeWorktreeTerminalAfterWake } from './worktree-activation'
import { resetWebSessionTabsSnapshotFreshnessForTests } from '@/runtime/web-session-tabs-sync'
import { resetWebRuntimeWakeTerminalRespawnForTests } from '@/runtime/web-runtime-wake-terminal-respawn'
import { makeCreatedAgentWorktree as makeWorktree } from '@/lib/worktree-activation-created-agent-test-state'

const initialAppStoreState = useAppStore.getState()

afterEach(() => {
  delete (globalThis as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__
  vi.unstubAllGlobals()
  resetWebSessionTabsSnapshotFreshnessForTests()
  resetWebRuntimeWakeTerminalRespawnForTests()
  useAppStore.setState(initialAppStoreState, true)
})

describe('created-agent wake on the owner runtime', () => {
  it('respawns wake terminals on the explicit owner runtime when focus changed', async () => {
    const worktree = makeWorktree()
    const callRuntimeEnvironment = vi.fn().mockResolvedValue({
      ok: true,
      result: { tabId: 'host-tab-1', terminal: 'term_host' }
    })
    ;(globalThis as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__ = true
    vi.stubGlobal('window', {
      api: { runtimeEnvironments: { call: callRuntimeEnvironment, subscribe: vi.fn() } }
    })
    useAppStore.setState({
      repos: [
        {
          id: 'repo-1',
          path: '/workspace/repo',
          displayName: 'repo',
          badgeColor: '#000000',
          addedAt: 0,
          executionHostId: 'runtime:owner-runtime'
        }
      ],
      worktreesByRepo: { 'repo-1': [worktree] },
      tabsByWorktree: {
        [worktree.id]: [
          {
            id: 'tab-1',
            ptyId: 'pty-1',
            worktreeId: worktree.id,
            title: 'Terminal 1',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1
          }
        ]
      },
      ptyIdsByTabId: { 'tab-1': [] },
      settings: {
        ...getDefaultSettings('/workspace/.orca-workspaces'),
        activeRuntimeEnvironmentId: 'focused-runtime'
      },
      reconcileWorktreeTabModel: vi.fn(() => ({
        renderableTabCount: 1,
        activeRenderableTabId: 'tab-1'
      }))
    })

    ensureWebRuntimeWorktreeTerminalAfterWake(worktree.id)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(callRuntimeEnvironment).toHaveBeenCalledWith(
      expect.objectContaining({
        selector: 'owner-runtime',
        method: 'session.tabs.createTerminal'
      })
    )
    expect(callRuntimeEnvironment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        selector: 'focused-runtime',
        method: 'session.tabs.createTerminal'
      })
    )
  })
})
