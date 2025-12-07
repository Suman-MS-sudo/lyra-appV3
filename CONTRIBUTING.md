# Contributing to Lyra App v3

Thank you for considering contributing to Lyra! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Add upstream remote: `git remote add upstream <original-repo-url>`
4. Create a branch: `git checkout -b feature/my-feature`

## Development Process

### 1. Before You Start

- Check existing issues and PRs to avoid duplicates
- Discuss major changes in an issue first
- Ensure you understand the project architecture

### 2. Making Changes

#### Code Quality Standards

- **TypeScript**: All code must be properly typed, no `any` unless absolutely necessary
- **Testing**: Add tests for new features, maintain >80% coverage
- **Linting**: Code must pass `npm run lint` without errors
- **Formatting**: Follow existing code style

#### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add/update tests
chore: maintenance tasks
```

Examples:
```
feat(products): add bulk import functionality
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
```

### 3. Testing Your Changes

```bash
# Run linter
npm run lint

# Run tests
npm test

# Check coverage
npm run test:coverage

# Build to verify no errors
npm run build
```

### 4. Submitting Changes

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: description of feature"
   ```

2. **Keep your fork updated**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Push to your fork**:
   ```bash
   git push origin feature/my-feature
   ```

4. **Create Pull Request**:
   - Use the PR template
   - Link related issues
   - Provide clear description
   - Add screenshots if UI changes

## Pull Request Guidelines

### PR Checklist

- [ ] Code follows project conventions
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Database migrations included (if applicable)
- [ ] Reviewed own code

### PR Requirements

- **Title**: Clear, descriptive, follows conventional commits
- **Description**: Explain what and why, not how
- **Testing**: Describe how to test the changes
- **Screenshots**: Include for UI changes
- **Breaking Changes**: Clearly documented

### Review Process

1. Automated checks must pass (CI/CD pipeline)
2. At least one maintainer review required
3. Address all review comments
4. Squash commits before merge (if requested)

## Project-Specific Guidelines

### Adding Database Changes

1. Create migration file:
   ```bash
   supabase migration new my_migration
   ```

2. Write SQL in `supabase/migrations/`

3. Include RLS policies for new tables

4. Test migration locally:
   ```bash
   supabase db reset
   ```

### Adding New Features

1. **Define Types**: Add to `src/types/index.ts`

2. **Create Validation Schemas**: Add to `src/lib/validations.ts`
   ```typescript
   export const mySchema = z.object({
     field: z.string().min(1),
   });
   ```

3. **Implement Server Actions**: Create in `src/app/actions/`
   ```typescript
   'use server';
   import { requireAdmin } from '@/lib/auth-helpers';
   // Implementation
   ```

4. **Add Tests**: Create test file
   ```typescript
   import { describe, it, expect } from 'vitest';
   // Tests
   ```

5. **Update Documentation**: Modify relevant docs

### Updating Dependencies

- Keep dependencies up to date
- Test thoroughly after updates
- Document breaking changes
- Update peer dependencies if needed

## Bug Reports

### Before Submitting

- Search existing issues
- Reproduce the bug
- Gather relevant information

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 20.10.0]

**Screenshots**
If applicable

**Additional Context**
Any other relevant information
```

## Feature Requests

### Before Submitting

- Check if feature already exists
- Ensure it aligns with project goals
- Consider implementation complexity

### Feature Request Template

```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Any other relevant information
```

## Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email security concerns to [security@lyra.app]
2. Include detailed description
3. Provide steps to reproduce
4. Wait for response before disclosure

## Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Fixing inaccuracies
- Improving clarity

### Documentation Files

- `README.md` - Overview and quick start
- `ARCHITECTURE.md` - System design
- `DEVELOPMENT.md` - Developer guide
- `DEPLOYMENT.md` - Deployment instructions
- `.github/copilot-instructions.md` - AI coding guidelines

## Testing Guidelines

### Test Coverage Requirements

- **Minimum**: 80% coverage
- **Utilities**: 100% coverage
- **Server Actions**: >90% coverage
- **Components**: >70% coverage

### Writing Good Tests

```typescript
describe('Feature Name', () => {
  // Group related tests
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupInput();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### What to Test

- ✅ Business logic
- ✅ Validation schemas
- ✅ Utility functions
- ✅ Server actions
- ✅ Error handling
- ❌ Third-party libraries
- ❌ Trivial getters/setters

## Style Guide

### TypeScript

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
}

async function getUser(id: string): Promise<User> {
  // Implementation
}

// ❌ Bad
function getUser(id: any) {
  // No return type, using any
}
```

### React Components

```typescript
// ✅ Good - Server Component
export default async function MyPage() {
  const data = await fetchData();
  return <div>{data.name}</div>;
}

// ✅ Good - Client Component
'use client';
export default function MyClientComponent() {
  const [state, setState] = useState('');
  return <button onClick={() => setState('new')}>{state}</button>;
}

// ❌ Bad - Unnecessary client component
'use client';
export default function StaticComponent() {
  return <div>Static content</div>; // Should be Server Component
}
```

### Error Handling

```typescript
// ✅ Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', error, { context });
  throw new AppError('User-friendly message');
}

// ❌ Bad
try {
  await riskyOperation();
} catch (error) {
  console.log(error); // Silent failure
}
```

## Questions?

- Open a discussion on GitHub
- Check existing documentation
- Ask in pull request comments
- Review previous issues/PRs

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Lyra! 🎉
