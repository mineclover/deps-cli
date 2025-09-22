# Implementation Plan: File-based Dependency Analysis Module

**Branch**: `001-treesitter` | **Date**: 2025-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/junwoobang/project/effect-cli/specs/001-treesitter/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary
This feature introduces a standalone, parallelizable code parsing module using `tree-sitter`. As per the project roadmap, its primary responsibility is to take a source file, generate an Abstract Syntax Tree (AST), and provide a mechanism to extract configured language constructs (like dependencies). This serves as a foundational component for all future code analysis tasks.

## Technical Context
**User Input**: "로드맵에서 언급된 것 처럼 병렬화 가능한 코드 파서를 만들면 되고 ast 출력을 결과로 식별하면 됨" (As mentioned in the roadmap, create a parallelizable code parser, and identify the AST output as the result).

**Language/Version**: TypeScript (from project context)
**Primary Dependencies**: `tree-sitter`, `tree-sitter-typescript`
**Storage**: N/A
**Testing**: `vitest` (from project context)
**Target Platform**: Node.js
**Project Type**: single
**Performance Goals**: [NEEDS CLARIFICATION: A specific target like 10,000 lines/sec per core should be defined.]
**Constraints**: The parsing mechanism MUST be parallelizable to handle large codebases efficiently.
**Scale/Scope**: The initial implementation will focus exclusively on parsing TypeScript files.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (The parser will be a new library within the existing `src/services` structure)
- Using framework directly? Yes, `tree-sitter` will be used directly.
- Single data model? Yes, as defined in `data-model.md`.
- Avoiding patterns? Yes, no complex patterns like Repository/UoW are needed.

**Architecture**:
- EVERY feature as library? Yes, this will be a self-contained service.
- Libraries listed: `CodeParser` (Parses source files into an AST).
- CLI per library: Not directly, but will be used by other CLI commands.
- Library docs: N/A for this internal service.

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes.
- Git commits show tests before implementation? Yes.
- Order: Contract→Integration→Unit will be followed.
- Real dependencies used? Yes.
- Integration tests for: The new `CodeParser` library contract.

**Observability**:
- Structured logging included? Yes, will be added.

**Versioning**:
- Version number assigned? N/A for internal service.

## Project Structure

### Documentation (this feature)
```
specs/001-treesitter/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── ICodeParser.ts
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── services/
│   └── CodeParser/
│       ├── index.ts
│       ├── ICodeParser.ts       # Contract
│       ├── CodeParser.ts        # Implementation
│       └── worker.ts            # Parallel worker logic
└── ...

tests/
├── contract/
│   └── CodeParser.contract.test.ts
├── integration/
│   └── CodeParser.integration.test.ts
└── unit/
    └── CodeParser.unit.test.ts
```

**Structure Decision**: Option 1

## Phase 0: Outline & Research
Research has been completed and documented in `research.md`. Key decisions include using `worker_threads` for parallelization and the official `tree-sitter-typescript` grammar.

**Output**: [research.md](./research.md)

## Phase 1: Design & Contracts
Design artifacts have been generated based on the feature specification and research.

**Outputs**:
- [data-model.md](./data-model.md)
- [contracts/ICodeParser.ts](./contracts/ICodeParser.ts)
- [quickstart.md](./quickstart.md)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base.
- Generate tasks from the Phase 1 design artifacts.
- **T01**: Setup `tree-sitter` and `tree-sitter-typescript` dependencies.
- **T02**: Create contract test file `CodeParser.contract.test.ts` to validate the `ICodeParser` interface. This test MUST fail initially.
- **T03**: Implement the basic `CodeParser` service structure in `src/services/CodeParser/` to satisfy the contract test.
- **T04**: Create integration test file `CodeParser.integration.test.ts` for parsing a single, valid TypeScript file.
- **T05**: Implement the single-file parsing logic in `CodeParser.ts` to make the integration test pass.
- **T06**: Add integration tests for parallel parsing using `parseMany`.
- **T07**: Implement the `worker_threads` logic in `worker.ts` and `CodeParser.ts` to enable parallel parsing.
- **T08**: Add unit tests for specific edge cases (e.g., file not found, syntax errors).

**Ordering Strategy**:
- TDD order: Tests will be written before implementation for each major piece of functionality (contract, single-file, parallel).
- Dependency order: Core service first, then parallelization layer.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md)
**Phase 5**: Validation (run tests, execute quickstart.md)

## Complexity Tracking
No constitutional violations identified that require justification.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved (except performance goals, which is acceptable for now)
- [x] Complexity deviations documented: None

---
