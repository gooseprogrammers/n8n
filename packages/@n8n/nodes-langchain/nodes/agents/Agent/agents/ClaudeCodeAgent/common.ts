import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { randomBytes } from 'node:crypto';
import { NodeOperationError } from 'n8n-workflow';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Security configuration for the Claude Agent sandbox
 */
export interface SandboxConfig {
	workspacePath: string;
	enableFileAccess: boolean;
	enableCodeExecution: boolean;
	enableBashCommands: boolean;
	allowedCommands: string[];
	timeout: number;
}

/**
 * Workspace context for isolated agent execution
 */
export interface WorkspaceContext {
	path: string;
	workflowId: string;
	executionId: string;
	created: Date;
}

/**
 * Creates a sandboxed workspace directory for agent execution
 */
export async function createSandboxedWorkspace(
	context: IExecuteFunctions,
	customPath?: string,
): Promise<WorkspaceContext> {
	const workflowId = context.getWorkflow().id ?? 'unknown';
	const executionId = context.getExecutionId();
	const randomId = randomBytes(8).toString('hex');

	let workspacePath: string;

	if (customPath) {
		// Validate custom path - must be absolute and not in sensitive locations
		if (!customPath.startsWith('/')) {
			throw new NodeOperationError(
				context.getNode(),
				'Workspace path must be an absolute path',
			);
		}

		// Block sensitive directories
		const deniedPaths = ['/etc', '/root', '/sys', '/proc', '/dev', '/boot'];
		if (deniedPaths.some((denied) => customPath.startsWith(denied))) {
			throw new NodeOperationError(
				context.getNode(),
				`Workspace path cannot be in sensitive system directories: ${deniedPaths.join(', ')}`,
			);
		}

		workspacePath = resolve(customPath, `claude-agent-${randomId}`);
	} else {
		// Use secure temporary directory
		workspacePath = join(tmpdir(), 'n8n-claude-agent', workflowId, randomId);
	}

	// Create the workspace directory
	await mkdir(workspacePath, { recursive: true });

	context.logger.info('Created sandboxed workspace', {
		workspacePath,
		workflowId,
		executionId,
	});

	return {
		path: workspacePath,
		workflowId,
		executionId,
		created: new Date(),
	};
}

/**
 * Cleans up the sandboxed workspace after execution
 */
export async function cleanupSandboxedWorkspace(
	context: IExecuteFunctions,
	workspace: WorkspaceContext,
): Promise<void> {
	try {
		await rm(workspace.path, { recursive: true, force: true });
		context.logger.info('Cleaned up sandboxed workspace', {
			workspacePath: workspace.path,
		});
	} catch (error) {
		context.logger.warn('Failed to cleanup workspace', {
			workspacePath: workspace.path,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Validates that a file path is within the allowed workspace
 */
export function validatePath(filePath: string, workspacePath: string): boolean {
	const resolvedPath = resolve(filePath);
	const resolvedWorkspace = resolve(workspacePath);

	// Check if the path is within the workspace
	const relativePath = relative(resolvedWorkspace, resolvedPath);

	// If relative path starts with '..' it's trying to escape the workspace
	return !relativePath.startsWith('..') && !filePath.startsWith('/');
}

/**
 * Checks if a command is allowed based on the whitelist
 */
export function isCommandAllowed(command: string, allowedCommands: string[]): boolean {
	// Extract the base command (first word)
	const baseCommand = command.trim().split(/\s+/)[0];

	// Check against whitelist
	return allowedCommands.includes(baseCommand);
}

/**
 * Filters and validates bash commands for security
 */
export function filterCommand(command: string, config: SandboxConfig): string | null {
	// If bash commands are disabled, return null
	if (!config.enableBashCommands) {
		return null;
	}

	// Remove dangerous patterns
	const dangerousPatterns = [
		/rm\s+-rf\s+\//gi, // rm -rf /
		/sudo/gi, // sudo commands
		/chmod\s+777/gi, // chmod 777
		/curl.*\|.*sh/gi, // curl | sh
		/wget.*\|.*sh/gi, // wget | sh
		/>\s*\/dev\/sda/gi, // writing to disk devices
		/mkfs/gi, // filesystem creation
		/dd\s+if=/gi, // dd command
		/:(){ :|:& };:/gi, // fork bomb
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(command)) {
			return null; // Reject dangerous command
		}
	}

	// Check if command is in allowed list
	if (!isCommandAllowed(command, config.allowedCommands)) {
		return null;
	}

	return command;
}

/**
 * Converts Claude Agent SDK message to n8n execution data
 */
export function convertAgentMessageToN8nData(
	message: any,
	returnIntermediateSteps: boolean,
): INodeExecutionData {
	const data: INodeExecutionData = {
		json: {
			type: message.type,
		},
	};

	switch (message.type) {
		case 'text':
			data.json.text = message.text;
			break;
		case 'tool_use':
			if (returnIntermediateSteps) {
				data.json.tool = message.tool;
				data.json.toolInput = message.input;
				data.json.toolCallId = message.id;
			}
			break;
		case 'tool_result':
			if (returnIntermediateSteps) {
				data.json.toolCallId = message.tool_use_id;
				data.json.toolResult = message.content;
			}
			break;
		case 'result':
			data.json.output = message.result;
			break;
		default:
			data.json.message = message;
	}

	return data;
}

/**
 * Creates a sanitized environment for command execution
 */
export function createSandboxedEnvironment(workspace: WorkspaceContext): NodeJS.ProcessEnv {
	return {
		HOME: workspace.path,
		PATH: '/usr/local/bin:/usr/bin:/bin',
		WORKSPACE: workspace.path,
		// Clear potentially dangerous env vars
		SHELL: '/bin/sh',
		USER: 'n8n-agent',
	};
}

/**
 * Audit logs an agent action for security monitoring
 */
export function auditLog(
	context: IExecuteFunctions,
	action: string,
	details: Record<string, unknown>,
): void {
	context.logger.info(`[AUDIT] Claude Agent: ${action}`, {
		workflowId: context.getWorkflow().id,
		executionId: context.getExecutionId(),
		node: context.getNode().name,
		timestamp: new Date().toISOString(),
		...details,
	});
}
