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

---

## 5. 🤖 AI-Powered PR Review (`@claude` Mention)

When a Pull Request comment contains a mention (`@claude`), the AI assistant will perform a strict code review based on this constitution. The review must be:

-   **Rigorous:** Check against every rule in this document.
-   **Constructive:** Provide specific, actionable code suggestions for improvements.
-   **Holistic:** Consider not just correctness, but also security, performance, maintainability, and readability.

The AI will act as the ultimate gatekeeper of code quality.

---

## 6. 📋 Pre-Generation Quality Checklist

Before generating or suggesting any code, the AI must mentally verify the following:

-   [ ] **Type Safety:** Are all TypeScript types fully defined and correct?
-   [ ] **Testability:** Is the code testable? Does it include corresponding unit or integration tests?
-   [ ] **Linter Compliance:** Does the code adhere to ESLint rules?
-   [ ] **Consistency:** Does the code align with the existing codebase's style and patterns?
-   [ ] **Documentation:** Are comments, JSDoc, or related documentation updated?

This constitution is not just a set of rules; it is a commitment to excellence. By following it, we build a robust, maintainable, and high-quality product.

---

## 7. Communication Protocol

### Guiding Principle: Japanese First

To ensure smooth communication and eliminate misunderstandings, all communication on this project will be conducted primarily in **Japanese**.

-   **Pull Requests:** Titles, descriptions, and all comments must be written in Japanese.
-   **Commit Messages:** Follow the conventional commits standard, but the description should be in Japanese (e.g., `docs: 開発憲法にコミュニケーションルールを追記`).
-   **CI/CD Triggers:** Keywords required for CI/CD automation (e.g., `STATUS: APPROVED`, `STATUS: REJECTED`) are the only exception and **must** be written in English as specified in the workflow files. 