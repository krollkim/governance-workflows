#!/usr/bin/env node
/**
 * Runtime Agent Orchestrator
 * Lead agent (Claude) delegates tasks to specialists and coordinates execution
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

// ANSI color codes for terminal output
const colors = {
  blue: '\x1b[34m',
  yellow: '\x1b[33m', 
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

interface TaskResult {
  action: string;
  details: string;
  next_step?: string;
  executed?: boolean;
  output?: string;
  standard_format_present?: boolean;
  recommendations?: string[];
  files_checked?: string[];
  status?: string;
}

interface AgentTask {
  id: string;
  description: string;
  agent: string;
  files: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: TaskResult;
  error?: string;
}

interface OrchestratorSession {
  sessionId: string;
  userRequest: string;
  tasks: AgentTask[];
  status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed' | 'cancelled';
  plan: string;
  results: TaskResult[];
}

interface AgentsConfig {
  active_pattern: string;
  routing?: {
    heuristics: Array<{
      if: string;
      to: string;
    }>;
  };
  agents?: Record<string, {
    name?: string;
    domains?: string[];
    rules?: string[];
  }>;
}

class RuntimeOrchestrator {
  private agentsConfig: AgentsConfig;
  private session: OrchestratorSession;
  private debug: boolean;
  private executionMode: 'simulate' | 'execute' | 'interactive';
  private anthropic: Anthropic;

  constructor() {
    this.debug = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
    // Execution mode: 'simulate' | 'execute' | 'interactive' 
    this.executionMode = (process.env.EXECUTION_MODE as any) || 'simulate';
    this.agentsConfig = this.loadAgentsConfig();
    
    // Initialize AI integration
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
    
    this.session = {
      sessionId: Date.now().toString(),
      userRequest: '',
      tasks: [],
      status: 'planning',
      plan: '',
      results: []
    };
  }

  private log(message: string, ...args: unknown[]) {
    if (this.debug) {
      console.log(message, ...args);
    }
  }

  private info(message: string) {
    // Always show important info with immediate flush
    console.log(message);
    process.stdout.write(''); // Force flush
  }

  private coloredInfo(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${colors.bold}${message}${colors.reset}`);
    process.stdout.write(''); // Force flush
  }

  /**
   * Update agent memory by appending to their .md file
   */
  private async updateAgentMemory(agent: string, task: AgentTask, result: TaskResult): Promise<void> {
    const agentFiles = {
      db: 'docs/agents/db.md',
      be: 'docs/agents/be.md', 
      fe: 'docs/agents/fe.md',
      ops: 'docs/agents/ops.md',
      test: 'docs/agents/test.md'
    };

    const agentFile = agentFiles[agent as keyof typeof agentFiles];
    if (!agentFile) {
      this.log(`Warning: No memory file defined for agent: ${agent}`);
      return;
    }

    const agentPath = path.join(process.cwd(), agentFile);
    
    // Create timestamp entry
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Format the memory entry
    const memoryEntry = `
## ${timestamp} ${time} - Task Execution

**Task**: ${task.description}  
**Status**: ${result.executed ? '✅ Completed' : '📋 Simulated'}  
**Action**: ${result.action}  
**Details**: ${result.details}  
${result.next_step ? `**Next Step**: ${result.next_step}  ` : ''}
${result.output ? `**Output**: \`\`\`\n${result.output}\n\`\`\`  ` : ''}
${result.recommendations ? `**Recommendations**: ${result.recommendations.join(', ')}  ` : ''}

