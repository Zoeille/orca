import type { AgentId, CustomAgentDefinition } from '../../../../shared/custom-agent'
import { isAgentEnabled } from '../../../../shared/tui-agent-selection'

export function resolveDefaultAutomationAgent(args: {
  defaultTuiAgent: AgentId | 'blank' | null | undefined
  disabledTuiAgents: Iterable<unknown> | null | undefined
  customAgents: readonly CustomAgentDefinition[] | undefined
  fallback: AgentId
}): AgentId {
  const { defaultTuiAgent, disabledTuiAgents, customAgents, fallback } = args
  if (!defaultTuiAgent || defaultTuiAgent === 'blank') {
    return fallback
  }
  return isAgentEnabled(defaultTuiAgent, { disabledTuiAgents, customAgents })
    ? defaultTuiAgent
    : fallback
}
