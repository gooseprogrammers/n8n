# Claude Code Agent

## Overview

The Claude Code Agent is a powerful AI agent implementation that leverages Anthropic's Claude Agent SDK to provide autonomous capabilities within n8n workflows. Unlike traditional LangChain-based agents, this agent can execute code, manipulate files, and run commands in a secure sandboxed environment.

## Features

### Core Capabilities
- **File System Operations**: Read, write, and manipulate files within a sandboxed workspace
- **Code Execution**: Execute Node.js and Python code directly
- **Bash Commands**: Run approved shell commands (with security restrictions)
- **Autonomous Problem Solving**: Uses Claude's advanced reasoning to solve complex tasks
- **Real-time Streaming**: Stream responses as they're generated
- **Audit Logging**: Comprehensive security logging of all agent actions

### Security Features
- **Sandboxed Workspace**: All operations confined to a temporary workspace directory
- **Command Filtering**: Dangerous commands are blocked automatically
- **Path Validation**: Prevents directory traversal attacks
- **Command Whitelist**: Only approved commands can be executed
- **Resource Limits**: Configurable timeouts and execution limits
- **Audit Trail**: Every agent action is logged for security monitoring

## Architecture

### Components

```
ClaudeCodeAgent/
├── V1/
│   ├── execute.ts        # Main execution logic and SDK integration
│   └── description.ts    # Node UI configuration
├── common.ts             # Sandbox infrastructure and security utilities
├── options.ts            # Configuration options and parameters
├── prompt.ts             # System prompts and instructions
└── README.md            # This file
```

### Execution Flow

```
User Input
    ↓
Create Sandboxed Workspace
    ↓
Initialize Claude Agent SDK
    ↓
Execute Agent with Security Constraints
    ↓
Process Agent Messages & Tool Calls
    ↓
Apply Command Filtering
    ↓
Stream Results (if enabled)
    ↓
Cleanup Workspace
    ↓
Return Output
```

## Configuration Options

### Required
- **Anthropic API Key**: Configured via n8n credentials

### Agent Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| System Message | string | (see prompt.ts) | Instructions sent to the agent |
| Max Turns | number | 10 | Maximum conversation turns |
| Enable File Access | boolean | true | Allow file read/write operations |
| Enable Code Execution | boolean | true | Allow code execution |
| Enable Bash Commands | boolean | false | Allow shell commands (DANGEROUS) |
| Allowed Commands | string | node,python3,npm,pip,git | Whitelist of allowed commands |
| Workspace Path | string | (auto-generated) | Custom workspace directory |
| Timeout (ms) | number | 300000 | Maximum execution time |
| Return Intermediate Steps | boolean | false | Include tool call details in output |
| Enable Streaming | boolean | true | Stream responses in real-time |

## Usage Examples

### Example 1: File Processing
```
Input: "Read the data.csv file and calculate the average of the 'sales' column"

The agent will:
1. Read the file from the workspace
2. Parse the CSV data
3. Calculate the average
4. Return the result
```

### Example 2: Code Generation and Execution
```
Input: "Create a Python script that generates a report from the sales data and save it as report.pdf"

The agent will:
1. Generate Python code for data processing
2. Execute the code
3. Verify the output
4. Return success status
```

### Example 3: Data Transformation
```
Input: "Convert all JSON files in the workspace to CSV format"

The agent will:
1. Find all JSON files
2. Parse each file
3. Convert to CSV
4. Save new CSV files
5. Report completion
```

## Security Considerations

### ⚠️ Important Security Warnings

1. **Only use with trusted inputs**: The agent can execute arbitrary code
2. **Enable bash commands cautiously**: This grants significant system access
3. **Review audit logs**: Monitor agent actions in production
4. **Restrict workspace paths**: Keep agents isolated to safe directories
5. **Use allowlists**: Limit allowed commands to minimum necessary

### Blocked Dangerous Patterns

The agent automatically blocks:
- `rm -rf /` - Recursive deletion of root
- `sudo` commands - Privilege escalation
- `chmod 777` - Dangerous permissions
- `curl | sh` - Remote code execution
- Disk device access - Hardware manipulation
- Fork bombs - Resource exhaustion

### Sandbox Restrictions

- Operations confined to workspace directory
- No access to sensitive system directories (/etc, /root, /sys, /proc, /dev, /boot)
- Environment variables sanitized
- Network access can be disabled
- Resource limits enforced

## Integration with n8n

### Adding to Workflows