---
`;

    try {
      // Append to agent memory file
      fs.appendFileSync(agentPath, memoryEntry);
      this.log(`📝 Updated ${agent.toUpperCase()} agent memory: ${agentFile}`);
    } catch (error) {
      this.log(`❌ Failed to update agent memory: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Update orchestrator session log
   */
  private async updateOrchestratorMemory(): Promise<void> {
    const orchestratorPath = path.join(process.cwd(), 'docs/agents/lead.md');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Calculate session stats
    const completedTasks = this.session.tasks.filter(t => t.status === 'completed');
    const failedTasks = this.session.tasks.filter(t => t.status === 'failed');
    const skippedTasks = completedTasks.filter(t => t.result?.action === 'Skipped by user');
    const executedTasks = completedTasks.filter(t => t.result?.action !== 'Skipped by user');
    
    const sessionEntry = `
## ${timestamp} ${time} - Orchestration Session

**Session ID**: ${this.session.sessionId}  
**User Request**: ${this.session.userRequest}  
**Execution Mode**: ${this.executionMode}  
**Status**: ${this.session.status}  

### Task Summary
- **Total Tasks**: ${this.session.tasks.length}
- **Executed**: ${executedTasks.length}
- **Skipped**: ${skippedTasks.length}
- **Failed**: ${failedTasks.length}

### Agent Delegation
${this.session.tasks.map(task => 
  `- **${task.agent.toUpperCase()}**: ${task.description} → ${task.status === 'completed' ? (task.result?.executed ? '✅ Executed' : '📋 Simulated') : '❌ Failed'}`
).join('\n')}

### Key Outcomes
${executedTasks.length > 0 ? 
  executedTasks.map(task => `- ${task.agent.toUpperCase()}: ${task.result?.action}`).join('\n') : 
  '- No tasks executed this session'
}

---
`;

    try {
      fs.appendFileSync(orchestratorPath, sessionEntry);
      this.log(`📝 Updated orchestrator memory: docs/agents/lead.md`);
    } catch (error) {
      this.log(`❌ Failed to update orchestrator memory: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async askForApproval(message: string): Promise<boolean> {
    if (this.executionMode !== 'interactive') {
      return true; // Auto-approve in other modes
    }

    // Use readline for interactive prompts with explicit colors
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      // Force immediate output with newline and color
      console.log(); // Blank line for spacing
      const prompt = `${colors.magenta}${colors.bold}❓ ${message} [y/N]: ${colors.reset}`;
      
      rl.question(prompt, (answer: string) => {
        rl.close();
        const approved = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
        
        // Echo the decision with color and immediate flush
        if (approved) {
          console.log(`${colors.green}${colors.bold}✓ Approved${colors.reset}`);
        } else {
          console.log(`${colors.yellow}${colors.bold}✗ Skipped${colors.reset}`);
        }
        console.log(); // Blank line after decision
        
        resolve(approved);
      });
    });
  }

  private loadAgentsConfig(): AgentsConfig {
    try {
      const configPath = path.join(process.cwd(), 'agents.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.load(fileContents) as AgentsConfig;
    } catch (error) {
      console.error('❌ Failed to load agents.yaml:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Plan task execution based on user request
   */
  async planTask(userRequest: string): Promise<AgentTask[]> {
    this.info('🤖 Analyzing request...');
    this.log(`📝 User Request: ${userRequest}`);

    this.session.userRequest = userRequest;
    this.session.status = 'planning';

    // Parse common development tasks based on keywords
    const tasks: AgentTask[] = [];
    const lowerRequest = userRequest.toLowerCase();

    // Database-related tasks
    if (lowerRequest.includes('migration') || lowerRequest.includes('database') || lowerRequest.includes('schema')) {
      tasks.push({
        id: 'db-migration',
        description: 'Execute database migration or schema changes',
        agent: 'db',
        files: ['migrations/', 'models/', 'schema/'],
        status: 'pending'
      });
    }

    // Backend API tasks
    if (lowerRequest.includes('api') || lowerRequest.includes('backend') || lowerRequest.includes('endpoint')) {
      tasks.push({
        id: 'be-validation',
        description: 'Validate and update backend API logic',
        agent: 'be',
        files: ['controllers/', 'routes/', 'services/'],
        status: 'pending'
      });
    }

    // Frontend tasks
    if (lowerRequest.includes('component') || lowerRequest.includes('frontend') || lowerRequest.includes('ui')) {
      tasks.push({
        id: 'fe-update',
        description: 'Update frontend components and interfaces',
        agent: 'fe',
        files: ['components/', 'pages/', 'styles/'],
        status: 'pending'
      });
    }

    // Infrastructure tasks
    if (lowerRequest.includes('deploy') || lowerRequest.includes('docker') || lowerRequest.includes('ci')) {
      tasks.push({
        id: 'ops-update',
        description: 'Update deployment and infrastructure configuration',
        agent: 'ops',
        files: ['docker-compose.yml', 'Dockerfile', '.github/workflows/'],
        status: 'pending'
      });
    }

    // Test tasks
    if (lowerRequest.includes('test') || lowerRequest.includes('spec')) {
      tasks.push({
        id: 'test-update',
        description: 'Update and run test suites',
        agent: 'test',
        files: ['tests/', '*.test.*', '*.spec.*'],
        status: 'pending'
      });
    }

    // If no specific tasks identified, create a generic planning task
    if (tasks.length === 0) {
      tasks.push({
        id: 'generic-analysis',
        description: 'Analyze codebase and provide recommendations',
        agent: 'lead',
        files: [],
        status: 'pending'
      });
    }

    this.session.tasks = tasks;
    this.session.plan = `
## Task Execution Plan

### User Request
${userRequest}

### Identified Tasks
${tasks.map((task, index) => `${index + 1}. **${task.agent.toUpperCase()} Agent**: ${task.description}`).join('\n')}

### Execution Strategy
Tasks will be executed in sequence, with each specialist agent handling their domain expertise.
    `.trim();

    this.log('\n📋 Execution Plan Generated:');
    this.log(this.session.plan);

    return tasks;
  }

  /**
   * Execute tasks by delegating to appropriate agents
   */
  async executeTasks(): Promise<void> {
    if (this.executionMode === 'interactive') {
      this.coloredInfo('\n📋 Execution Plan:', 'blue');
      this.session.tasks.forEach((task, index) => {
        console.log(`${colors.yellow}${index + 1}. ${colors.bold}${task.agent.toUpperCase()} Agent${colors.reset}: ${task.description}`);
      });
      
      const proceedWithAll = await this.askForApproval('Start interactive execution?');
      if (!proceedWithAll) {
        this.coloredInfo('🛑 Execution cancelled by user', 'red');
        this.session.status = 'cancelled';
        return;
      }
    } else {
      this.coloredInfo('\n🚀 Starting execution...', 'blue');
    }

    this.session.status = 'executing';

    for (let i = 0; i < this.session.tasks.length; i++) {
      const task = this.session.tasks[i];
      
      // Interactive mode: show clear task separator and ask for approval
      if (this.executionMode === 'interactive') {
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.blue}${colors.bold}TASK ${i + 1}/${this.session.tasks.length}: ${task.agent.toUpperCase()} AGENT${colors.reset}`);
        console.log(`${colors.blue}Description: ${colors.reset}${task.description}`);
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
        
        const taskApproval = await this.askForApproval(
          `Execute this ${task.agent.toUpperCase()} agent task?`
        );
        
        if (!taskApproval) {
          this.coloredInfo(`⏭️  SKIPPED: ${task.agent.toUpperCase()} task`, 'yellow');
          task.status = 'completed';
          task.result = {
            action: 'Skipped by user',
            details: 'User chose not to execute this task',
            executed: false
          };
          continue;
        }
        
        // Show execution starting
        this.coloredInfo(`🚀 EXECUTING: ${task.agent.toUpperCase()} agent...`, 'blue');
      } else {
        this.log(`\n📤 Delegating to ${task.agent} agent: ${task.description}`);
      }

      task.status = 'in_progress';

      try {
        const result = await this.delegateToAgent(task);
        task.result = result;
        task.status = 'completed';
        
        // Update agent memory with task execution
        await this.updateAgentMemory(task.agent, task, result);
        
        if (this.executionMode === 'interactive') {
          this.coloredInfo(`✅ COMPLETED: ${task.agent.toUpperCase()} - ${result?.action || 'Success'}`, 'green');
          
          // Show result details if available
          if (result?.details) {
            console.log(`${colors.green}📄 Details: ${colors.reset}${result.details}`);
          }
          if (result?.next_step) {
            console.log(`${colors.blue}🔗 Next Step: ${colors.reset}${result.next_step}`);
          }
        } else {
          this.coloredInfo(`✅ ${task.agent.toUpperCase()}: ${result?.action || 'completed'}`, 'green');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        task.error = errorMessage;
        task.status = 'failed';
        this.coloredInfo(`❌ FAILED: ${task.agent.toUpperCase()} - ${errorMessage}`, 'red');
        
        // Still update agent memory for failed tasks
        if (task.result) {
          await this.updateAgentMemory(task.agent, task, task.result);
        }
      }
    }
  }

  /**
   * Delegate specific task to appropriate agent
   */
  private async delegateToAgent(task: AgentTask): Promise<TaskResult> {
    this.log(`🤖 ${task.agent.toUpperCase()} Agent executing: ${task.description}`);

    switch (task.agent) {
      case 'db':
        return await this.callAIAgent('database-expert', task);
      
      case 'be':
        return await this.callAIAgent('backend-expert', task);
      
      case 'fe':
        return await this.callAIAgent('frontend-expert', task);
      
      case 'ops':
        return await this.callAIAgent('infrastructure-expert', task);
      
      case 'test':
        return await this.callAIAgent('test-expert', task);
      
      case 'lead':
        return await this.executeLeadTask(task); // Keep lead agent as-is for now
      
      default:
        throw new Error(`Unknown agent: ${task.agent}`);
    }
  }

  /**
   * Call AI agent using Anthropic SDK and prompt templates
   */
  private async callAIAgent(agentTemplate: string, task: AgentTask): Promise<TaskResult> {
    try {
      // Check for API key
      if (!process.env.ANTHROPIC_API_KEY) {
        this.log(`⚠️  No ANTHROPIC_API_KEY found, falling back to simulation for ${task.agent}`);
        return await this.fallbackToSimulation(task);
      }

      // Load and process prompt template
      const prompt = await this.loadAndProcessPrompt(task.agent, task);
      
      this.log(`🤖 Calling Anthropic API for ${task.agent} agent...`);

      // Call Anthropic API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract and parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      // Try to extract JSON from response
      const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/);
      let result: TaskResult;

      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          this.log(`⚠️  Failed to parse JSON response, extracting manually...`);
          result = this.extractResultFromText(content.text, task);
        }
      } else {
        this.log(`⚠️  No JSON block found in response, extracting manually...`);
        result = this.extractResultFromText(content.text, task);
      }

      // Validate required fields
      if (!result.action || !result.details) {
        this.log(`⚠️  Invalid AI response format, using fallback...`);
        return await this.fallbackToSimulation(task);
      }

      // Ensure executed field matches execution mode
      if (this.executionMode === 'simulate') {
        result.executed = false;
      }

      this.log(`✅ AI agent ${task.agent} completed: ${result.action}`);
      return result;

    } catch (error) {
      this.log(`❌ AI agent ${task.agent} failed:`, error instanceof Error ? error.message : error);
      this.log(`🔄 Falling back to simulation for ${task.agent}`);
      return await this.fallbackToSimulation(task);
    }
  }

  /**
   * Load and process prompt template with variable replacement
   */
  private async loadAndProcessPrompt(agent: string, task: AgentTask): Promise<string> {
    // Agent mapping: orchestrator agent IDs to prompt template filenames
    const agentMapping: Record<string, string> = {
      'be': 'backend-expert.md',
      'fe': 'frontend-expert.md', 
      'db': 'database-expert.md',
      'ops': 'infrastructure-expert.md',
      'test': 'test-expert.md'
    };

    const templateFile = agentMapping[agent];
    if (!templateFile) {
      throw new Error(`No prompt template found for agent: ${agent}`);
    }

    // Load template file
    const templatePath = path.join(__dirname, '..', 'prompts', templateFile);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Prompt template not found: ${templatePath}`);
    }

    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    const context = await this.buildPromptContext(task);
    
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      template = template.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return template;
  }

  /**
   * Build context object for prompt template replacement
   */
  private async buildPromptContext(task: AgentTask): Promise<Record<string, any>> {
    const context: Record<string, any> = {
      USER_REQUEST: this.session.userRequest,
      TASK_DESCRIPTION: task.description,
      EXECUTION_MODE: this.executionMode,
      TARGET_FILES: (task.files || []).join(', ') || 'None specified'
    };

    // Add agent memory
    context.AGENT_MEMORY = await this.loadAgentMemory(task.agent);

    // Add project context
    context.PROJECT_STRUCTURE = await this.getProjectStructure();
    context.PACKAGE_SCRIPTS = await this.getPackageScripts();

    // Add agent-specific context
    if (task.agent === 'be') {
      context.BACKEND_DIRS = await this.getBackendDirs();
    } else if (task.agent === 'fe') {
      context.FRONTEND_FRAMEWORK = await this.getFrontendFramework();
      context.COMPONENT_DIRS = await this.getComponentDirs();
    } else if (task.agent === 'db') {
      context.DATABASE_TYPE = await this.getDatabaseType();
      context.MIGRATION_DIRS = await this.getMigrationDirs();
    } else if (task.agent === 'ops') {
      context.DOCKER_FILES = await this.getDockerFiles();
      context.WORKFLOW_FILES = await this.getWorkflowFiles();
    } else if (task.agent === 'test') {
      context.TEST_FRAMEWORK = await this.getTestFramework();
      context.TEST_DIRS = await this.getTestDirs();
    }

    return context;
  }

  /**
   * Load recent agent memory
   */
  private async loadAgentMemory(agent: string): Promise<string> {
    try {
      const memoryFiles: Record<string, string> = {
        'be': 'docs/agents/be.md',
        'fe': 'docs/agents/fe.md',
        'db': 'docs/agents/db.md',
        'ops': 'docs/agents/ops.md',
        'test': 'docs/agents/test.md'
      };

      const memoryFile = memoryFiles[agent];
      if (!memoryFile) return 'No memory file configured';

      const memoryPath = path.join(process.cwd(), memoryFile);
      if (!fs.existsSync(memoryPath)) return 'No previous memory available';

      const content = fs.readFileSync(memoryPath, 'utf8');
      
      // Get last 3 entries (split by ---)
      const entries = content.split('---').slice(-3);
      return entries.join('---').trim() || 'No recent activity';
      
    } catch (error) {
      return 'Memory unavailable';
    }
  }

  /**
   * Context extraction methods
   */
  private async getProjectStructure(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return `${pkg.name || 'Unknown'} v${pkg.version || '0.0.0'}`;
      }
      return 'Non-Node.js project';
    } catch {
      return 'Unknown project structure';
    }
  }

  private async getPackageScripts(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const scripts = pkg.scripts || {};
        return Object.entries(scripts)
          .map(([name, cmd]) => `${name}: ${cmd}`)
          .join('\n') || 'No scripts found';
      }
      return 'No package.json found';
    } catch {
      return 'Error reading package.json';
    }
  }

  private async getBackendDirs(): Promise<string> {
    const dirs = ['src', 'lib', 'server', 'backend', 'api', 'controllers', 'routes'];
    const found = dirs.filter(dir => fs.existsSync(path.join(process.cwd(), dir)));
    return found.join(', ') || 'None detected';
  }

  private async getFrontendFramework(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.next) return 'Next.js';
        if (deps.react) return 'React';
        if (deps.vue) return 'Vue.js';
        if (deps.angular) return 'Angular';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getComponentDirs(): Promise<string> {
    const dirs = ['components', 'src/components', 'app/components'];
    const found = dirs.filter(dir => fs.existsSync(path.join(process.cwd(), dir)));
    return found.join(', ') || 'None detected';
  }

  private async getDatabaseType(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.pg || deps.postgres) return 'PostgreSQL';
        if (deps.mysql || deps.mysql2) return 'MySQL';
        if (deps.prisma) return 'Prisma';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getMigrationDirs(): Promise<string> {
    const dirs = ['migrations', 'prisma/migrations', 'database/migrations'];
    const found = dirs.filter(dir => fs.existsSync(path.join(process.cwd(), dir)));
    return found.join(', ') || 'None found';
  }

  private async getDockerFiles(): Promise<string> {
    const files = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
    const found = files.filter(file => fs.existsSync(path.join(process.cwd(), file)));
    return found.join(', ') || 'None found';
  }

  private async getWorkflowFiles(): Promise<string> {
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    if (fs.existsSync(workflowDir)) {
      const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      return files.join(', ') || 'None found';
    }
    return 'None found';
  }

  private async getTestFramework(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.jest) return 'Jest';
        if (deps.vitest) return 'Vitest';
        if (deps.mocha) return 'Mocha';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getTestDirs(): Promise<string> {
    const dirs = ['test', 'tests', '__tests__', 'spec'];
    const found = dirs.filter(dir => fs.existsSync(path.join(process.cwd(), dir)));
    return found.join(', ') || 'None found';
  }

  /**
   * Extract TaskResult from AI text response when JSON parsing fails
   */
  private extractResultFromText(text: string, task: AgentTask): TaskResult {
    // Basic extraction - look for key patterns in the text
    const actionMatch = text.match(/action[:\s]*(.+?)(?:\n|$)/i);
    const detailsMatch = text.match(/details[:\s]*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
    
    return {
      action: actionMatch?.[1]?.trim() || `${task.agent.toUpperCase()} analysis completed`,
      details: detailsMatch?.[1]?.trim() || 'AI agent provided analysis but response format was unclear',
      executed: false,
      recommendations: ['Review AI agent response for detailed recommendations'],
      next_step: 'Manual review of AI analysis recommended'
    };
  }

  /**
   * Fallback to simulation when AI agent fails
   */
  private async fallbackToSimulation(task: AgentTask): Promise<TaskResult> {
    this.log(`🎭 Using simulation fallback for ${task.agent} agent`);
    
    switch (task.agent) {
      case 'db':
        return await this.executeDatabaseTask(task);
      case 'be':
        return await this.executeBackendTask(task);
      case 'fe':
        return await this.executeFrontendTask(task);
      case 'ops':
        return await this.executeInfrastructureTask(task);
      case 'test':
        return await this.executeTestTask(task);
      default:
        return {
          action: 'Agent analysis completed',
          details: 'Fallback simulation executed',
          executed: false,
          recommendations: ['Configure ANTHROPIC_API_KEY for AI agent capabilities']
        };
    }
  }

  /**
   * Database agent tasks
   */
  private async executeDatabaseTask(task: AgentTask): Promise<TaskResult> {
    this.log('🗄️  Database Agent: Analyzing database requirements');
    
    // Check for migration files
    const migrationDirs = ['migrations', 'prisma/migrations', 'database/migrations'];
    let foundMigrations = false;
    
    for (const dir of migrationDirs) {
      if (fs.existsSync(path.join(process.cwd(), dir))) {
        foundMigrations = true;
        break;
      }
    }
    
    // Check for package.json scripts
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let hasDbScripts = false;
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      hasDbScripts = Object.keys(scripts).some(script => 
        script.includes('migrate') || script.includes('db') || script.includes('prisma')
      );
    }

    if (this.executionMode === 'execute' && hasDbScripts) {
      // Try to run database operations
      this.info('🚀 Running database operations...');
      
      return new Promise<TaskResult>((resolve, reject) => {
        // Try common migration commands
        const commands = ['npm run migrate', 'npm run db:migrate', 'npx prisma migrate deploy'];
        
        const tryCommand = (cmdIndex: number) => {
          if (cmdIndex >= commands.length) {
            resolve({
              action: 'Database analysis completed',
              details: 'No suitable migration command found',
              executed: false
            });
            return;
          }
          
          const [cmd, ...args] = commands[cmdIndex].split(' ');
          const process = spawn(cmd, args, { stdio: 'pipe' });
          
          let output = '';
          process.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          process.on('close', (code: number) => {
            if (code === 0) {
              resolve({
                action: 'Database migration executed',
                details: 'Migration completed successfully',
                output: output.trim(),
                executed: true
              });
            } else {
              tryCommand(cmdIndex + 1);
            }
          });
        };
        
        tryCommand(0);
      });
    } else {
      return {
        action: 'Database analysis completed',
        details: foundMigrations ? 'Migration files found' : 'No migrations detected',
        recommendations: hasDbScripts ? ['Run database migrations'] : ['Set up migration system'],
        executed: false
      };
    }
  }

  /**
   * Backend agent tasks
   */
  private async executeBackendTask(task: AgentTask): Promise<TaskResult> {
    this.log('⚙️  Backend Agent: Analyzing backend code');
    
    // Look for common backend patterns
    const backendDirs = ['src', 'lib', 'server', 'backend', 'api'];
    const foundFiles: string[] = [];
    
    for (const dir of backendDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        // Look for controllers, routes, etc.
        const files = fs.readdirSync(dirPath, { recursive: true });
        foundFiles.push(...files.filter(file => 
          typeof file === 'string' && (
            file.includes('controller') || 
            file.includes('route') || 
            file.includes('service') ||
            file.includes('api')
          )
        ).map(file => path.join(dir, file as string)));
      }
    }
    
    return {
      action: 'Backend analysis completed',
      details: `Found ${foundFiles.length} backend files`,
      files_checked: foundFiles.slice(0, 10), // Limit for readability
      recommendations: foundFiles.length > 0 ? 
        ['Review API endpoints', 'Check error handling', 'Validate input sanitization'] :
        ['Set up backend structure'],
      executed: false
    };
  }

  /**
   * Frontend agent tasks
   */
  private async executeFrontendTask(task: AgentTask): Promise<TaskResult> {
    this.log('🎨 Frontend Agent: Analyzing frontend code');
    
    // Look for frontend files
    const frontendDirs = ['src', 'components', 'pages', 'app', 'frontend'];
    const foundComponents: string[] = [];
    
    for (const dir of frontendDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath, { recursive: true });
        foundComponents.push(...files.filter(file => 
          typeof file === 'string' && (
            file.endsWith('.tsx') || 
            file.endsWith('.jsx') || 
            file.endsWith('.vue') ||
            file.includes('component')
          )
        ).map(file => path.join(dir, file as string)));
      }
    }
    
    return {
      action: 'Frontend analysis completed',
      details: `Found ${foundComponents.length} frontend components`,
      files_checked: foundComponents.slice(0, 10),
      recommendations: foundComponents.length > 0 ? 
        ['Check accessibility compliance', 'Review component structure', 'Validate design system usage'] :
        ['Set up frontend framework'],
      executed: false
    };
  }

  /**
   * Infrastructure agent tasks
   */
  private async executeInfrastructureTask(task: AgentTask): Promise<TaskResult> {
    this.log('🔧 Infrastructure Agent: Analyzing deployment configuration');
    
    const infraFiles = [
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      '.github/workflows',
      'deployment',
      'k8s',
      'terraform'
    ];
    
    const foundInfra: string[] = [];
    
    for (const file of infraFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        foundInfra.push(file);
      }
    }
    
    return {
      action: 'Infrastructure analysis completed',
      details: `Found ${foundInfra.length} infrastructure files`,
      files_checked: foundInfra,
      recommendations: foundInfra.length > 0 ? 
        ['Review security configurations', 'Check resource limits', 'Validate health checks'] :
        ['Set up containerization'],
      executed: false
    };
  }

  /**
   * Test agent tasks
   */
  private async executeTestTask(task: AgentTask): Promise<TaskResult> {
    this.log('🧪 Test Agent: Analyzing test coverage');
    
    // Look for test files
    const testPatterns = ['.test.', '.spec.', '__tests__', 'tests/'];
    const foundTests: string[] = [];
    
    const searchDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir, { recursive: true });
      foundTests.push(...files.filter(file => 
        typeof file === 'string' && testPatterns.some(pattern => file.includes(pattern))
      ).map(file => path.join(dir, file as string)));
    };
    
    searchDir('src');
    searchDir('test');
    searchDir('tests');
    
    if (this.executionMode === 'execute' && foundTests.length > 0) {
      // Try to run tests
      return new Promise<TaskResult>((resolve) => {
        const testCommands = ['npm test', 'npm run test', 'yarn test'];
        
        const tryTest = (cmdIndex: number) => {
          if (cmdIndex >= testCommands.length) {
            resolve({
              action: 'Test analysis completed',
              details: `Found ${foundTests.length} test files`,
              files_checked: foundTests.slice(0, 10),
              executed: false
            });
            return;
          }
          
          const [cmd, ...args] = testCommands[cmdIndex].split(' ');
          const process = spawn(cmd, args, { stdio: 'pipe' });
          
          let output = '';
          process.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          process.on('close', (code: number) => {
            if (code === 0) {
              resolve({
                action: 'Tests executed successfully',
                details: 'All tests passed',
                output: output.trim(),
                executed: true
              });
            } else {
              tryTest(cmdIndex + 1);
            }
          });
        };
        
        tryTest(0);
      });
    } else {
      return {
        action: 'Test analysis completed',
        details: `Found ${foundTests.length} test files`,
        files_checked: foundTests.slice(0, 10),
        recommendations: foundTests.length > 0 ? 
          ['Run test suite', 'Check coverage'] :
          ['Set up testing framework'],
        executed: false
      };
    }
  }

  /**
   * Lead agent tasks
   */
  private async executeLeadTask(task: AgentTask): Promise<TaskResult> {
    this.log('👔 Lead Agent: Performing project analysis');
    
    // Analyze project structure
    const projectFiles = fs.readdirSync(process.cwd());
    const hasPackageJson = projectFiles.includes('package.json');
    const hasDockerfile = projectFiles.includes('Dockerfile');
    const hasReadme = projectFiles.includes('README.md');
    
    const analysis = {
      project_type: hasPackageJson ? 'Node.js' : 'Unknown',
      containerized: hasDockerfile,
      documented: hasReadme,
      structure_score: projectFiles.length
    };
    
    return {
      action: 'Project analysis completed',
      details: `Analyzed project structure: ${analysis.project_type} project`,
      recommendations: [
        !analysis.documented ? 'Add README.md documentation' : null,
        !analysis.containerized ? 'Consider containerization' : null,
        'Review agent configuration in agents.yaml'
      ].filter(Boolean) as string[],
      executed: false
    };
  }

  /**
   * Review results and provide final report
   */
  async reviewResults(): Promise<void> {
    this.log('\n📊 Reviewing results...');
    this.session.status = 'reviewing';

    const completedTasks = this.session.tasks.filter(t => t.status === 'completed');
    const failedTasks = this.session.tasks.filter(t => t.status === 'failed');
    const skippedTasks = completedTasks.filter(t => t.result?.action === 'Skipped by user');
    const executedTasks = completedTasks.filter(t => t.result?.action !== 'Skipped by user');

    this.coloredInfo(`\n📊 ${executedTasks.length}/${this.session.tasks.length} tasks executed`, 'blue');
    if (skippedTasks.length > 0) {
      this.coloredInfo(`⏭️  ${skippedTasks.length} tasks skipped by user`, 'yellow');
    }

    if (failedTasks.length === 0) {
      this.session.status = 'completed';
      this.coloredInfo('🎉 All tasks completed!', 'green');
      
      // Show key next steps from executed tasks only (not skipped)
      const nextSteps = executedTasks
        .map(task => task.result?.next_step)
        .filter((step): step is string => Boolean(step));
      
      if (nextSteps.length > 0) {
        this.coloredInfo('\n🚀 Next Steps:', 'blue');
        nextSteps.forEach(step => this.info(`• ${step}`));
      }
      
      // Show any issues that need attention from executed tasks only
      const issues = executedTasks
        .filter(task => task.result?.recommendations?.some((rec: string) => rec.includes('Set up')))
        .map(task => {
          const recommendation = task.result?.recommendations?.find((rec: string) => rec.includes('Set up'));
          return recommendation ? `${task.agent.toUpperCase()}: ${recommendation}` : null;
        })
        .filter((issue): issue is string => Boolean(issue));
        
      if (issues.length > 0) {
        this.coloredInfo('\n⚠️  Setup Recommendations:', 'yellow');
        issues.forEach(issue => this.info(`• ${issue}`));
      }
      
    } else {
      this.session.status = 'failed';
      this.coloredInfo('\n❌ Some tasks failed:', 'red');
      failedTasks.forEach(task => {
        this.coloredInfo(`• ${task.agent}: ${task.error}`, 'red');
      });
    }

    // Update orchestrator memory with session summary
    await this.updateOrchestratorMemory();
  }

  /**
   * Main orchestration flow
   */
  async orchestrate(userRequest: string): Promise<void> {
    this.coloredInfo(`🎭 Agent Orchestrator (${this.executionMode} mode)`, 'blue');
    this.log(`📋 Active Pattern: ${this.agentsConfig.active_pattern}`);
    
    try {
      // Planning phase
      await this.planTask(userRequest);
      
      // Execution phase  
      await this.executeTasks();
      
      // Review phase
      await this.reviewResults();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.info(`💥 Orchestration failed: ${errorMessage}`);
      this.session.status = 'failed';
    }

    this.log(`\n🏁 Session completed with status: ${this.session.status}`);
  }

  /**
   * CLI interface
   */
  static async cli(): Promise<void> {
    const args = process.argv.slice(2);
    
    // Show help
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
🎭 Agent Orchestrator - Runtime Task Delegation

Usage:
  npm run orchestrator "your task description"

Execution Modes:
  EXECUTION_MODE=simulate     # Plan and validate (default)
  EXECUTION_MODE=execute      # Actually run tasks automatically
  EXECUTION_MODE=interactive  # Ask for approval before each action

Examples:
  npm run orchestrator "analyze codebase structure"
  EXECUTION_MODE=execute npm run orchestrator "run database migrations"  
  EXECUTION_MODE=interactive npm run orchestrator "update frontend components"
  DEBUG=1 npm run orchestrator "deploy application"

Environment Variables:
  DEBUG=1                 # Verbose logging
  EXECUTION_MODE=execute  # Real execution vs simulation
      `);
      return;
    }
    
    const orchestrator = new RuntimeOrchestrator();
    
    // Get user request from command line or use default
    const userRequest = args.join(' ') || 
      'Analyze the project structure and provide recommendations';
    
    await orchestrator.orchestrate(userRequest);
  }
}

// Run CLI if called directly
if (require.main === module) {
  RuntimeOrchestrator.cli().catch(console.error);
}

export { RuntimeOrchestrator };
export default RuntimeOrchestrator;