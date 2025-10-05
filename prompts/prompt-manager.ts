/**
 * Prompt Template Manager
 * Loads and processes AI prompt templates with context injection
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PromptContext {
  USER_REQUEST: string;
  TASK_DESCRIPTION: string;
  EXECUTION_MODE: 'simulate' | 'execute' | 'interactive';
  TARGET_FILES: string[];
  AGENT_MEMORY?: string;
  PROJECT_STRUCTURE?: string;
  PACKAGE_SCRIPTS?: string;
  [key: string]: any;
}

export interface AgentPromptConfig {
  templatePath: string;
  memoryFile: string;
  contextExtractors: {
    [key: string]: (projectPath: string) => Promise<string>;
  };
}

export class PromptManager {
  private promptsDir: string;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.promptsDir = path.join(__dirname, '..', 'prompts');
  }

  /**
   * Agent configuration mapping
   */
  private readonly agentConfigs: Record<string, AgentPromptConfig> = {
    be: {
      templatePath: 'backend-expert.md',
      memoryFile: 'docs/agents/be.md',
      contextExtractors: {
        BACKEND_DIRS: this.extractBackendDirs.bind(this),
        PACKAGE_SCRIPTS: this.extractBackendScripts.bind(this)
      }
    },
    fe: {
      templatePath: 'frontend-expert.md', 
      memoryFile: 'docs/agents/fe.md',
      contextExtractors: {
        FRONTEND_FRAMEWORK: this.extractFrontendFramework.bind(this),
        DESIGN_TOKENS_PATH: this.extractDesignTokens.bind(this),
        COMPONENT_DIRS: this.extractComponentDirs.bind(this)
      }
    },
    db: {
      templatePath: 'database-expert.md',
      memoryFile: 'docs/agents/db.md', 
      contextExtractors: {
        DATABASE_TYPE: this.extractDatabaseType.bind(this),
        MIGRATION_DIRS: this.extractMigrationDirs.bind(this),
        SCHEMA_FILES: this.extractSchemaFiles.bind(this),
        DB_SCRIPTS: this.extractDatabaseScripts.bind(this)
      }
    },
    ops: {
      templatePath: 'infrastructure-expert.md',
      memoryFile: 'docs/agents/ops.md',
      contextExtractors: {
        INFRA_FILES: this.extractInfraFiles.bind(this),
        DOCKER_FILES: this.extractDockerFiles.bind(this),
        WORKFLOW_FILES: this.extractWorkflowFiles.bind(this),
        DEPLOYMENT_SCRIPTS: this.extractDeploymentScripts.bind(this)
      }
    },
    test: {
      templatePath: 'test-expert.md',
      memoryFile: 'docs/agents/test.md',
      contextExtractors: {
        TEST_FRAMEWORK: this.extractTestFramework.bind(this),
        TEST_DIRS: this.extractTestDirs.bind(this),
        COVERAGE_PATH: this.extractCoveragePath.bind(this),
        TEST_SCRIPTS: this.extractTestScripts.bind(this)
      }
    }
  };

  /**
   * Generate complete prompt for specified agent
   */
  async generatePrompt(agent: string, context: PromptContext): Promise<string> {
    const config = this.agentConfigs[agent];
    if (!config) {
      throw new Error(`Unknown agent: ${agent}`);
    }

    // Load base template
    const templatePath = path.join(this.promptsDir, config.templatePath);
    let template = fs.readFileSync(templatePath, 'utf8');

    // Extract agent-specific context
    const agentContext = await this.extractAgentContext(config);
    
    // Load agent memory
    const agentMemory = await this.loadAgentMemory(config.memoryFile);

    // Combine all context
    const fullContext = {
      ...context,
      ...agentContext,
      AGENT_MEMORY: agentMemory,
      PROJECT_STRUCTURE: await this.extractProjectStructure()
    };

    // Replace template variables
    return this.interpolateTemplate(template, fullContext);
  }

  /**
   * Extract agent-specific context using configured extractors
   */
  private async extractAgentContext(config: AgentPromptConfig): Promise<Record<string, string>> {
    const context: Record<string, string> = {};
    
    for (const [key, extractor] of Object.entries(config.contextExtractors)) {
      try {
        context[key] = await extractor(this.projectPath);
      } catch (error) {
        console.warn(`Failed to extract ${key}:`, error instanceof Error ? error.message : error);
        context[key] = 'Not available';
      }
    }

    return context;
  }

  /**
   * Load recent agent memory from memory file
   */
  private async loadAgentMemory(memoryFile: string): Promise<string> {
    try {
      const memoryPath = path.join(this.projectPath, memoryFile);
      
      if (!fs.existsSync(memoryPath)) {
        return 'No previous memory available';
      }

      const memoryContent = fs.readFileSync(memoryPath, 'utf8');
      
      // Extract recent entries (last 3 sessions)
      const entries = memoryContent.split('---').slice(-3);
      return entries.join('---').trim() || 'No recent activity';
      
    } catch (error) {
      return 'Memory unavailable';
    }
  }

  /**
   * Replace template variables with context values
   */
  private interpolateTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in context) {
        const value = context[key];
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      }
      return match; // Keep placeholder if no value found
    });
  }

  /**
   * Context extractors for different project aspects
   */
  
  private async extractProjectStructure(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return `${pkg.name || 'Unknown'} v${pkg.version || '0.0.0'} - ${pkg.description || 'No description'}`;
      }
      return 'Non-Node.js project';
    } catch {
      return 'Project structure unknown';
    }
  }

  private async extractBackendDirs(): Promise<string> {
    const backendDirs = ['src', 'lib', 'server', 'backend', 'api', 'controllers', 'routes', 'services'];
    const found = backendDirs.filter(dir => 
      fs.existsSync(path.join(this.projectPath, dir))
    );
    return found.join(', ') || 'None detected';
  }

  private async extractBackendScripts(): Promise<string> {
    return this.extractPackageScripts(['start', 'dev', 'build', 'migrate', 'db:*']);
  }

  private async extractFrontendFramework(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.next) return 'Next.js';
        if (deps.react) return 'React';
        if (deps.vue) return 'Vue.js';
        if (deps.angular) return 'Angular';
        if (deps.svelte) return 'Svelte';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async extractDesignTokens(): Promise<string> {
    const tokenPaths = [
      'ui/tokens.json',
      'src/tokens.json', 
      'design-tokens.json',
      'tokens.json'
    ];
    
    for (const tokenPath of tokenPaths) {
      if (fs.existsSync(path.join(this.projectPath, tokenPath))) {
        return tokenPath;
      }
    }
    return 'None found';
  }

  private async extractComponentDirs(): Promise<string> {
    const componentDirs = ['components', 'src/components', 'app/components', 'ui'];
    const found = componentDirs.filter(dir =>
      fs.existsSync(path.join(this.projectPath, dir))
    );
    return found.join(', ') || 'None detected';
  }

  private async extractDatabaseType(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.pg || deps.postgres) return 'PostgreSQL';
        if (deps.mysql || deps.mysql2) return 'MySQL';
        if (deps.sqlite3) return 'SQLite';
        if (deps.mongodb || deps.mongoose) return 'MongoDB';
        if (deps.prisma) return 'Prisma (multi-database)';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async extractMigrationDirs(): Promise<string> {
    const migrationDirs = ['migrations', 'prisma/migrations', 'database/migrations', 'db/migrations'];
    const found = migrationDirs.filter(dir =>
      fs.existsSync(path.join(this.projectPath, dir))
    );
    return found.join(', ') || 'None found';
  }

  private async extractSchemaFiles(): Promise<string> {
    const schemaFiles = ['schema.sql', 'prisma/schema.prisma', 'database/schema.rb', 'models/index.js'];
    const found = schemaFiles.filter(file =>
      fs.existsSync(path.join(this.projectPath, file))
    );
    return found.join(', ') || 'None found';
  }

  private async extractDatabaseScripts(): Promise<string> {
    return this.extractPackageScripts(['migrate', 'db:*', 'prisma:*', 'schema:*']);
  }

  private async extractInfraFiles(): Promise<string> {
    const infraFiles = [
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.github/workflows', 'deployment', 'k8s', 'terraform',
      'Makefile', 'justfile'
    ];
    const found = infraFiles.filter(file =>
      fs.existsSync(path.join(this.projectPath, file))
    );
    return found.join(', ') || 'None found';
  }

  private async extractDockerFiles(): Promise<string> {
    const dockerFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
    const found = dockerFiles.filter(file =>
      fs.existsSync(path.join(this.projectPath, file))
    );
    return found.join(', ') || 'None found';
  }

  private async extractWorkflowFiles(): Promise<string> {
    const workflowDir = path.join(this.projectPath, '.github/workflows');
    if (fs.existsSync(workflowDir)) {
      const files = fs.readdirSync(workflowDir)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      return files.join(', ') || 'None found';
    }
    return 'None found';
  }

  private async extractDeploymentScripts(): Promise<string> {
    return this.extractPackageScripts(['deploy', 'build', 'start', 'docker:*']);
  }

  private async extractTestFramework(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.jest) return 'Jest';
        if (deps.vitest) return 'Vitest';
        if (deps.mocha) return 'Mocha';
        if (deps.jasmine) return 'Jasmine';
        if (deps.playwright) return 'Playwright';
        if (deps.cypress) return 'Cypress';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async extractTestDirs(): Promise<string> {
    const testDirs = ['test', 'tests', '__tests__', 'spec', 'e2e'];
    const found = testDirs.filter(dir =>
      fs.existsSync(path.join(this.projectPath, dir))
    );
    return found.join(', ') || 'None found';
  }

  private async extractCoveragePath(): Promise<string> {
    const coveragePaths = ['coverage', '.nyc_output', 'coverage-report'];
    const found = coveragePaths.filter(dir =>
      fs.existsSync(path.join(this.projectPath, dir))
    );
    return found.join(', ') || 'None found';
  }

  private async extractTestScripts(): Promise<string> {
    return this.extractPackageScripts(['test', 'test:*', 'e2e', 'coverage']);
  }

  /**
   * Extract relevant package.json scripts based on patterns
   */
  private async extractPackageScripts(patterns: string[]): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const scripts = pkg.scripts || {};
        
        const relevantScripts: string[] = [];
        for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
          for (const pattern of patterns) {
            const regex = new RegExp(pattern.replace('*', '.*'));
            if (regex.test(scriptName)) {
              relevantScripts.push(`${scriptName}: ${scriptCommand}`);
              break;
            }
          }
        }
        
        return relevantScripts.join('\n') || 'None found';
      }
      return 'No package.json found';
    } catch {
      return 'Error reading package.json';
    }
  }
}

export default PromptManager;