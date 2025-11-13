# Create Upstream Pull Request with Changelog

This document provides a comprehensive guide for AI agents to create upstream pull requests with proper changelog documentation.

## Overview

This process involves:
1. Analyzing current changes since the last commit
2. Updating the project changelog
3. Committing all changes with proper documentation
4. Pushing changes to origin
5. Creating an upstream pull request

## Prerequisites

- Git repository with `origin` (fork) and `upstream` (main repository) remotes configured
- GitHub MCP server available for PR creation
- Write access to the fork repository
- Existing `CHANGELOG.md` file (or ability to create one)

## Step-by-Step Process

### 0. Pre-Flight Review Check

Before proceeding with PR creation, check if a recent code review exists:

```bash
# List review files sorted by date (newest first)
ls -lt ai_docs/review/ | head -5
```

**Review Analysis Steps:**
1. Identify the latest review file (format: `review_YYYY-MM-DD_HHMM.md`)
2. Read the review file to understand what changes it covers
3. Compare the reviewed files with current git status:
   ```bash
   git status
   git diff --stat HEAD
   ```

**Decision Point:**
- If the latest review clearly covers the current changes (same files, recent date), proceed to Step 1
- If the review is outdated or doesn't cover current changes, ask the user:

```markdown
The latest code review ([`ai_docs/review/review_YYYY-MM-DD_HHMM.md`](ai_docs/review/review_YYYY-MM-DD_HHMM.md)) appears to be for different changes or is outdated.

Current changes include:
- [List of modified/new files from git status]

Would you like to run a push review before creating the PR?
```

**User Response Handling:**
- If user wants a review: Conclude the task (they should run the review command first)
- If user wants to proceed without review: Continue to Step 1

### 1. Analyze Current Changes

First, understand what changes have been made since the last commit:

```bash
# Check current git status
git status

# View detailed diff statistics
git diff --stat HEAD

# Check for untracked files
git ls-files --others --exclude-standard

# Review recent commits for context
git log --oneline -5
```

**Key Information to Gather:**
- Modified files and line count changes
- New files created
- Files deleted
- Untracked files that should be included

### 2. Update Changelog

#### Check for Existing Changelog
```bash
ls -la | grep -i change
```

#### Read Current Changelog Format
Use `read_file` tool to understand the existing format and structure.

#### Update Changelog Structure
- Move previous "Unreleased" section to "Released" with appropriate date
- Create new "Unreleased" section with current date
- Document changes in categories:
  - **Added**: New features and components
  - **Changed**: Modifications to existing functionality
  - **Fixed**: Bug fixes and corrections
  - **Removed**: Deleted files and deprecated features

#### Changelog Entry Format
```markdown
## [Unreleased] - YYYY-MM-DD

### Added
- **Feature Name**: [`filename.ext`](path/to/file) - Description of what was added
- **Component Description**: Detailed explanation with file references

### Changed
- **Enhancement Description**: [`filename.ext`](path/to/file) - What was modified and why
- **Refactoring Details**: Specific improvements made

### Removed
- **Cleanup Description**: List of files removed and reason
```

### 3. Stage and Commit Changes

```bash
# Stage all changes including new files
git add .

# Verify what's staged
git status

# Create comprehensive commit message
git commit -m "Descriptive title

- Bullet point summary of major changes
- Include line count statistics for significant modifications
- Reference new components and files created
- Note cleanup and removal of temporary files
- Mention changelog updates

Detailed description of the impact and improvements made."
```

### 4. Push to Origin

```bash
# Push changes to your fork
git push origin main
```

### 5. Create Upstream Pull Request

Use the GitHub MCP server to create the PR:

```json
{
  "server_name": "github",
  "tool_name": "create_pull_request",
  "arguments": {
    "owner": "upstream-owner",
    "repo": "repository-name",
    "title": "Descriptive PR Title",
    "body": "Comprehensive PR description",
    "head": "your-fork:main",
    "base": "main"
  }
}
```

## Pull Request Description Template

```markdown
## Overview

Brief description of what this PR accomplishes.

## Key Changes

### 🔧 Enhanced Functionality
- **Component Name**: Description of improvements with line count
- **Feature Enhancement**: What was added or improved

### 🎨 UI/UX Improvements
- **Interface Changes**: Description of UI modifications
- **User Experience**: How the changes improve usability

### ⚙️ Configuration Updates
- **Settings**: New configuration options added
- **Environment**: Updates to environment files

### 🧹 Cleanup
- **File Removal**: Temporary files and debugging artifacts removed
- **Code Organization**: Structural improvements made

### 📝 Documentation
- **Changelog**: Updated with comprehensive change documentation
- **Comments**: Improved code documentation

## Impact

Explain how these changes improve the system:
- Performance improvements
- Better user experience
- Enhanced maintainability
- Bug fixes and stability

## Testing

- Describe testing performed
- Mention preserved functionality
- Note any new test files created

## Files Changed

**Modified Files:**
- `path/to/file.ext` (+X lines) - Description
- `another/file.ext` (-Y lines) - Description

**New Files:**
- `new/component.ext` - Purpose and functionality
- `another/new/file.ext` - What it provides

**Removed Files:**
- `old/debug/file.ext` - Reason for removal
- `temp/file.ext` - Cleanup rationale

## Summary

Conclude with the overall benefit and impact of the changes.
```

## Best Practices

### Changelog Management
1. **Be Specific**: Include file paths and line count statistics
2. **Use Categories**: Organize changes into Added, Changed, Fixed, Removed
3. **Link Files**: Use markdown links to reference specific files
4. **Date Properly**: Use YYYY-MM-DD format for dates
5. **Move Sections**: Always move previous unreleased to released when creating new unreleased

### Commit Messages
1. **Descriptive Title**: Clear, concise summary of changes
2. **Detailed Body**: Bullet points with specific improvements
3. **Impact Statement**: Explain the benefit of the changes
4. **Statistics**: Include line count changes for major modifications

### Pull Request Creation
1. **Comprehensive Description**: Use the template above
2. **Clear Sections**: Organize information logically
3. **Impact Analysis**: Explain benefits and improvements
4. **File Summary**: List all changed, new, and removed files
5. **Testing Notes**: Mention testing performed and functionality preserved

## Error Handling

### Common Issues
- **Merge Conflicts**: Ensure your branch is up to date with upstream
- **Missing Files**: Check for untracked files that should be included
- **Changelog Format**: Maintain consistent formatting with existing entries
- **Remote Configuration**: Verify upstream and origin remotes are correct

### Verification Steps
1. Check git status shows clean working directory after commit
2. Verify push was successful with no errors
3. Confirm PR was created and is visible on GitHub
4. Review PR description renders correctly with markdown formatting

## Example Usage

This process was successfully used to create PR #9 for the specialist report card matrix layout refactor, which included:
- 14 files changed (1,168 insertions, 677 deletions)
- Comprehensive changelog updates
- Detailed PR description with impact analysis
- Proper categorization of all changes

## Tools Required

- `execute_command` - For git operations
- `read_file` - For reading existing changelog
- `write_to_file` or `apply_diff` - For updating changelog
- `use_mcp_tool` with GitHub server - For creating PR
- `update_todo_list` - For tracking progress (optional)

## Success Criteria

- [ ] Pre-flight review check completed (latest review verified or user confirmed to proceed)
- [ ] All changes properly documented in changelog
- [ ] Commit includes comprehensive message with statistics
- [ ] Changes successfully pushed to origin
- [ ] Upstream PR created with detailed description
- [ ] PR includes proper file change summary
- [ ] All temporary and debug files cleaned up
- [ ] Documentation reflects current state of changes