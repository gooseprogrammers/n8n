import type { INodeProperties } from 'n8n-workflow';

import { SYSTEM_MESSAGE } from './prompt';

export const claudeCodeAgentOptions: INodeProperties[] = [
	{
		displayName: 'System Message',
		name: 'systemMessage',
		type: 'string',
		default: SYSTEM_MESSAGE,
		description: 'The message that will be sent to the agent before the conversation starts',
		typeOptions: {
			rows: 6,
		},
	},
	{
		displayName: 'Max Turns',
		name: 'maxTurns',
		type: 'number',
		default: 10,
		description: 'The maximum number of conversation turns the agent will take before stopping',
	},
	{
		displayName: 'Enable File Access',
		name: 'enableFileAccess',
		type: 'boolean',
		default: true,
		description:
			'Whether to allow the agent to read and write files within the sandboxed workspace',
	},
	{
		displayName: 'Enable Code Execution',
		name: 'enableCodeExecution',
		type: 'boolean',
		default: true,
		description: 'Whether to allow the agent to execute code (Node.js, Python) in the sandbox',
	},
	{
		displayName: 'Enable Bash Commands',
		name: 'enableBashCommands',
		type: 'boolean',
		default: false,
		description:
			'Whether to allow the agent to run bash commands. WARNING: Only enable this if you trust the input and understand the security implications.',
	},
	{
		displayName: 'Allowed Commands',
		name: 'allowedCommands',
		type: 'string',
		default: 'node,python3,npm,pip,git',
		description:
			'Comma-separated list of allowed bash commands (only applies if bash commands are enabled)',
		displayOptions: {
			show: {
				enableBashCommands: [true],
			},
		},
	},
	{
		displayName: 'Workspace Path',
		name: 'workspacePath',
		type: 'string',
		default: '',
		placeholder: '/tmp/n8n-agent-workspace',
		description:
			'Custom workspace directory path. Leave empty to use a secure temporary directory for this workflow.',
	},
	{
		displayName: 'Timeout (ms)',
		name: 'timeout',
		type: 'number',
		default: 300000,
		description: 'Maximum execution time in milliseconds (default: 5 minutes)',
	},
	{
		displayName: 'Return Intermediate Steps',
		name: 'returnIntermediateSteps',
		type: 'boolean',
		default: false,
		description:
			'Whether to return intermediate steps showing what actions the agent took',
	},
	{
		displayName: 'Enable Streaming',
		name: 'enableStreaming',
		type: 'boolean',
		default: true,
		description: 'Whether to stream the response in real-time as the agent generates output',
	},
];

export const claudeCodeAgentProperties: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	displayOptions: {
		show: {
			agent: ['claudeCodeAgent'],
		},
	},
	default: {},
	placeholder: 'Add Option',
	options: claudeCodeAgentOptions,
};