1. Add an "AI Agent" node to your workflow
2. Select "Claude Code Agent" from the Agent dropdown
3. Configure Anthropic API credentials
4. Set security options appropriately
5. Provide input via the text parameter

### Credentials Setup

1. Go to Credentials in n8n
2. Create new "Anthropic API" credential
3. Enter your Anthropic API key from https://console.anthropic.com/
4. Save and select in the agent node

### Output Structure

**Regular Mode:**
```json
{
  "output": "Agent's final response",
  "workspace": "/path/to/workspace"
}
```

**Streaming Mode with Intermediate Steps:**
```json
[
  {
    "type": "text",
    "text": "Agent's thinking..."
  },
  {
    "type": "tool_use",
    "tool": "execute_code",
    "toolInput": { "code": "print('hello')" },
    "toolCallId": "call_123"
  },
  {
    "type": "result",
    "output": "Final result"
  }
]
```

## Differences from Other Agents

### vs Tools Agent
- **Tools Agent**: Uses LangChain with predefined n8n tool nodes
- **Claude Code Agent**: Uses Anthropic SDK with built-in tools
- **Tools Agent**: Limited to connected tool nodes
- **Claude Code Agent**: Can execute arbitrary code and commands
- **Tools Agent**: Safer, more restricted
- **Claude Code Agent**: More powerful, higher risk

### vs Conversational Agent
- **Conversational Agent**: Best for chat interactions
- **Claude Code Agent**: Best for autonomous task execution
- **Conversational Agent**: No code execution
- **Claude Code Agent**: Full code execution capabilities

## Best Practices

### 1. Start with Restrictions
```javascript
{
  enableFileAccess: true,
  enableCodeExecution: true,
  enableBashCommands: false  // Start disabled
}
```

### 2. Use Custom Workspace
```javascript
{
  workspacePath: "/safe/isolated/directory"
}
```

### 3. Set Appropriate Timeouts
```javascript
{
  timeout: 60000  // 1 minute for quick tasks
  // or
  timeout: 600000  // 10 minutes for complex tasks
}
```

### 4. Enable Audit Logging
Monitor logs for:
- `[AUDIT] Claude Agent: AGENT_INIT`
- `[AUDIT] Claude Agent: AGENT_START`
- `[AUDIT] Claude Agent: TOOL_USE`
- `[AUDIT] Claude Agent: AGENT_COMPLETE`

### 5. Review Intermediate Steps
Enable `returnIntermediateSteps` during development to understand agent behavior.

## Troubleshooting

### Issue: Agent times out
**Solution**: Increase timeout value or simplify the task

### Issue: "Command blocked by security filters"
**Solution**: Add command to allowedCommands list (if safe)

### Issue: "Failed to load Claude Agent SDK"
**Solution**: Ensure @anthropic-ai/claude-agent-sdk is installed:
```bash
pnpm add @anthropic-ai/claude-agent-sdk
```

### Issue: "Anthropic API key not found"
**Solution**: Configure Anthropic API credentials in n8n

### Issue: File not found in workspace
**Solution**: Files must be in the agent's workspace directory

## Performance Considerations

- **Cold start**: First execution may be slower due to SDK initialization
- **Streaming**: Slightly higher overhead but better UX
- **File operations**: Large files may impact performance
- **Code execution**: CPU-intensive tasks will consume resources

## Future Enhancements

Potential improvements:
- [ ] Docker container isolation per execution
- [ ] MCP (Model Context Protocol) integration
- [ ] Custom tool definitions
- [ ] Persistent workspace option
- [ ] Multi-agent collaboration
- [ ] Enhanced error recovery
- [ ] WebAssembly sandbox option

## Dependencies

- `@anthropic-ai/claude-agent-sdk`: ^0.1.27
- `n8n-workflow`: workspace:*
- Node.js built-in modules: `fs/promises`, `os`, `path`, `crypto`

## License

Same as n8n (see main repository)

## Support

For issues and questions:
1. Check n8n documentation
2. Review Anthropic SDK docs: https://docs.claude.com/en/api/agent-sdk
3. File GitHub issues in the n8n repository

## Contributing

Contributions welcome! Please:
1. Follow n8n coding standards
2. Add tests for new features
3. Update documentation
4. Consider security implications

---

**Created**: 2025-10-27
**Version**: 1.0.0
**Author**: n8n Community
**SDK Version**: @anthropic-ai/claude-agent-sdk@^0.1.27
