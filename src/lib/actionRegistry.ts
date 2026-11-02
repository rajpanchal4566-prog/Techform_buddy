/**
 * Action Registry Module
 *
 * Provides a typed action registry where the application and individual pages
 * register actions with name, description, typed parameters, confirmation rules,
 * reversible undo handlers, and execution logic.
 */

'use client';

import { useEffect } from 'react';

export type ParameterType = 'string' | 'number' | 'boolean' | 'array';

export interface ActionParameterDef {
  type: ParameterType;
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  undo?: () => Promise<void> | void;
  data?: any;
}

export interface ActionDefinition<TParams = Record<string, any>> {
  name: string;
  description: string;
  parameters: Record<string, ActionParameterDef>;
  isReadOnly?: boolean; // Read-only actions (navigate, explain, read_aloud) run immediately without confirmation
  isReversible?: boolean; // If true, supports undo
  confirmationPrompt?: (params: TParams, lang?: string) => string;
  handler: (
    params: TParams,
    context?: any
  ) => Promise<ActionExecutionResult | void> | ActionExecutionResult | void;
}

export interface ActionLogEntry {
  id: string;
  actionName: string;
  params: Record<string, any>;
  description: string;
  timestamp: number;
  status: 'success' | 'failed';
  feedback: string;
  isReversible: boolean;
  undone?: boolean;
  undo?: () => Promise<void> | void;
}

/**
 * Validate incoming action parameters against the action's typed schema
 */
export function validateActionParams(
  action: ActionDefinition,
  params: Record<string, any>
): { valid: boolean; error?: string } {
  if (!params || typeof params !== 'object') {
    const hasRequired = Object.entries(action.parameters || {}).some(
      ([_, def]) => def.required
    );
    if (hasRequired) {
      return {
        valid: false,
        error: `Action "${action.name}" requires parameters object.`,
      };
    }
    return { valid: true };
  }

  for (const [key, def] of Object.entries(action.parameters || {})) {
    const val = params[key];

    // Check required field
    if (val === undefined || val === null || val === '') {
      if (def.required) {
        return {
          valid: false,
          error: `Missing required parameter "${key}" for action "${action.name}".`,
        };
      }
      continue;
    }

    // Check string type
    if (def.type === 'string' && typeof val !== 'string') {
      return {
        valid: false,
        error: `Parameter "${key}" must be a string, received ${typeof val}.`,
      };
    }

    // Check number type
    if (def.type === 'number') {
      const num = Number(val);
      if (isNaN(num)) {
        return {
          valid: false,
          error: `Parameter "${key}" must be a valid number.`,
        };
      }
    }

    // Check boolean type
    if (def.type === 'boolean' && typeof val !== 'boolean') {
      return {
        valid: false,
        error: `Parameter "${key}" must be a boolean.`,
      };
    }

    // Check array type
    if (def.type === 'array' && !Array.isArray(val)) {
      return {
        valid: false,
        error: `Parameter "${key}" must be an array.`,
      };
    }

    // Check enum
    if (def.enum && def.enum.length > 0 && !def.enum.includes(String(val))) {
      return {
        valid: false,
        error: `Invalid value "${val}" for parameter "${key}". Allowed values: ${def.enum.join(', ')}.`,
      };
    }
  }

  return { valid: true };
}

class ActionRegistryManager {
  private actions = new Map<string, ActionDefinition>();
  private listeners = new Set<() => void>();
  private actionLog: ActionLogEntry[] = [];
  private logListeners = new Set<(log: ActionLogEntry[]) => void>();

  /**
   * Register an action with the registry. Returns an unregister function.
   */
  register(action: ActionDefinition): () => void {
    this.actions.set(action.name, action);
    this.notifyListeners();
    return () => this.unregister(action.name);
  }

  /**
   * Unregister an action by name.
   */
  unregister(name: string): void {
    if (this.actions.has(name)) {
      this.actions.delete(name);
      this.notifyListeners();
    }
  }

  /**
   * Retrieve an action definition by name.
   */
  get(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }

  /**
   * Retrieve all currently registered actions.
   */
  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  /**
   * Returns metadata list of available actions (names, descriptions, parameters) for AI consumption.
   */
  getAvailableActionsForAI(): Array<{
    name: string;
    description: string;
    parameters: Record<string, ActionParameterDef>;
    isReadOnly: boolean;
  }> {
    return Array.from(this.actions.values()).map((action) => ({
      name: action.name,
      description: action.description,
      parameters: action.parameters,
      isReadOnly: Boolean(action.isReadOnly),
    }));
  }

