import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { deliverLaunchPromptToAgentTab } from '@/lib/agent-launch-prompt-delivery'
import { seedCommandCodeSubmittedPromptStatus } from '@/lib/command-code-prompt-status-seed'
import { track, tuiAgentToAgentKind } from '@/lib/telemetry'
import { isCustomAgentId, type AgentId } from '../../../shared/custom-agent'
import type { LaunchSource } from '../../../shared/telemetry-events'
import { translate } from '@/i18n/i18n'

type PromptDeliveryOutcome = { delivered: boolean; failureNotified: boolean }

export function finalizeAgentTabLaunchPrompt(args: {
  tabId: string
  worktreeId: string
  agent: AgentId
  prompt: string
  pastePrompt: string | null
  submitPastedPrompt: boolean
  promptDelivery: 'auto-submit' | 'draft' | 'submit-after-ready'
  launchSource: LaunchSource
  onPromptDelivered?: () => void
}): Promise<PromptDeliveryOutcome> | undefined {
  if (args.pastePrompt === null) {
    if (args.prompt) {
      args.onPromptDelivered?.()
    }
    return undefined
  }
  let failureNotified = false
  const delivery = deliverLaunchPromptToAgentTab({
    tabId: args.tabId,
    content: args.pastePrompt,
    agent: args.agent,
    submit: args.submitPastedPrompt,
    forcePaste: args.promptDelivery === 'submit-after-ready',
    onTimeout: () => {
      const state = useAppStore.getState()
      const currentTab = (state.tabsByWorktree[args.worktreeId] ?? []).find(
        (tab) => tab.id === args.tabId
      )
      if (currentTab?.ptyId === null) {
        return
      }
      if (!currentTab || state.activeWorktreeId !== args.worktreeId) {
        failureNotified = true
        return
      }
      toast.message(
        translate(
          'auto.lib.launch.agent.in.new.tab.a5a1f7033f',
          "Your {{value0}} wasn't sent — paste it once the agent is ready.",
          { value0: args.submitPastedPrompt ? 'prompt' : 'notes' }
        )
      )
      failureNotified = true
      track('agent_error', {
        error_class: 'paste_readiness_timeout',
        agent_kind: isCustomAgentId(args.agent) ? 'other' : tuiAgentToAgentKind(args.agent)
      })
    }
  }).then((delivered) => {
    if (delivered) {
      if (args.agent === 'command-code' && args.submitPastedPrompt) {
        seedCommandCodeSubmittedPromptStatus(args.worktreeId, args.tabId, args.prompt)
      }
      args.onPromptDelivered?.()
    }
    return { delivered, failureNotified: !delivered && failureNotified }
  })
  return delivery
}
