#!/usr/bin/env node
/**
 * Agent Router - Parses PR diffs and routes to appropriate specialists
 * Consumes agents.yaml heuristics and posts GitHub PR comments
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class AgentRouter {
  constructor() {
    this.agentsConfig = this.loadAgentsConfig();
  }

  loadAgentsConfig() {
    try {
      // Allow configurable agents config path via environment variable
      const configPath = path.join(process.cwd(), process.env.AGENTS_CONFIG_PATH || 'agents.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.load(fileContents);
    } catch (error) {
      console.error(`❌ Failed to load ${process.env.AGENTS_CONFIG_PATH || 'agents.yaml'}:`, error.message);
      process.exit(1);
    }
  }

  /**
   * Route files to appropriate agent based on heuristics
   * @param {string[]} changedFiles - Array of file paths
   * @returns {Object} Routing results
   */
  routeFiles(changedFiles) {
    const routing = {
      primary: 'lead_agent',
      specialists: new Set(),
      files: {},
      confidence: 'high'
    };

    if (!changedFiles || changedFiles.length === 0) {
      return routing;
    }

    // Apply heuristics from agents.yaml
    for (const file of changedFiles) {
      const agent = this.matchFileToAgent(file);
      routing.files[file] = agent;
      
      if (agent !== 'lead_agent') {
        routing.specialists.add(agent);
      }
    }

    // Determine primary agent
    const specialistCounts = {};
    for (const specialist of routing.specialists) {
      specialistCounts[specialist] = Object.values(routing.files)
        .filter(agent => agent === specialist).length;
    }

    if (routing.specialists.size === 1) {
      routing.primary = [...routing.specialists][0];
    } else if (routing.specialists.size > 1) {
      // Multi-domain change - lead agent orchestrates
      routing.primary = 'lead_agent';
      routing.confidence = 'medium';
    }

    // Check change limits
    const limits = this.agentsConfig.limits || {};
    if (changedFiles.length > (limits.max_files_changed || 8)) {
      routing.confidence = 'low';
      routing.primary = 'lead_agent'; // Large changes need lead oversight
    }

    return {
      ...routing,
      specialists: [...routing.specialists]
    };
  }

  /**
   * Match single file to agent based on heuristics
   * @param {string} filePath 
   * @returns {string} Agent ID
   */
  matchFileToAgent(filePath) {
    const heuristics = this.agentsConfig.routing?.heuristics || [];

    for (const rule of heuristics) {
      if (this.evaluateHeuristic(rule.if, filePath)) {
        return rule.to;
      }
    }

    return 'lead_agent'; // Default to lead agent
  }

  /**
   * Evaluate heuristic condition against file path
   * @param {string} condition - Heuristic condition from agents.yaml
   * @param {string} filePath - File path to test
   * @returns {boolean}
   */
  evaluateHeuristic(condition, filePath) {
    // Parse condition like "touches /frontend or .tsx or components"
    const patterns = condition
      .replace(/touches\s+/g, '')
      .split(/\s+or\s+/)
      .map(p => p.trim());

    return patterns.some(pattern => {
      if (pattern.startsWith('/')) {
        // Directory pattern
        return filePath.startsWith(pattern.substring(1));
      } else if (pattern.startsWith('.')) {
        // Extension pattern
        return filePath.endsWith(pattern);
      } else {
        // Contains pattern
        return filePath.includes(pattern);
      }
    });
  }

  /**
   * Generate PR comment with routing results
   * @param {Object} routing - Routing results
   * @param {Object} options - Additional options
   * @returns {string} Markdown comment
   */
  generatePRComment(routing, options = {}) {
    const { agents } = this.agentsConfig;
    const primaryAgent = agents?.[routing.primary];
    
    let comment = `## 🤖 Agent Routing Results\n\n`;
    
    // Primary assignment
    comment += `**Primary Agent**: \`${routing.primary}\``;
    if (primaryAgent?.name) {
      comment += ` (${primaryAgent.name})`;
    }
    comment += `\n**Confidence**: ${routing.confidence}\n\n`;

    // Specialist involvement
    if (routing.specialists.length > 0) {
      comment += `**Specialists Involved**:\n`;
      for (const specialistId of routing.specialists) {
        const specialist = agents[specialistId];
        comment += `- \`${specialistId}\`: ${specialist?.name || specialistId}\n`;
      }
      comment += `\n`;
    }

    // File breakdown
    comment += `**File Routing**:\n`;
    const filesByAgent = {};
    for (const [file, agent] of Object.entries(routing.files)) {
      if (!filesByAgent[agent]) filesByAgent[agent] = [];
      filesByAgent[agent].push(file);
    }

    for (const [agentId, files] of Object.entries(filesByAgent)) {
      const agentName = agents?.[agentId]?.name || agentId;
      comment += `\n**${agentName}** (\`${agentId}\`):\n`;
      for (const file of files.slice(0, 5)) {
        comment += `- \`${file}\`\n`;
      }
      if (files.length > 5) {
        comment += `- ... and ${files.length - 5} more files\n`;
      }
    }

    // Checklist recommendations
    comment += `\n**Checklist Requirements**:\n`;
    const uniqueSpecialists = [...new Set([routing.primary, ...routing.specialists])];
    for (const specialistId of uniqueSpecialists) {
      if (specialistId === 'lead_agent') continue;
      const specialist = agents?.[specialistId];
      if (specialist?.name) {
        comment += `- [ ] Complete **${specialist.name}** checklist in PR description\n`;
      } else {
        comment += `- [ ] Complete **${specialistId}** checklist in PR description\n`;
      }
    }

    // Warnings
    if (routing.confidence === 'low') {
      comment += `\n⚠️ **Large change detected** - requires lead agent oversight and detailed planning.\n`;
    }

    if (routing.specialists.length > 2) {
      comment += `\n⚠️ **Cross-domain change** - consider breaking into smaller, focused PRs.\n`;
    }

    comment += `\n---\n*Generated by Agent Router based on \`agents.yaml\` heuristics*`;

    return comment;
  }

  /**
   * CLI interface for routing files
   */
  static async cli() {
    const router = new AgentRouter();
    
    // Get changed files from command line args or git diff
    let changedFiles = process.argv.slice(2);
    
    if (changedFiles.length === 0 && process.env.GITHUB_BASE_SHA && process.env.GITHUB_HEAD_SHA) {
      // GitHub Actions context
      try {
        const { execSync } = require('child_process');
        const diffOutput = execSync(
          `git diff --name-only ${process.env.GITHUB_BASE_SHA}..${process.env.GITHUB_HEAD_SHA}`,
          { encoding: 'utf8' }
        );
        changedFiles = diffOutput.trim().split('\n').filter(f => f);
      } catch (error) {
        console.error('Failed to get git diff:', error.message);
        process.exit(1);
      }
    }

    if (changedFiles.length === 0) {
      console.log('No files to route');
      return;
    }

    console.log('🔍 Routing files:', changedFiles);
    
    const routing = router.routeFiles(changedFiles);
    
    console.log('\n📋 Routing Results:');
    console.log(`Primary: ${routing.primary}`);
    console.log(`Specialists: ${routing.specialists.join(', ') || 'none'}`);
    console.log(`Confidence: ${routing.confidence}`);
    
    if (process.env.GENERATE_COMMENT === 'true') {
      const comment = router.generatePRComment(routing);
      console.log('\n📝 Generated PR Comment:');
      console.log(comment);
    }
  }
}

// Run CLI if called directly
if (require.main === module) {
  AgentRouter.cli().catch(console.error);
}

module.exports = AgentRouter;