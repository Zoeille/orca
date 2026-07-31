import {
  deliverLaunchPromptToAgentTab,
  seedNativeChatLaunchDraftForAgentTab
} from '@/lib/agent-launch-prompt-delivery'
import { createPasteReadinessTimeoutNotice } from '@/lib/launch-agent-paste-timeout-notice'
import { seedCommandCodeSubmittedPromptStatus } from '@/lib/command-code-prompt-status-seed'
import type { AgentId } from '../../../shared/custom-agent'
import type { LaunchSource } from '../../../shared/telemetry-events'

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
      if (args.promptDelivery === 'draft') {
        // The draft rode in on argv (Claude --prefill etc.), so no paste runs
        // and deliverLaunchPromptToAgentTab never seeds. Mirror it into chat here.
        seedNativeChatLaunchDraftForAgentTab({
          tabId: args.tabId,
          agent: args.agent,
          text: args.prompt
        })
      }
      args.onPromptDelivered?.()
    }
    return undefined
  }
  const timeoutNotice = createPasteReadinessTimeoutNotice({
    worktreeId: args.worktreeId,
    tabId: args.tabId,
    agent: args.agent,
    submitted: args.submitPastedPrompt
  })
  return deliverLaunchPromptToAgentTab({
    tabId: args.tabId,
    content: args.pastePrompt,
    agent: args.agent,
    submit: args.submitPastedPrompt,
    forcePaste: args.promptDelivery === 'submit-after-ready',
    onTimeout: timeoutNotice.onTimeout
  }).then((delivered) => {
    if (delivered) {
      if (args.agent === 'command-code' && args.submitPastedPrompt) {
        // Command Code has no prompt-submit hook; seed working at delivery time.
        seedCommandCodeSubmittedPromptStatus(args.worktreeId, args.tabId, args.prompt)
      }
      args.onPromptDelivered?.()
    }
    return { delivered, failureNotified: !delivered && timeoutNotice.wasNotified() }
  })
}
