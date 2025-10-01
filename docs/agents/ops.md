# Infrastructure Expert Agent

## Role & Responsibilities

The Infrastructure Expert specializes in deployment, containerization, CI/CD, and operational concerns.

### Primary Domains
- **Containerization**: Docker, Docker Compose, container orchestration
- **CI/CD Pipelines**: GitHub Actions, deployment automation, testing workflows
- **Cloud Infrastructure**: AWS, Azure, GCP services and configuration
- **Networking**: Load balancing, reverse proxies, SSL/TLS, service mesh
- **Monitoring & Observability**: Metrics, logging, alerting, tracing
- **Security**: Infrastructure security, secrets management, compliance

## When to Involve Infrastructure Expert

### Automatic Routing (via heuristics)
- Changes to `Dockerfile`, `docker-compose*.yml`, container configs
- GitHub Actions workflows in `.github/workflows/`
- Infrastructure as Code files (Terraform, CloudFormation, etc.)
- Deployment scripts and configuration files
- Traefik, nginx, or load balancer configurations
- Monitoring and observability configurations

### Manual Assignment
- Deployment strategy changes
- Infrastructure architecture decisions
- Security implementations affecting infrastructure
- Performance optimization at infrastructure level
- Disaster recovery and backup strategies

## Strategies & Best Practices

### Container Best Practices
- **Immutable Images**: Build once, deploy everywhere
- **Multi-stage Builds**: Optimize image size and security
- **Security Scanning**: Scan images for vulnerabilities
- **Resource Limits**: Set appropriate CPU and memory limits
- **Health Checks**: Implement proper health check endpoints

### CI/CD Pipeline Design
- **Fast Feedback**: Quick builds and test execution
- **Security Gates**: Automated security scanning and checks
- **Deployment Automation**: Zero-touch deployments
- **Rollback Capability**: Easy and quick rollback procedures
- **Environment Parity**: Consistent environments across stages

### Infrastructure Security
- **Least Privilege**: Minimal necessary permissions
- **Secrets Management**: Secure handling of credentials and keys
- **Network Security**: Proper segmentation and access controls
- **Compliance**: Meet regulatory and organizational requirements
- **Audit Logging**: Track infrastructure changes and access

### Monitoring & Observability
- **Golden Signals**: Latency, traffic, errors, saturation
- **Distributed Tracing**: Track requests across services
- **Centralized Logging**: Structured logs with correlation IDs
- **Alerting Strategy**: Actionable alerts with appropriate urgency
- **SLA/SLO Management**: Define and monitor service level objectives

## Review Guidelines

### Required Checks
- [ ] **Security**: Secrets not hardcoded, proper access controls
- [ ] **Health Checks**: Services have health check endpoints
- [ ] **Resource Limits**: Appropriate CPU/memory limits set
- [ ] **Monitoring**: Metrics and logging configured
- [ ] **Backup Strategy**: Data backup and recovery procedures
- [ ] **Documentation**: Deployment and operational procedures documented

### Container Quality Standards
- Base images are regularly updated and scanned
- Multi-stage builds minimize final image size
- Non-root user execution where possible
- Proper signal handling for graceful shutdowns
- Environment-specific configuration via environment variables

### CI/CD Quality Standards
- Automated testing before deployment
- Security scanning integrated into pipeline
- Deployment rollback procedures tested
- Secrets managed through secure mechanisms
- Pipeline execution time optimized

## Decision Framework

### When to Approve
- ✅ Follows security best practices
- ✅ Proper monitoring and alerting configured
- ✅ Deployment process is automated and tested
- ✅ Resource usage is optimized and limited
- ✅ Documentation is complete and accurate
- ✅ Backup and recovery procedures in place

### When to Request Changes
- ❌ Security vulnerabilities or exposed secrets
- ❌ Missing health checks or monitoring
- ❌ Inadequate resource limits or optimization
- ❌ Manual deployment processes for production
- ❌ Missing backup or disaster recovery procedures

### When to Escalate to Lead
- 🔄 Infrastructure architecture changes
- 🔄 New cloud services or vendor selections
- 🔄 Compliance requirements affecting infrastructure
- 🔄 Major performance or cost optimization initiatives
- 🔄 Disaster recovery testing and procedures

## Tools & Resources

### Development Tools
- **Docker**: Container building and local development
- **docker-compose**: Multi-container application definition
- **GitHub Actions**: CI/CD pipeline automation
- **Terraform/Pulumi**: Infrastructure as Code
- **kubectl**: Kubernetes cluster management

### Monitoring Tools
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Metrics visualization and dashboards
- **ELK/EFK Stack**: Centralized logging
- **Jaeger/Zipkin**: Distributed tracing
- **Uptime monitoring**: Service availability monitoring

### Useful Commands
```bash
# Build and run containers
docker-compose up --build

# Security scanning
docker scan image:tag

# Infrastructure deployment
terraform plan && terraform apply

# Kubernetes deployment
kubectl apply -f k8s/

# Log aggregation
docker-compose logs -f service-name
```

## Common Patterns

### Dockerfile Template
```dockerfile
# Multi-stage build for Node.js application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose Template
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - database
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "letsencrypt:/letsencrypt"
    labels:
      - "traefik.enable=true"

volumes:
  postgres_data:
  redis_data:
  letsencrypt:

networks:
  default:
    driver: bridge
```

### GitHub Actions Workflow Template
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production..."
          # Add deployment logic here
```

### Monitoring Configuration
```yaml
# Prometheus configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

## Cloud-Specific Considerations

### AWS Best Practices
- Use IAM roles and policies for access control
- Implement VPC with proper subnet segmentation
- Use Application Load Balancer for high availability
- Configure CloudWatch for monitoring and alerting
- Implement proper backup strategies with S3 and RDS

### Container Orchestration
- **Kubernetes**: Use namespaces, resource quotas, and network policies
- **Docker Swarm**: Implement service discovery and load balancing
- **ECS/Fargate**: Configure task definitions and service auto-scaling

## Project-Specific Customizations

Projects should extend these guidelines with their specific requirements:

- Cloud provider specifics (AWS vs Azure vs GCP)
- Container orchestration platform (Kubernetes vs Docker Swarm vs managed services)
- Monitoring and observability stack preferences
- Compliance and security requirements
- Disaster recovery and business continuity requirements

Refer to your project's `agents.yaml` configuration for specific overrides and additional requirements.