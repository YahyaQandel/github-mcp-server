# GitHub MCP Server

A Model Context Protocol (MCP) server that provides comprehensive GitHub pull request data including comments, labels, pipeline status, and more.

## Features

- **Full PR Data**: Fetches complete pull request information including:
  - PR metadata (title, state, timestamps, draft status)
  - Creator/author information
  - Assignees and reviewers
  - Labels and milestones
  - File changes statistics
  - Merge status
  
- **Comments Support**: Retrieves all comments on pull requests:
  - Issue comments
  - Review comments
  - Sorted chronologically

- **Pipeline/CI Status**: Gets CI/CD pipeline information:
  - GitHub Check Runs (Actions, third-party CI)
  - Commit statuses
  - Completion status and conclusions

- **Pagination Support**: Automatically fetches ALL pull requests, not just the first page

- **Flexible Filtering**: Filter PRs by state (open, closed, or all)

## Installation

```bash
npm install
npm run build
```

## Configuration

1. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Generate a new token with `repo` scope (for private repos) or `public_repo` scope (for public repos)

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your GitHub token
   ```

## Usage with MCP Client

### Add to MCP Settings

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["path/to/github-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### Available Tools

#### 1. `github_set_token`
Set or update the GitHub authentication token at runtime.

**Parameters:**
- `token` (string, required): GitHub personal access token

#### 2. `github_list_pull_requests`
List all pull requests in a repository with comprehensive details.

**Parameters:**
- `owner` (string, required): Repository owner (user or organization)
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state - "open", "closed", or "all" (default: "all")
- `include_comments` (boolean, optional): Include all comments for each PR (default: false)
- `include_checks` (boolean, optional): Include CI/CD status for each PR (default: false)

**Example Response:**
```json
{
  "repository": "owner/repo",
  "total_count": 25,
  "state_filter": "all",
  "pull_requests": [
    {
      "number": 123,
      "title": "Add new feature",
      "state": "open",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "login": "developer",
        "avatar_url": "https://...",
        "html_url": "https://github.com/developer"
      },
      "labels": [
        {
          "name": "enhancement",
          "color": "a2eeef",
          "description": "New feature or request"
        }
      ],
      "assignees": [...],
      "comments": 5,
      "review_comments": 3,
      "check_runs": [...],
      "statuses": [...]
    }
  ]
}
```

#### 3. `github_get_pr_comments`
Get all comments for a specific pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pull_number` (number, required): Pull request number

**Example Response:**
```json
{
  "repository": "owner/repo",
  "pull_request": 123,
  "total_comments": 8,
  "comments": [
    {
      "id": 1234567,
      "user": {
        "login": "reviewer",
        "avatar_url": "https://..."
      },
      "body": "Great work! Just one suggestion...",
      "created_at": "2024-01-02T10:00:00Z",
      "html_url": "https://github.com/owner/repo/pull/123#issuecomment-1234567"
    }
  ]
}
```

#### 4. `github_get_pr_checks`
Get CI/CD check runs and status for a specific pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pull_number` (number, required): Pull request number

**Example Response:**
```json
{
  "repository": "owner/repo",
  "pull_request": 123,
  "head_sha": "abc123...",
  "check_runs": [
    {
      "id": 9876543,
      "name": "build",
      "status": "completed",
      "conclusion": "success",
      "started_at": "2024-01-02T10:00:00Z",
      "completed_at": "2024-01-02T10:05:00Z",
      "html_url": "https://github.com/owner/repo/actions/runs/9876543"
    }
  ],
  "statuses": [
    {
      "state": "success",
      "context": "continuous-integration/travis-ci",
      "description": "The Travis CI build passed",
      "target_url": "https://travis-ci.org/owner/repo/builds/12345"
    }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Requirements

- Node.js 18+
- GitHub Personal Access Token
- MCP-compatible client

## License

MIT