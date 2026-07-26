import type { SleepingAgentLaunchConfig } from './agent-session-resume'
import type { StartupCommandDelivery } from './codex-startup-delivery'
import type { AgentId } from './custom-agent'
import type { SessionOptionValue } from './native-chat-session-options'

export type AgentStartupPlan = {
  agent: AgentId
  launchCommand: string
  expectedProcess: string
  followupPrompt: string | null
  launchConfig: SleepingAgentLaunchConfig
  launchToken?: string
  draftPrompt?: string | null
  env?: Record<string, string>
  startupCommandDelivery?: StartupCommandDelivery
  /** Values emitted into this launch command, retained as base model ids. */
  sessionOptions?: Record<string, SessionOptionValue>
}
