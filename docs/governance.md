# Agent Governance System

## Overview

This repository provides a comprehensive, reusable agent governance system for software development projects. It automatically routes pull requests to appropriate specialists, enforces domain-specific checklists, and maintains consistent quality standards across teams.

## Core Philosophy

- **Specialist Expertise**: Route changes to domain experts who understand the implications
- **Automated Quality**: Consistent standards enforced through automation  
- **Configurable Rules**: Each project can customize limits and patterns
- **Rich Feedback**: Detailed PR comments guide developers through requirements
- **Learning-Focused**: Help teams improve through clear guidelines and examples

## System Architecture

### Agent Types

The system defines five specialist agents, each with specific responsibilities:

| Agent | Domain | Primary Concerns |
|-------|--------|------------------|
| **Lead Agent** | Cross-cutting, architecture | Overall system design, coordination, risk management |
| **Frontend Expert** | UI/UX, React, accessibility | Component design, performance, user experience |
| **Backend Expert** | APIs, services, data processing | API design, security, performance, integration |
| **Database Expert** | Schema, migrations, queries | Data integrity, performance, migration safety |
| **Infrastructure Expert** | Deployment, monitoring, security | Containerization, CI/CD, observability, operations |

### Routing Logic

Changes are automatically routed based on file patterns defined in `agents.yaml`:

```yaml
routing:
  heuristics:
    - if: "touches /frontend or .tsx or .css or components"
      to: fe
    - if: "touches /backend or controllers or routes or models"  
      to: be
    - if: "touches /db or migrations or backups"
      to: db
    - if: "touches /traefik or docker-compose or Dockerfile or ci"
      to: ops
```

### Workflow Components

1. **Agent Routing** (`agent-routing.yml`): Analyzes changed files and assigns specialists
2. **Governance Validation** (`agent-governance.yml`): Enforces PR template and change limits
3. **Specialist Enforcement** (`specialist-enforcement.yml`): Domain-specific validations
4. **Main Orchestrator** (`governance.yml`): Coordinates all workflows for reusability

## Configuration System

### Global Configuration (`agents.yaml`)

Each project includes an `agents.yaml` file defining:

- **Change Limits**: Maximum files/lines per change type
- **Routing Heuristics**: File patterns mapping to specialist agents
- **Agent Definitions**: Specialist roles, domains, and rules
- **Override Rules**: Special handling for migrations, hotfixes, etc.

Example configuration:
```yaml
limits:
  max_files_changed: 20
  max_lines_changed: 600
  
  overrides:
    migration:
      max_files_changed: 9999
      max_lines_changed: 999999

agents:
  fe:
    name: Frontend Expert
    domains: [react, nextjs, typescript, css, accessibility]
    rules:
      - follow design system patterns
      - maintain Storybook stories for components
      - ensure WCAG 2.1 AA compliance
```

### Project-Specific Customization

Projects can customize the system by:

1. **Adjusting Limits**: Set appropriate change thresholds for team size and project complexity
2. **Customizing Heuristics**: Modify file patterns to match project structure
3. **Adding Rules**: Include project-specific requirements in agent definitions
4. **Override Strategies**: Define special handling for migrations, hotfixes, etc.

## Quality Standards

### Pull Request Requirements

All PRs must include:

- **Planning Section**: Intent, scope, risks, test plan, rollback strategy
- **Agent Information**: Assigned agent and collaboration pattern
- **Core Checklist**: CI green, tests updated, docs current, security review
- **Specialist Checklists**: Domain-specific requirements based on changed files

### Specialist Validation

Each domain has specific quality gates:

**Frontend Expert**:
- Storybook stories for new components
- Accessibility compliance (WCAG 2.1 AA)
- Performance impact assessment
- Design system pattern adherence

**Backend Expert**:
- OpenAPI specification updates
- Structured error handling and logging
- Input validation and security checks
- Integration test coverage

**Database Expert**:
- Zero-downtime migration strategy
- Performance impact analysis
- Rollback procedure documentation
- Data integrity validation

**Infrastructure Expert**:
- Container security and optimization
- Health checks and monitoring
- Secrets management compliance
- Deployment automation

## Implementation Guide

### For New Projects

