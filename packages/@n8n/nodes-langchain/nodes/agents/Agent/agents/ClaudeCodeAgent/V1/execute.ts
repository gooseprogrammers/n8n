import { NodeOperationError } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
	INodeType,
} from 'n8n-workflow';
import { getPromptInputByType } from '@utils/helpers';

import {
	createSandboxedWorkspace,
	cleanupSandboxedWorkspace,
	filterCommand,
	convertAgentMessageToN8nData,
	auditLog,
	type SandboxConfig,
	type WorkspaceContext,
} from '../common';

/**
 * Main execution function for Claude Code Agent
 */
export async function claudeCodeAgentExecute(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	// Get configuration options
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const systemMessage = (options.systemMessage as string) || '';
	const maxTurns = (options.maxTurns as number) || 10;
	const enableFileAccess = options.enableFileAccess !== false;
	const enableCodeExecution = options.enableCodeExecution !== false;
	const enableBashCommands = options.enableBashCommands === true;
	const allowedCommandsStr = (options.allowedCommands as string) || 'node,python3,npm,pip,git';
	const allowedCommands = allowedCommandsStr.split(',').map((cmd) => cmd.trim());
	const customWorkspacePath = options.workspacePath as string | undefined;
	const timeout = (options.timeout as number) || 300000;
	const returnIntermediateSteps = options.returnIntermediateSteps === true;
	const enableStreaming = options.enableStreaming !== false;

	// Create sandbox configuration
	const sandboxConfig: SandboxConfig = {
		workspacePath: '',
		enableFileAccess,
		enableCodeExecution,
		enableBashCommands,
		allowedCommands,
		timeout,
	};

	// Audit log the agent initialization
	auditLog(this, 'AGENT_INIT', {
		enableFileAccess,
		enableCodeExecution,
		enableBashCommands,
		allowedCommands,
		maxTurns,
	});

	// Create sandboxed workspace
	let workspace: WorkspaceContext | null = null;

	try {
		workspace = await createSandboxedWorkspace(this, customWorkspacePath);
		sandboxConfig.workspacePath = workspace.path;

		// Process each input item
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Get the user prompt
				const prompt = getPromptInputByType({
					ctx: this,
					i: itemIndex,
					inputKey: 'text',
					promptTypeKey: 'promptType',
				});

				if (!prompt) {
					throw new NodeOperationError(
						this.getNode(),
						'No prompt provided for Claude Agent',
						{ itemIndex },
					);
				}

				auditLog(this, 'AGENT_START', {
					itemIndex,
					promptLength: prompt.length,
					workspace: workspace.path,
				});

				// Import Claude Agent SDK dynamically
				let query: any;
				try {
					const sdk = await import('@anthropic-ai/claude-agent-sdk');
					query = sdk.query;
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						'Failed to load Claude Agent SDK. Make sure @anthropic-ai/claude-agent-sdk is installed.',
						{ itemIndex },
					);
				}

				// Get Anthropic API key from credentials
				const credentials = await this.getCredentials('anthropicApi');
				if (!credentials?.apiKey) {
					throw new NodeOperationError(
						this.getNode(),
						'Anthropic API key not found. Please configure Anthropic credentials.',
						{ itemIndex },
					);
				}

				// Prepare the agent prompt with system message and workspace info
				const fullPrompt = `${systemMessage}

You are working in a sandboxed workspace at: ${workspace.path}

Security constraints:
- File access: ${enableFileAccess ? 'ENABLED' : 'DISABLED'}
- Code execution: ${enableCodeExecution ? 'ENABLED' : 'DISABLED'}
- Bash commands: ${enableBashCommands ? `ENABLED (allowed: ${allowedCommands.join(', ')})` : 'DISABLED'}

User request:
${prompt}`;

				// Execute agent with streaming or regular mode
				const agentMessages: INodeExecutionData[] = [];
				let finalResult = '';

				// Set up timeout
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Agent execution timeout')), timeout);
				});

				// Execute the agent query
				const executeAgent = async () => {
					try {
						// Set environment variable for API key
						process.env.ANTHROPIC_API_KEY = credentials.apiKey as string;

						for await (const msg of query({
							prompt: fullPrompt,
							options: {
								maxTurns,
								// TODO: Add more SDK options as needed
								// workingDirectory: workspace.path,
							},
						})) {
							// Convert agent message to n8n format
							const n8nData = convertAgentMessageToN8nData(msg, returnIntermediateSteps);

							if (enableStreaming) {
								// Stream each message as it arrives
								agentMessages.push(n8nData);
							}

							// Capture final result
							if (msg.type === 'result') {
								finalResult = msg.result;
								auditLog(this, 'AGENT_COMPLETE', {
									itemIndex,
									resultLength: finalResult.length,
								});
							}

							// Audit tool usage
							if (msg.type === 'tool_use') {
								auditLog(this, 'TOOL_USE', {
									itemIndex,
									tool: msg.tool,
									toolInput: msg.input,
								});

								// Apply command filtering if it's a bash tool
								if (msg.tool === 'bash' || msg.tool === 'execute_command') {
									const command = msg.input?.command || msg.input?.cmd;
									if (command && typeof command === 'string') {
										const filteredCommand = filterCommand(command, sandboxConfig);
										if (!filteredCommand) {
											this.logger.warn('Blocked dangerous command', {
												command,
												itemIndex,
											});
											throw new NodeOperationError(
												this.getNode(),
												`Command blocked by security filters: ${command}`,
												{ itemIndex },
											);
										}
									}
								}
							}
						}
					} finally {
						// Clear API key from environment
						delete process.env.ANTHROPIC_API_KEY;
					}
				};

				// Run with timeout
				await Promise.race([executeAgent(), timeoutPromise]);

				// Return results based on streaming mode
				if (enableStreaming && returnIntermediateSteps) {
					returnData.push(...agentMessages);
				} else {
					returnData.push({
						json: {
							output: finalResult,
							workspace: workspace.path,
						},
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
							itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}
	} finally {
		// Cleanup workspace
		if (workspace) {
			await cleanupSandboxedWorkspace(this, workspace);
		}
	}

	return [returnData];
}
