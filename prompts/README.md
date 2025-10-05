# AI Prompt Templates for Governance Workflows

This directory contains structured AI prompt templates for each specialist agent in the governance workflow system. These prompts transform your existing agent documentation into actionable LLM instructions.

## Overview

The prompt system bridges the gap between your existing agent documentation (`docs/agents/*.md`) and actual AI integration by providing:

- **Structured Templates**: Consistent prompt format across all agents
- **Context Injection**: Dynamic project context and agent memory integration  
- **Output Standardization**: JSON response format matching `TaskResult` interface
- **Safety Guidelines**: Built-in safety checks and validation requirements

## Prompt Templates

### Core Specialist Agents

| Agent | Template | Memory File | Expertise |
|-------|----------|-------------|-----------|
| **Backend Expert** | `backend-expert.md` | `docs/agents/be.md` | API design, security, performance |
| **Frontend Expert** | `frontend-expert.md` | `docs/agents/fe.md` | UI/UX, accessibility, design systems |
| **Database Expert** | `database-expert.md` | `docs/agents/db.md` | Schema design, migrations, optimization |
| **Infrastructure Expert** | `infrastructure-expert.md` | `docs/agents/ops.md` | Docker, CI/CD, deployment, monitoring |
| **Test Expert** | `test-expert.md` | `docs/agents/test.md` | Testing strategy, coverage, automation |

### Template Structure

Each prompt template includes:

```markdown
# [Agent Name] AI Prompt Template

## Your Expertise
- Domain-specific knowledge areas
- Technologies and frameworks
- Best practices and patterns

## Task Context
{{USER_REQUEST}} - The original user request
{{TASK_DESCRIPTION}} - Specific task for this agent
{{EXECUTION_MODE}} - simulate|execute|interactive
{{TARGET_FILES}} - Files to analyze or modify

## Recent Memory Context
{{AGENT_MEMORY}} - Recent agent execution history

## Project Context
{{PROJECT_STRUCTURE}} - Detected project structure
{{AGENT_SPECIFIC_CONTEXT}} - Agent-specific project details

## Analysis Instructions
- Specific analysis steps for this agent type
- Security, performance, and quality considerations
- Domain-specific validation requirements

## Output Format
```json
{
  "action": "Brief description",
  "details": "Detailed explanation", 
  "executed": boolean,
  "files_checked": ["array"],
  "files_changed": ["array"],
  "recommendations": ["array"],
  "next_step": "string or null",
  // Agent-specific fields
}
```
```

## Usage

### 1. Manual Testing (Immediate)

Copy any template, replace `{{VARIABLES}}` with actual values, and test with Claude directly:

```bash
# Example: Test Backend Expert prompt
cat prompts/backend-expert.md | \
  sed 's/{{USER_REQUEST}}/Add user authentication API/g' | \
  sed 's/{{EXECUTION_MODE}}/simulate/g' | \
  # ... replace other variables
```

### 2. Programmatic Usage (Next Phase)

```typescript
import PromptManager from './prompt-manager';

const promptManager = new PromptManager('/path/to/project');

const prompt = await promptManager.generatePrompt('be', {
  USER_REQUEST: 'Add user authentication API',
  TASK_DESCRIPTION: 'Implement JWT-based authentication',
  EXECUTION_MODE: 'simulate',
  TARGET_FILES: ['src/auth/', 'src/controllers/']
});

// Send prompt to LLM API
const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  messages: [{ role: 'user', content: prompt }]
});
```

## Context Injection

The `PromptManager` automatically extracts project-specific context:

### Universal Context
- `PROJECT_STRUCTURE`: Package.json analysis
- `AGENT_MEMORY`: Recent agent execution history
- `TARGET_FILES`: Files to analyze

### Agent-Specific Context

**Backend Expert**:
- `BACKEND_DIRS`: Detected backend directories
- `PACKAGE_SCRIPTS`: Relevant npm scripts

**Frontend Expert**:
- `FRONTEND_FRAMEWORK`: React, Vue, etc.
- `DESIGN_TOKENS_PATH`: Design system location
- `COMPONENT_DIRS`: Component directories

**Database Expert**:
- `DATABASE_TYPE`: PostgreSQL, MongoDB, etc.
- `MIGRATION_DIRS`: Migration directories
- `SCHEMA_FILES`: Schema definition files

**Infrastructure Expert**:
- `DOCKER_FILES`: Docker configuration files
- `WORKFLOW_FILES`: GitHub Actions workflows
- `INFRA_FILES`: Infrastructure configurations

**Test Expert**:
- `TEST_FRAMEWORK`: Jest, Vitest, etc.
- `TEST_DIRS`: Test directories
- `COVERAGE_PATH`: Coverage report locations

## Integration Roadmap

### Phase 1: Manual Testing ✅
- Draft all prompt templates
- Test manually with Claude
- Refine output format and instructions

### Phase 2: Basic LLM Integration
- Add Anthropic SDK to orchestrator
- Replace hardcoded agent methods with LLM calls
- Implement prompt template loading

### Phase 3: Context Enhancement
- Complete PromptManager integration
- Add memory context injection
- Implement project structure detection

### Phase 4: Advanced Features
- Add streaming responses for interactive mode
- Implement prompt versioning and A/B testing
- Add agent performance metrics and optimization

## Expected Output Format

All agents return structured JSON matching the `TaskResult` interface:

```typescript
interface TaskResult {
  action: string;              // Brief description of action
  details: string;             // Detailed explanation
  executed: boolean;           // Whether changes were made
  files_checked?: string[];    // Files analyzed
  files_changed?: string[];    // Files modified
  recommendations?: string[];  // Improvement suggestions
  next_step?: string;          // Suggested next action
  output?: string;             // Command output if executed
  
  // Agent-specific fields
  security_issues?: string[];  // Backend/Infrastructure
  performance_impact?: string; // All agents
  api_changes?: string;        // Backend
  accessibility_issues?: string[]; // Frontend
  migration_safety?: string;   // Database
  test_results?: TestResults;  // Test Expert
}
```

## Safety Features

### Built-in Validation
- Required checklist verification before responses
- Security guidelines for each agent type
- Safety defaults (simulate mode, no destructive operations)

### Memory Integration
- Recent execution history provides context continuity
- Learns from previous mistakes and successes
- Maintains agent specialization over time

### Error Handling
- Graceful fallbacks for missing project context
- Clear error messages for invalid configurations
- Safe defaults when context extraction fails

## Next Steps

1. **Test Templates**: Copy templates and test manually with Claude
2. **Refine Prompts**: Adjust based on actual LLM responses
3. **Implement Integration**: Add to `tools/orchestrator.ts`
4. **Validate Output**: Ensure JSON matches `TaskResult` interface
5. **Add Memory Context**: Integrate with existing agent memory system

This prompt system is designed to seamlessly integrate with your existing orchestrator infrastructure while providing the AI capabilities that transform your governance workflows from simulation to actual intelligent automation.