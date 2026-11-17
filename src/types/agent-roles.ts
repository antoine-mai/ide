/**
 * Types for Multi-Agent Roles, Rules, and Supervisor Configuration
 */

export interface AgentRole {
  id: string;
  name: string; // e.g. "Lead Developer", "Code Reviewer", "QA & Security Tester"
  description: string;
  rules: string; // Internal script/rules for this role (e.g. "Refuse unsafe queries, verify Zod schema, enforce unit tests")
  assignedAgentId?: string; // ID of the InstalledAI mapped to this role
}

export type SupervisorType = 'agent' | 'api';

export interface SupervisorConfig {
  type: SupervisorType;
  // If type === 'agent': Use one of the registered CLI agents
  selectedAgentId?: string;
  // If type === 'api': Direct API calling
  apiProvider?: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey?: string;
  apiEndpoint?: string;
  modelName?: string;
  systemPrompt?: string;
}

export interface TaskItem {
  id: string;
  roleId: string;
  roleName: string;
  title: string;
  instructions: string;
  status: 'pending' | 'evaluating' | 'rejected' | 'in_progress' | 'completed';
  validationFeedback?: string; // Pushback/objection from Agent if rules are violated
  result?: string;
}