  /**
   * Execute an action with validation, logging, and feedback.
   */
  async executeAction(
    name: string,
    params: Record<string, any> = {},
    context?: any
  ): Promise<ActionExecutionResult> {
    const action = this.actions.get(name);
    if (!action) {
      const errResult: ActionExecutionResult = {
        success: false,
        message: `Action "${name}" is not registered on this page.`,
      };
      this.recordLog(name, params, 'failed', errResult.message, false);
      return errResult;
    }

    // Validate parameters against typed schema
    const validation = validateActionParams(action, params);
    if (!validation.valid) {
      const errResult: ActionExecutionResult = {
        success: false,
        message: validation.error || `Invalid parameters for action "${name}".`,
      };
      this.recordLog(name, params, 'failed', errResult.message, false);
      return errResult;
    }

    try {
      const result = await action.handler(params, context);
      const executionResult: ActionExecutionResult = {
        success: result?.success !== false,
        message: result?.message || `Successfully executed ${action.name}`,
        undo: result?.undo,
        data: result?.data,
      };

      this.recordLog(
        name,
        params,
        executionResult.success ? 'success' : 'failed',
        executionResult.message,
        Boolean(action.isReversible && executionResult.undo),
        executionResult.undo
      );

      return executionResult;
    } catch (err: any) {
      const failMsg = `Failed executing "${name}": ${err?.message || 'Unknown error'}`;
      this.recordLog(name, params, 'failed', failMsg, false);
      return {
        success: false,
        message: failMsg,
      };
    }
  }

  /**
   * Undo a previous reversible action.
   */
  async undoAction(logId: string): Promise<{ success: boolean; message: string }> {
    const entry = this.actionLog.find((item) => item.id === logId);
    if (!entry) {
      return { success: false, message: 'Action record not found.' };
    }
    if (!entry.isReversible || !entry.undo || entry.undone) {
      return { success: false, message: 'Action cannot be undone or was already undone.' };
    }

    try {
      await entry.undo();
      entry.undone = true;
      this.notifyLogListeners();
      return { success: true, message: `Undid "${entry.actionName}" successfully.` };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to undo "${entry.actionName}": ${err?.message || 'Error'}`,
      };
    }
  }

  /**
   * Action log management
   */
  getActionLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  clearActionLog(): void {
    this.actionLog = [];
    this.notifyLogListeners();
  }

  logAction(
    actionName: string,
    params: Record<string, any>,
    feedback: string,
    status: 'success' | 'failed' = 'success',
    isReversible: boolean = false,
    undo?: () => Promise<void> | void
  ): ActionLogEntry {
    this.recordLog(actionName, params, status, feedback, isReversible, undo);
    return this.actionLog[0];
  }

  private recordLog(
    actionName: string,
    params: Record<string, any>,
    status: 'success' | 'failed',
    feedback: string,
    isReversible: boolean,
    undo?: () => Promise<void> | void
  ) {
    const entry: ActionLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actionName,
      params,
      description: this.actions.get(actionName)?.description || actionName,
      timestamp: Date.now(),
      status,
      feedback,
      isReversible,
      undone: false,
      undo,
    };

    this.actionLog.unshift(entry);
    // Keep last 30 action logs
    if (this.actionLog.length > 30) {
      this.actionLog.pop();
    }
    this.notifyLogListeners();
  }

  /**
   * Event listeners
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeLog(listener: (log: ActionLogEntry[]) => void): () => void {
    this.logListeners.add(listener);
    listener([...this.actionLog]);
    return () => this.logListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }

  private notifyLogListeners(): void {
    const copy = [...this.actionLog];
    this.logListeners.forEach((listener) => {
      try {
        listener(copy);
      } catch {}
    });
  }
}

// Global action registry singleton
export const actionRegistry = new ActionRegistryManager();

/**
 * React hook to register actions on component mount and automatically unregister on unmount.
 */
export function useRegisterActions(
  actions: ActionDefinition[],
  deps: any[] = []
): void {
  useEffect(() => {
    const unregisters = actions.map((act) => actionRegistry.register(act));
    return () => {
      unregisters.forEach((unreg) => unreg());
    };
  }, deps);
}

