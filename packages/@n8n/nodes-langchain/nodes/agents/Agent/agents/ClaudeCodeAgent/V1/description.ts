import type { INodeProperties } from 'n8n-workflow';

import { claudeCodeAgentProperties } from '../options';

export const description: INodeProperties[] = [
	{
		displayName:
			'<strong>⚠️ Security Warning</strong>: This agent can execute code and commands. Only use with trusted inputs and enable appropriate restrictions.',
		name: 'securityWarning',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'Claude Code Agent uses Anthropic\'s Claude Agent SDK to provide autonomous capabilities including file operations, code execution, and command running within a sandboxed environment.',
		name: 'claudeCodeAgentInfo',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'Requires an Anthropic API key configured in your credentials. <a href="https://console.anthropic.com/" target="_blank">Get API key</a>',
		name: 'apiKeyNotice',
		type: 'notice',
		default: '',
	},
	claudeCodeAgentProperties,
];
