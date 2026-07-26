import type { AgentId, CustomAgentDefinition } from './custom-agent'
import { customAgentForId, isCustomAgentId } from './custom-agent'
import { getCommandTokenPathBasename, getFirstCommandToken } from './command-token-scanner'
import type { SessionOptionValue } from './native-chat-session-options'
import { getTuiAgentLaunchCommand, TUI_AGENT_CONFIG, type TuiAgentConfig } from './tui-agent-config'
import {
  resolveAgentLaunchCommand,
  type ResolvedAgentLaunchCommand
} from './tui-agent-launch-command'
import { planAgentCliArgsSuffix, type AgentStartupShell } from './tui-agent-startup-shell'

export type TuiAgentCommandResolutionArgs = {
  agent: AgentId
  cmdOverrides: Partial<Record<string, string>>
  platform: NodeJS.Platform
  shell: AgentStartupShell
  agentArgs?: string | null
  sessionOptions?: Record<string, SessionOptionValue>
  isRemote?: boolean
  customAgent?: CustomAgentDefinition
  customAgents?: readonly CustomAgentDefinition[]
}

export function resolveBaseCommand(
  args: TuiAgentCommandResolutionArgs
): { ok: true; command: string } | { ok: false; error: string } {
  const override = args.cmdOverrides[args.agent]
  let command: string
  if (override) {
    command = override
  } else if (isCustomAgentId(args.agent)) {
    const customAgent = args.customAgent ?? customAgentForId(args.agent, args.customAgents)
    if (!customAgent) {
      return { ok: false, error: `Unknown custom agent: ${args.agent}` }
    }
    command = customAgent.command
  } else {
    command = getTuiAgentLaunchCommand(TUI_AGENT_CONFIG[args.agent], args.platform, {
      isRemote: args.isRemote
    })
  }
  const suffix = planAgentCliArgsSuffix(args.agentArgs, args.shell)
  if (!suffix.ok) {
    return suffix
  }
  return { ok: true, command: suffix.suffix ? `${command} ${suffix.suffix}` : command }
}

export function resolveTuiAgentStartupCommand(
  args: TuiAgentCommandResolutionArgs
): ResolvedAgentLaunchCommand {
  if (!isCustomAgentId(args.agent)) {
    return resolveAgentLaunchCommand({
      agent: args.agent,
      cmdOverrides: args.cmdOverrides,
      platform: args.platform,
      shell: args.shell,
      agentArgs: args.agentArgs,
      sessionOptions: args.sessionOptions,
      isRemote: args.isRemote
    })
  }
  const baseCommand = resolveBaseCommand(args)
  if (!baseCommand.ok) {
    return baseCommand
  }
  return {
    ...baseCommand,
    commandWithoutSessionOptions: baseCommand.command,
    appliedSessionOptions: {}
  }
}

export function resolveTuiAgentConfig(
  agent: AgentId,
  customAgent: CustomAgentDefinition | undefined
): TuiAgentConfig {
  if (!isCustomAgentId(agent)) {
    return TUI_AGENT_CONFIG[agent]
  }
  const commandToken = customAgent?.command ? getFirstCommandToken(customAgent.command) : ''
  return {
    detectCmd: '',
    launchCmd: '',
    expectedProcess: commandToken ? getCommandTokenPathBasename(commandToken) : agent,
    promptInjectionMode: customAgent?.promptMode === 'argv' ? 'argv' : 'stdin-after-start'
  }
}
