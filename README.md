# Enterprise Agent Framework

Enterprise-grade Agent Framework following core design principles and engineering capabilities.

## 🎯 Core Design Principles

### Code Architecture
- **Open-Closed Principle**: Extend open, modify closed - new tools/skills don't modify main dispatch logic
- **Dependency Inversion**: Depend on abstract interfaces, not concrete implementations
- **Single Responsibility**: Modules, tools, and skills have single, focused responsibilities
- **Interface Segregation**: Fine-grained, lightweight interfaces exposed as needed

### Enterprise Engineering Capabilities
1. **High Availability Architecture**: Circuit breaker, rate limiting, retry, timeout, fallback, model fallback
2. **Observability**: Full-chain logging, tool call tracking, token monitoring, latency metrics
3. **Configuration Driven**: Configurable skills/prompts/rules, zero-code extension
4. **Plugin SPI**: Dynamic loading of tools, roles, RAG libraries, plug-and-play
5. **Idempotency & Consistency**: Duplicate call prevention, distributed transactions, data security
6. **Security & Compliance**: Prompt injection defense, desensitization, permission control, privilege interception
7. **Performance Optimization**: Caching, async, batch calls, prompt optimization, vector store optimization
8. **Testability**: Mock tools, sandbox environment, automated regression testing

## 📁 Project Structure

```
src/
├── core/              # Core interfaces and types
│   ├── interfaces.ts  # Tool, Model, Agent, Skill interfaces
│   ├── types.ts       # Type definitions
│   └── constants.ts   # Constants
├── resilience/        # High availability
│   ├── circuit-breaker.ts
│   ├── rate-limiter.ts
│   ├── retry.ts
│   ├── timeout.ts
│   └── fallback.ts
├── observability/     # Observability
│   ├── logger.ts
│   ├── tracer.ts
│   ├── metrics.ts
│   └── monitor.ts
├── config/           # Configuration driven
│   ├── schema.ts
│   ├── loader.ts
│   └── registry.ts
├── spi/              # Plugin SPI
│   ├── plugin.ts
│   ├── loader.ts
│   └── registry.ts
├── security/         # Security & compliance
│   ├── sanitizer.ts
│   ├── validator.ts
│   ├── permissions.ts
│   └── interceptor.ts
├── optimization/     # Performance optimization
│   ├── cache.ts
│   ├── prompt-optimizer.ts
│   ├── batch.ts
│   └── vector-store.ts
├── agent.ts          # Agent main class
└── index.ts          # Unified exports

tests/                # Unit tests
config/              # Default configurations
examples/            # Usage examples
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:coverage
```

### Lint

```bash
npm run lint
npm run typecheck
```

## 📦 Module Overview

### Core Interfaces (`src/core/`)
- **Tool**: Abstract tool interface
- **Model**: Abstract model interface
- **Agent**: Core agent interface
- **Skill**: Skill interface
- **Middleware**: Middleware interface

### Resilience (`src/resilience/`)
- **CircuitBreaker**: Three-state circuit protection (CLOSED/OPEN/HALF_OPEN)
- **RateLimiter**: Fixed window, sliding window, token bucket, concurrency
- **Retry**: Fixed, linear, exponential, fibonacci backoff with jitter
- **Timeout**: Precise timeout management with AbortSignal support
- **Fallback**: Multi-level fallback strategies

### Observability (`src/observability/`)
- **Logger**: Structured logging with trace context
- **Tracer**: Distributed tracing with span management
- **Metrics**: Counter, Gauge, Histogram with P50/P95/P99
- **Monitor**: Health checks and performance reporting

### Config (`src/config/`)
- **Schema**: Zod validation and type checking
- **Loader**: Multi-source loading (defaults/file/env/remote)
- **Registry**: Namespace isolation and hot updates

### SPI (`src/spi/`)
- **Plugin**: Plugin interface with lifecycle management
- **Loader**: Dynamic import and sandbox isolation
- **Registry**: Plugin discovery and dependency management

### Security (`src/security/`)
- **Sanitizer**: Sensitive data masking
- **Validator**: Input validation (Prompt injection, SQL injection, XSS)
- **Permissions**: RBAC permission control
- **Interceptor**: Request/response interception

### Optimization (`src/optimization/`)
- **Cache**: LRU, LFU, TTL caching strategies
- **PromptOptimizer**: Token counting and compression
- **BatchProcessor**: Batch request merging
- **VectorStore**: Embedding optimization

## 🔧 Usage Example

```typescript
import { createAgent } from './src/agent';
import { Tool, Model } from './src/core/interfaces';

const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  async execute(params) {
    return { result: eval(params.expression) };
  }
};

const agent = createAgent({
  name: 'My Agent',
  model: mockModel,
  tools: [calculatorTool]
});

const result = await agent.execute('Calculate 2 + 3 * 4');
```

## 📊 Architecture Highlights

### Design Principles
- ✅ Open-Closed: SPI and middleware for extensibility
- ✅ Dependency Inversion: Abstract interfaces only
- ✅ Single Responsibility: Each module focused
- ✅ Interface Segregation: Fine-grained interfaces

### Engineering Excellence
- ✅ High Availability: Circuit breaker, rate limiting, retry, timeout, fallback
- ✅ Observability: Full-chain logging, tracing, metrics
- ✅ Configuration Driven: Zero-code extension
- ✅ Plugin Architecture: Dynamic loading
- ✅ Security First: Input validation, desensitization, RBAC
- ✅ Performance: Caching, batching, optimization
- ✅ Testable: Mock tools, sandbox, automated tests

## 📝 License

MIT
