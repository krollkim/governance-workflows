# Example AI Agent Tasks

## Database Agent Tasks

```bash
# Migration execution
npm run orchestrator "run database migration for user preferences"

# Schema analysis
EXECUTION_MODE=simulate npm run orchestrator "analyze database performance and indexes"

# Data cleanup
EXECUTION_MODE=interactive npm run orchestrator "clean up duplicate records in user table"
```

## Backend Agent Tasks

```bash
# API validation
npm run orchestrator "validate all API endpoints and update OpenAPI spec"

# Security review
npm run orchestrator "review backend security patterns and authentication"

# Performance optimization
EXECUTION_MODE=execute npm run orchestrator "optimize database queries in user service"
```

## Frontend Agent Tasks

```bash
# Component analysis
npm run orchestrator "analyze React components for accessibility issues"

# Performance audit
npm run orchestrator "check bundle size and optimize frontend performance"

# Design system compliance
EXECUTION_MODE=simulate npm run orchestrator "update components to use design tokens"
```

## Infrastructure Agent Tasks

```bash
# Deployment review
npm run orchestrator "review Docker configuration and deployment scripts"

# Security audit
npm run orchestrator "audit infrastructure security and secrets management"

# Monitoring setup
EXECUTION_MODE=interactive npm run orchestrator "set up application monitoring and alerts"
```

## Multi-Agent Tasks

```bash
# Full stack feature
npm run orchestrator "implement user profile feature with database, API, and UI"

# Performance optimization
npm run orchestrator "optimize application performance across all layers"

# Security hardening
EXECUTION_MODE=simulate npm run orchestrator "implement security best practices across the stack"
```

## PR Comment Examples

Add these comments to pull requests to trigger AI agent execution:

```
/execute-agents analyze the impact of these database changes

/execute-agents review frontend accessibility compliance

/execute-agents validate API security and rate limiting

/execute-agents check deployment configuration for production readiness

/execute-agents optimize performance for the new user dashboard
```

## Execution Modes

### Simulate Mode (Default)
- **Safe**: Only analyzes and reports findings
- **No Changes**: Won't modify any files
- **Fast**: Quick analysis and recommendations

```bash
npm run orchestrator "task description"
# or explicitly
EXECUTION_MODE=simulate npm run orchestrator "task description"
```

### Execute Mode
- **Makes Changes**: Actually modifies files and runs commands
- **Automated**: Runs without user intervention
- **Careful**: Use only when you trust the agents

```bash
EXECUTION_MODE=execute npm run orchestrator "run database migration"
```

### Interactive Mode
- **User Approval**: Asks before each action
- **Safe Control**: You approve every change
- **Learning**: Good for understanding what agents do

```bash
EXECUTION_MODE=interactive npm run orchestrator "update frontend components"
```

## Best Practices

### Start with Simulation
Always test with `simulate` mode first to understand what the agents will do.

### Use Descriptive Requests
Be specific about what you want the agents to accomplish:
- ❌ "fix the code"
- ✅ "optimize database queries in the user service for better performance"

### Review Agent Memory
Check the agent documentation files after execution to see what was learned and done:
- `docs/agents/fe.md` - Frontend agent memory
- `docs/agents/be.md` - Backend agent memory  
- `docs/agents/db.md` - Database agent memory
- `docs/agents/ops.md` - Infrastructure agent memory
- `docs/agents/lead.md` - Lead agent orchestration log

### Combine with Governance
Use AI agents after governance validation to implement fixes:
1. PR created → Governance validates and provides feedback
2. Add `execute-agents` label or comment to implement fixes
3. Review changes and iterate