1. **Add Governance Workflow**:
```yaml
# .github/workflows/governance.yml
name: Project Governance
on: [pull_request]
jobs:
  governance:
    uses: your-org/governance-workflows/.github/workflows/governance.yml@main
    with:
      agents_config_path: 'agents.yaml'
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

2. **Configure Agents**: Copy and customize the example `agents.yaml`
3. **Customize PR Template**: Adapt the provided template for project needs
4. **Train Team**: Share agent documentation and review guidelines

### For Existing Projects

1. **Gradual Rollout**: Start in warning-only mode
2. **Baseline Assessment**: Review current practices against agent guidelines
3. **Incremental Adoption**: Enable enforcement domain by domain
4. **Feedback Integration**: Adjust rules based on team feedback

## Benefits

### For Development Teams

- **Clear Guidelines**: Explicit requirements for each domain
- **Automated Routing**: Changes reach the right experts automatically
- **Learning Support**: Rich documentation helps improve skills
- **Consistent Standards**: Same quality expectations across projects

### for Organizations

- **Quality Assurance**: Consistent standards across teams and projects
- **Risk Reduction**: Domain experts catch issues early
- **Knowledge Sharing**: Centralized best practices and patterns
- **Scalability**: Easy to onboard new projects and team members

### For Project Managers

- **Visibility**: Clear understanding of change complexity and risk
- **Predictability**: Consistent review processes and timelines
- **Quality Metrics**: Automated tracking of compliance and trends
- **Resource Planning**: Better understanding of specialist involvement

## Advanced Features

### Migration Handling

Special support for large changes:
- Override normal file/line limits with `migration` label
- Enhanced review requirements for data migrations
- Rollback strategy validation
- Performance impact assessment

### Pattern Switching

Support for different collaboration patterns:
- **Lead-Specialists**: Lead orchestrates, specialists validate
- **Peer-to-Peer**: Specialists can initiate and cross-review
- **Pipeline**: Sequential stages with quality gates
- **Single Agent**: Simplified for small projects

### Integration Points

The system integrates with:
- **GitHub Actions**: Automated workflow execution
- **Branch Protection**: Enforceable status checks
- **CODEOWNERS**: Automatic reviewer assignment
- **Issue Templates**: Consistent problem reporting
- **Project Boards**: Status tracking and workflow visualization

## Monitoring & Metrics

### Quality Metrics

Track governance effectiveness:
- PR template compliance rates
- Specialist review coverage
- Change limit adherence
- Time to approval/merge

### Team Metrics

Understand team performance:
- Specialist workload distribution
- Review cycle times
- Change complexity trends
- Quality issue rates

### Project Health

Monitor overall project health:
- Technical debt accumulation
- Security compliance status
- Performance trend analysis
- Documentation coverage

## Customization Examples

### Startup Project
```yaml
limits:
  max_files_changed: 15    # Smaller changes, faster iteration
  max_lines_changed: 400   # Keep changes focused

# Simplified specialist requirements
agents:
  fe:
    rules:
      - basic accessibility check
      - component tests for logic
  be:
    rules:
      - API documentation updated
      - basic error handling
```

### Enterprise Project
```yaml
limits:
  max_files_changed: 8     # Stricter limits
  max_lines_changed: 200   # Very focused changes

# Enhanced requirements
agents:
  fe:
    rules:
      - WCAG 2.1 AAA compliance required
      - Performance budget strictly enforced
      - Security review for all user inputs
  be:
    rules:
      - OpenAPI spec mandatory
      - Comprehensive integration tests
      - Security audit for all changes
```

## Troubleshooting

### Common Issues

**Agent Not Assigned**:
- Check file patterns in routing heuristics
- Verify agents.yaml syntax
- Review changed file paths

**Workflow Failures**:
- Ensure agents.yaml exists in project
- Check GitHub token permissions
- Validate workflow syntax

**Specialist Conflicts**:
- Lead agent mediates disagreements
- Escalate to project management if needed
- Document decisions in ADRs

### Support Resources

- **Agent Documentation**: Detailed guidelines for each specialist
- **Example Configurations**: Templates for different project types
- **Migration Guide**: Steps for adopting governance system
- **Best Practices**: Proven patterns from successful implementations

## Contributing

To improve this governance system:

1. **Agent Guidelines**: Enhance specialist documentation
2. **Workflow Logic**: Improve routing and validation rules
3. **Templates**: Add project-specific configuration examples
4. **Integration**: Extend compatibility with other tools

See `CONTRIBUTING.md` for detailed contribution guidelines.

---

## Quick Reference

### Essential Files
- `agents.yaml`: Project configuration
- `.github/workflows/governance.yml`: Workflow trigger
- `.github/pull_request_template.md`: PR structure

### Key Commands
```bash
# Test routing locally
node scripts/agent-router.js file1.tsx file2.ts

# Validate agents.yaml
npm run validate:config

# Generate project documentation
npm run docs:generate
```

### Support
- **Documentation**: `/docs/agents/` for specialist guidelines
- **Examples**: `/examples/` for configuration templates
- **Issues**: GitHub issues for bug reports and feature requests