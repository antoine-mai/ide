import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { AgentRole, SupervisorConfig, TaskItem } from '../src/types/agent-roles';
import { InstalledAI } from '../src/components/ManageAgentsModal';
import {
  generateRepoMap,
  compressMemberOutputForLeader,
} from './context-optimizer';

export interface WorkflowEvent {
  type: 'supervisor_plan' | 'agent_evaluating' | 'agent_pushback' | 'agent_executing' | 'agent_done' | 'workflow_finished';
  roleId?: string;
  roleName?: string;
  agentName?: string;
  taskId?: string;
  content: string;
  data?: any;
  taskItem?: TaskItem;
}

// Annotation State for LangGraph
export const MultiAgentStateAnnotation = Annotation.Root({
  userPrompt: Annotation<string>,
  projectPath: Annotation<string>,
  supervisorConfig: Annotation<SupervisorConfig>,
  roles: Annotation<AgentRole[]>,
  installedAIs: Annotation<InstalledAI[]>,
  tasks: Annotation<TaskItem[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  currentTaskIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  negotiationCount: Annotation<Record<string, number>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  logs: Annotation<string[]>({
    reducer: (curr, next) => curr.concat(next),
    default: () => [],
  }),
  finalSummary: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
});

export type MultiAgentStateType = typeof MultiAgentStateAnnotation.State;

/**
 * Runner helper that invokes either a CLI Agent or direct API
 */
export async function executeAgentCLI(
  agent: InstalledAI,
  prompt: string,
  cwd: string
): Promise<string> {
  // Use child_process or internal spawn
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  let command = `${agent.command} ${agent.defaultArgs || ''}`;
  if (agent.command === 'agy') {
    command = `agy -p="${prompt.replace(/"/g, '\\"')}"`;
  } else {
    command = `${agent.command} "${prompt.replace(/"/g, '\\"')}"`;
  }

  const env = {
    ...process.env,
    ...(agent.customHome ? { HOME: agent.customHome, USERPROFILE: agent.customHome } : {}),
    ...(agent.customEnv || {}),
  };

  try {
    const { stdout, stderr } = await execAsync(command, { cwd, env, timeout: 60000 });
    return stdout.trim() || stderr.trim() || 'Task executed';
  } catch (err: any) {
    return `Execution error: ${err?.message || err}`;
  }
}

/**
 * Call supervisor LLM (either via registered CLI or Direct API fetch)
 */
export async function callSupervisor(
  config: SupervisorConfig,
  prompt: string,
  cwd: string,
  installedAIs: InstalledAI[]
): Promise<string> {
  if (config.type === 'agent' && config.selectedAgentId) {
    const agent = installedAIs.find((a) => a.id === config.selectedAgentId);
    if (agent) {
      return executeAgentCLI(agent, prompt, cwd);
    }
  }

  // Fallback or API direct
  if (config.type === 'api' && config.apiKey) {
    try {
      if (config.apiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.modelName || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (e: any) {
      return `API Error: ${e?.message}`;
    }
  }

  // Mock planner fallback if no agent/api configured yet
  return JSON.stringify({
    tasks: [
      {
        roleName: 'Lead Developer',
        title: 'Implement requested functionality',
        instructions: prompt,
      },
      {
        roleName: 'Code Reviewer',
        title: 'Review and verify implementation',
        instructions: 'Check code quality, security and performance against role rules.',
      },
    ],
  });
}

/**
 * Build the Multi-Agent StateGraph
 */
export function buildMultiAgentGraph(onEvent?: (event: WorkflowEvent) => void) {
  const workflow = new StateGraph(MultiAgentStateAnnotation)
    // 1. SUPERVISOR PLANNER NODE (Uses Lightweight Repo Map & High-Level Scope)
    .addNode('supervisor_plan', async (state) => {
      onEvent?.({
        type: 'supervisor_plan',
        content: `Supervisor is scanning architecture and planning for: "${state.userPrompt}"`,
      });

      // 1. Generate lightweight Repo Map (Outline) to avoid reading full code files
      const repoMap = await generateRepoMap(state.projectPath, 30);

      const rolesList = state.roles.map((r) => `- Role "${r.name}": ${r.description}`).join('\n');
      const plannerPrompt = `You are the Lead Supervisor/Architect for this software project.
You do NOT write raw code; you organize and delegate work to specialist team members.

Workspace Architecture Overview:
"""
${repoMap}
"""

User Goal: "${state.userPrompt}"

Available Team Roles:
${rolesList}

Instructions:
1. Decompose the user goal into a focused, sequential list of sub-tasks assigned to appropriate roles.
2. Ensure each task has concise, clear instructions and specifies target files.
3. Return strictly valid JSON:
{
  "tasks": [
    { "roleName": "Role Name", "title": "Brief title", "instructions": "Specific instructions and target files" }
  ]
}`;

      let rawPlan = await callSupervisor(
        state.supervisorConfig,
        plannerPrompt,
        state.projectPath,
        state.installedAIs
      );

      // Parse JSON from plan
      let tasksList: TaskItem[] = [];
      try {
        const jsonMatch = rawPlan.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawPlan);
        if (Array.isArray(parsed.tasks)) {
          tasksList = parsed.tasks.map((t: any, idx: number) => {
            const role = state.roles.find((r) => r.name.toLowerCase() === (t.roleName || '').toLowerCase()) || state.roles[0];
            return {
              id: `task-${Date.now()}-${idx}`,
              roleId: role?.id || 'default',
              roleName: role?.name || t.roleName || 'Developer',
              title: t.title || `Task ${idx + 1}`,
              instructions: t.instructions || t.title,
              status: 'pending',
            };
          });
        }
      } catch {
        tasksList = state.roles.map((r, idx) => ({
          id: `task-${Date.now()}-${idx}`,
          roleId: r.id,
          roleName: r.name,
          title: `Work on ${state.userPrompt}`,
          instructions: state.userPrompt,
          status: 'pending',
        }));
      }

      onEvent?.({
        type: 'supervisor_plan',
        content: `Supervisor generated a ${tasksList.length}-step execution plan.`,
        data: tasksList,
      });

      return {
        tasks: tasksList,
        currentTaskIndex: 0,
        logs: [`Supervisor initialized plan with ${tasksList.length} sub-tasks`],
      };
    })

    // 2. AGENT PRE-FLIGHT VALIDATION (CHECK AGAINST ROLE RULES)
    .addNode('agent_evaluate_task', async (state) => {
      const task = state.tasks[state.currentTaskIndex];
      if (!task) return {};

      const role = state.roles.find((r) => r.id === task.roleId) || state.roles.find((r) => r.name === task.roleName);
      const assignedAI = state.installedAIs.find((a) => a.id === role?.assignedAgentId) || state.installedAIs[0];

      onEvent?.({
        type: 'agent_evaluating',
        roleId: role?.id,
        roleName: role?.name,
        agentName: assignedAI?.name,
        taskId: task.id,
        content: `Agent "${assignedAI?.name || role?.name}" is evaluating task "${task.title}" against internal Role Rules...`,
      });

      // Prompt agent to check against its own rules independently
      const evalPrompt = `You are operating as role: "${role?.name}".
YOUR INTERNAL RULES & CONTRACT:
"""
${role?.rules || 'Standard clean code, secure coding standards, no hardcoded secrets.'}
"""

SUPERVISOR ASSIGNED THIS TASK:
"""
Title: ${task.title}
Instructions: ${task.instructions}
"""

Check if this task violates your rules or has critical flaws/missing requirements.
Respond with strictly:
APPROVED: <brief confirmation>
or
OBJECTION: <specific issue and proposed correction>`;

      let evalResult = '';
      if (assignedAI) {
        evalResult = await executeAgentCLI(assignedAI, evalPrompt, state.projectPath);
      } else {
        evalResult = 'APPROVED: Task satisfies standard constraints.';
      }

      const hasObjection = evalResult.includes('OBJECTION:');
      const feedback = hasObjection ? evalResult.replace(/.*OBJECTION:/, '').trim() : undefined;

      const updatedTasks = [...state.tasks];
      updatedTasks[state.currentTaskIndex] = {
        ...task,
        status: hasObjection ? 'rejected' : 'in_progress',
        validationFeedback: feedback,
      };

      if (hasObjection) {
        onEvent?.({
          type: 'agent_pushback',
          roleId: role?.id,
          roleName: role?.name,
          agentName: assignedAI?.name,
          taskId: task.id,
          content: `Agent Pushback on Task "${task.title}": ${feedback}`,
        });
      }

      return {
        tasks: updatedTasks,
        negotiationCount: {
          [task.id]: (state.negotiationCount[task.id] || 0) + (hasObjection ? 1 : 0),
        },
      };
    })

    // 3. NEGOTIATION WITH SUPERVISOR IF OBJECTION OCCURRED
    .addNode('supervisor_adjust_task', async (state) => {
      const task = state.tasks[state.currentTaskIndex];
      const negCount = state.negotiationCount[task.id] || 0;

      onEvent?.({
        type: 'supervisor_plan',
        content: `Supervisor is adjusting task "${task.title}" based on feedback: "${task.validationFeedback}" (Round ${negCount})`,
      });

      const adjustPrompt = `An agent objected to the assigned task:
Task: "${task.instructions}"
Objection: "${task.validationFeedback}"

Adjust the task instructions to resolve the agent's concerns while fulfilling the overall goal: "${state.userPrompt}".
Provide the revised instructions clearly.`;

      const adjustedInstructions = await callSupervisor(
        state.supervisorConfig,
        adjustPrompt,
        state.projectPath,
        state.installedAIs
      );

      const updatedTasks = [...state.tasks];
      updatedTasks[state.currentTaskIndex] = {
        ...task,
        instructions: adjustedInstructions,
        status: 'pending',
        validationFeedback: undefined,
      };

      return {
        tasks: updatedTasks,
      };
    })

    // 4. AGENT EXECUTION NODE
    .addNode('agent_execute_task', async (state) => {
      const task = state.tasks[state.currentTaskIndex];
      const role = state.roles.find((r) => r.id === task.roleId) || state.roles.find((r) => r.name === task.roleName);
      const assignedAI = state.installedAIs.find((a) => a.id === role?.assignedAgentId) || state.installedAIs[0];

      onEvent?.({
        type: 'agent_executing',
        roleId: role?.id,
        roleName: role?.name,
        agentName: assignedAI?.name,
        taskId: task.id,
        content: `Agent "${assignedAI?.name || role?.name}" is executing task: ${task.title}...`,
      });

      const execPrompt = `ROLE: ${role?.name}
TARGET TASK: ${task.instructions}
ROLE RULES & CONTRACT:
${role?.rules || 'Standard clean code'}

Instructions:
- Execute the task with deep precision.
- Provide deliverables directly. When editing existing code, prefer returning Unified Diff format or specific function replacements to conserve context.
- End your response with a clear, concise SUMMARY section.`;

      let output = '';
      if (assignedAI) {
        output = await executeAgentCLI(assignedAI, execPrompt, state.projectPath);
      } else {
        output = `Completed task ${task.title} successfully.`;
      }

      // Filter and compress Member's output for Leader to avoid token bloat in supervisor state
      const compressedForLeader = compressMemberOutputForLeader(
        assignedAI?.name || role?.name || 'Member',
        task.title,
        output
      );

      const updatedTasks = [...state.tasks];
      updatedTasks[state.currentTaskIndex] = {
        ...task,
        status: 'completed',
        result: compressedForLeader, // Supervisor state receives compressed summary
      };

      onEvent?.({
        type: 'agent_done',
        roleId: role?.id,
        roleName: role?.name,
        agentName: assignedAI?.name,
        taskId: task.id,
        content: `Agent "${assignedAI?.name || role?.name}" completed "${task.title}".`,
        data: output, // UI receives full deliverables
        taskItem: updatedTasks[state.currentTaskIndex],
      });

      return {
        tasks: updatedTasks,
        currentTaskIndex: state.currentTaskIndex + 1,
      };
    })

    // 5. SUPERVISOR FINAL SUMMARY (Aggregates concise results)
    .addNode('supervisor_finalize', async (state) => {
      onEvent?.({
        type: 'workflow_finished',
        content: `All tasks completed. Supervisor is synthesizing final delivery summary...`,
      });

      const memberOutcomes = state.tasks
        .map((t, idx) => `Task ${idx + 1} (${t.roleName} - ${t.title}):\n${t.result || 'Done'}`)
        .join('\n\n');

      const finalizePrompt = `You are the Lead Supervisor.
The assigned team members have executed their tasks:

${memberOutcomes}

Provide a concise, high-level final summary to the user outlining what was achieved, files modified, and next steps.`;

      let summary = '';
      try {
        summary = await callSupervisor(
          state.supervisorConfig,
          finalizePrompt,
          state.projectPath,
          state.installedAIs
        );
      } catch {
        summary = `Completed all ${state.tasks.length} tasks successfully across ${state.roles.length} roles.`;
      }

      return {
        finalSummary: summary,
      };
    });

  // Routing Edges
  workflow.addEdge(START, 'supervisor_plan');
  workflow.addEdge('supervisor_plan', 'agent_evaluate_task');

  // After evaluation: either pushback adjustment or proceed to execute
  workflow.addConditionalEdges('agent_evaluate_task', (state) => {
    const task = state.tasks[state.currentTaskIndex];
    if (!task) return 'supervisor_finalize';

    if (task.status === 'rejected') {
      const turns = state.negotiationCount[task.id] || 0;
      if (turns < 3) {
        return 'supervisor_adjust_task';
      }
      // If over limit, proceed anyway or stop
      return 'agent_execute_task';
    }

    return 'agent_execute_task';
  });

  workflow.addEdge('supervisor_adjust_task', 'agent_evaluate_task');

  // After execution: check if more tasks remain
  workflow.addConditionalEdges('agent_execute_task', (state) => {
    if (state.currentTaskIndex < state.tasks.length) {
      return 'agent_evaluate_task';
    }
    return 'supervisor_finalize';
  });

  workflow.addEdge('supervisor_finalize', END);

  return workflow.compile();
}
