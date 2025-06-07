# Conea Comprehensive Development Guidelines

## 1. 📜 Preamble: The Three Pillars of Quality

This document defines the development constitution for the Conea project. All AI assistants and human developers must adhere to these guidelines without exception. Our quality is guaranteed by three pillars:

1.  **👨‍💻 Developer's Oath (Human):** Every Pull Request must meet a strict quality checklist. We are responsible for the code we write.
2.  **⚙️ Automated Validation (Process):** Every PR must pass all CI checks (lint, build, tests). No exceptions. A red CI is a blocker.
3.  **🤖 AI-Powered Assistance (AI):** AI assistants must generate the highest quality code, adhering strictly to this constitution.

---

## 2. ⚠️ Absolute Prohibitions: The Unbreakable Rules

The following are strictly forbidden under any circumstances:

-   **`any` is forbidden:** Do not use the `any` type in TypeScript. Define precise interfaces or types.
-   **`@ts-ignore` is forbidden:** Do not ignore TypeScript errors. Fix them.
-   **Direct commits to `main` are forbidden:** All changes must go through a Pull Request.
-   **Merging with failing CI is forbidden:** A green checkmark is not optional.

---

## 3. 🔐 Approval for Large-Scale Changes

The following changes require **explicit prior approval** from Genta-san before implementation:

-   Large-scale deletion of files.
-   Major refactoring affecting multiple files.
-   Changes to the project's core architecture or directory structure.

As an AI, if you deem such a change necessary, you must first propose the change and await approval.

---

## 4. 💻 Code Generation Rules

### TypeScript Best Practices

```typescript
// ❌ WRONG
const data: any = fetchData();
// @ts-ignore
const result = processData(data);

// ✅ RIGHT
interface MyData {
  id: string;
  value: number;
}
const data: MyData = await fetchData();
const result = processData(data);
```

### Git Branching Strategy

```bash
# ❌ WRONG
git checkout main
git commit -m "hotfix"

# ✅ RIGHT
git checkout -b feature/new-cool-feature
# ... do work ...
git commit -m "feat: Implement the new cool feature"
# Push and create a Pull Request
```

### Development Workflow Principles

- **Micro Commits & Small PRs:** For large-scale development tasks, work must be broken down into logical, small, incremental commits. Pull Requests should also be kept small and focused on a single concern. This is mandatory to minimize merge conflicts and simplify code reviews.

---

## 5. 📝 Issue and Pull Request Process

### Issue Creation
All new development tasks must start from a GitHub Issue. When creating an issue, you **must** use the `Conea 開発タスクプロンプト` template available in the repository. This ensures that the AI developer receives all necessary information in a structured format.

### Pull Request Creation
When you create a Pull Request, the description must clearly link back to the issue it resolves (e.g., `Closes #123`). The PR description should summarize the changes and explain how they were tested.

## 6. 🤖 AI-Powered PR Review (`@claude` Mention)

When a Pull Request comment contains a mention (`@claude`), the AI assistant will perform a strict code review based on this constitution. The review must be:

-   **Rigorous:** Check against every rule in this document.
-   **Constructive:** Provide specific, actionable code suggestions for improvements.
-   **Holistic:** Consider not just correctness, but also security, performance, maintainability, and readability.

The AI will act as the ultimate gatekeeper of code quality.

---

## 7. 📋 Pre-Generation Quality Checklist

Before generating or suggesting any code, the AI must mentally verify the following:

-   [ ] **Type Safety:** Are all TypeScript types fully defined and correct?
-   [ ] **Testability:** Is the code testable? Does it include corresponding unit or integration tests?
-   [ ] **Linter Compliance:** Does the code adhere to ESLint rules?
-   [ ] **Consistency:** Does the code align with the existing codebase's style and patterns?
-   [ ] **Documentation:** Are comments, JSDoc, or related documentation updated?

This constitution is not just a set of rules; it is a commitment to excellence. By following it, we build a robust, maintainable, and high-quality product. 
