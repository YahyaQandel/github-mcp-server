#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GitHubClient, PullRequestData, Comment, CheckRun, Status } from './github-client.js';
import dotenv from 'dotenv';

dotenv.config();

interface PullRequestWithDetails extends PullRequestData {
  comments_list?: Comment[];
  check_runs?: CheckRun[];
  statuses?: Status[];
}

class GitHubMCPServer {
  private server: Server;
  private githubClient: GitHubClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize GitHub client with environment token if available
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      console.error(`[GitHubMCPServer] Initializing with environment token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
      this.githubClient = new GitHubClient(token);
    } else {
      console.error('[GitHubMCPServer] No GITHUB_TOKEN environment variable found - token must be set manually');
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log("Receiving request for tool:", name);
      try {
        switch (name) {
          case 'github_set_token':
            return await this.setToken(args as { token: string });
          
          case 'github_list_pull_requests':
            console.log("Listing pull requests...")
            return await this.listPullRequests(args as {
              owner: string;
              repo: string;
              state?: 'open' | 'closed' | 'all';
              include_comments?: boolean;
              include_checks?: boolean;
            });
          
          case 'github_get_pr_comments':
            return await this.getPRComments(args as {
              owner: string;
              repo: string;
              pull_number: number;
            });
          
          case 'github_get_pr_checks':
            return await this.getPRChecks(args as {
              owner: string;
              repo: string;
              pull_number: number;
            });

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private getTools() {
    return [
      {
        name: 'github_set_token',
        description: 'Set the GitHub personal access token for authentication',
        inputSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'GitHub personal access token',
            },
          },
          required: ['token'],
        },
      },
      {
        name: 'github_list_pull_requests',
        description: 'List all pull requests in a repository with full details including creator, labels, and optionally comments and pipeline status',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (user or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description: 'State of pull requests to fetch (default: all)',
              default: 'all',
            },
            include_comments: {
              type: 'boolean',
              description: 'Include all comments for each PR (may slow down the request)',
              default: false,
            },
            include_checks: {
              type: 'boolean',
              description: 'Include CI/CD check runs and status for each PR',
              default: false,
            },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'github_get_pr_comments',
        description: 'Get all comments (issue comments and review comments) for a specific pull request',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (user or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
          },
          required: ['owner', 'repo', 'pull_number'],
        },
      },
      {
        name: 'github_get_pr_checks',
        description: 'Get CI/CD check runs and status for a specific pull request',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (user or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
          },
          required: ['owner', 'repo', 'pull_number'],
        },
      },
    ];
  }

  private async setToken(args: { token: string }) {
    console.error(`[GitHubMCPServer] Setting token: ${args.token.substring(0, 10)}...${args.token.substring(args.token.length - 4)}`);
    console.error(`[GitHubMCPServer] Token length: ${args.token.length}`);
    
    this.githubClient = new GitHubClient(args.token);
    return {
      content: [
        {
          type: 'text',
          text: 'GitHub token set successfully',
        },
      ],
    };
  }

  private async listPullRequests(args: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    include_comments?: boolean;
    include_checks?: boolean;
  }) {
    console.error(`[GitHubMCPServer] listPullRequests called for ${args.owner}/${args.repo}`);
    
    if (!this.githubClient) {
      throw new Error('GitHub token not available. Set GITHUB_TOKEN environment variable or use github_set_token.');
    }

    const pullRequests = await this.githubClient.listPullRequests(
      args.owner,
      args.repo,
      args.state || 'all'
    );

    const detailedPRs: PullRequestWithDetails[] = [];

    for (const pr of pullRequests) {
      const detailed: PullRequestWithDetails = { ...pr };

      if (args.include_comments) {
        detailed.comments_list = await this.githubClient.getPullRequestComments(
          args.owner,
          args.repo,
          pr.number
        );
      }

      if (args.include_checks) {
        const [checkRuns, statuses] = await Promise.all([
          this.githubClient.getCheckRuns(args.owner, args.repo, pr.head.sha),
          this.githubClient.getStatuses(args.owner, args.repo, pr.head.sha),
        ]);
        detailed.check_runs = checkRuns;
        detailed.statuses = statuses;
      }

      detailedPRs.push(detailed);
    }

    const stateFilter = args.state || 'all';
    const filteredPRs = stateFilter === 'all' 
      ? detailedPRs 
      : stateFilter === 'open'
      ? detailedPRs.filter(pr => pr.state === 'open')
      : detailedPRs.filter(pr => pr.state === 'closed');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            total_count: filteredPRs.length,
            state_filter: stateFilter,
            pull_requests: filteredPRs,
          }, null, 2),
        },
      ],
    };
  }

  private async getPRComments(args: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    if (!this.githubClient) {
      throw new Error('GitHub token not available. Set GITHUB_TOKEN environment variable or use github_set_token.');
    }

    const comments = await this.githubClient.getPullRequestComments(
      args.owner,
      args.repo,
      args.pull_number
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            pull_request: args.pull_number,
            total_comments: comments.length,
            comments: comments,
          }, null, 2),
        },
      ],
    };
  }

  private async getPRChecks(args: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    if (!this.githubClient) {
      throw new Error('GitHub token not available. Set GITHUB_TOKEN environment variable or use github_set_token.');
    }

    const prs = await this.githubClient.listPullRequests(
      args.owner,
      args.repo,
      'all'
    );

    const pr = prs.find(p => p.number === args.pull_number);
    if (!pr) {
      throw new Error(`Pull request #${args.pull_number} not found`);
    }

    const [checkRuns, statuses] = await Promise.all([
      this.githubClient.getCheckRuns(args.owner, args.repo, pr.head.sha),
      this.githubClient.getStatuses(args.owner, args.repo, pr.head.sha),
    ]);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            pull_request: args.pull_number,
            head_sha: pr.head.sha,
            check_runs: checkRuns,
            statuses: statuses,
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[LOCAL] GitHub MCP Server running on stdio');
  }
}

const server = new GitHubMCPServer();
server.run().catch(console.error);