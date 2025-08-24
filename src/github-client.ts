import { Octokit } from '@octokit/rest';
import { paginateRest } from '@octokit/plugin-paginate-rest';

const MyOctokit = Octokit.plugin(paginateRest);

export interface PullRequestData {
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  draft: boolean;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
    description: string | null;
  }>;
  milestone: {
    title: string;
    state: string;
  } | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  html_url: string;
  body: string | null;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  mergeable: boolean | null;
  mergeable_state: string;
  requested_reviewers: Array<{
    login: string;
  }>;
  requested_teams: Array<{
    name: string;
  }>;
}

export interface Comment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  app: {
    name: string;
  } | null;
}

export interface Status {
  state: string;
  context: string;
  description: string | null;
  target_url: string | null;
  created_at: string;
}

export class GitHubClient {
  private octokit: InstanceType<typeof MyOctokit>;

  constructor(token: string) {
    console.error(`[GitHubClient] Initializing with token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
    console.error(`[GitHubClient] Token length: ${token.length}`);
    console.error(`[GitHubClient] Token starts with: ${token.substring(0, 4)}`);
    
    this.octokit = new MyOctokit({
      auth: token,
      userAgent: 'github-mcp-server/0.1.0',
      request: {
        timeout: 30000,
      },
    });
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<PullRequestData[]> {
    try {
      console.error(`[GitHubClient] Fetching PRs for ${owner}/${repo} with state: ${state}`);
      
      const pullRequests = await this.octokit.paginate(
        this.octokit.rest.pulls.list,
        {
          owner,
          repo,
          state,
          per_page: 100,
          sort: 'updated',
          direction: 'desc'
        }
      );
      
      console.error(`[GitHubClient] Found ${pullRequests.length} PRs`);

      const detailedPRs: PullRequestData[] = [];

      for (const pr of pullRequests) {
        const detailed = await this.octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: pr.number,
        });

        detailedPRs.push({
          number: detailed.data.number,
          title: detailed.data.title,
          state: detailed.data.state,
          created_at: detailed.data.created_at,
          updated_at: detailed.data.updated_at,
          closed_at: detailed.data.closed_at,
          merged_at: detailed.data.merged_at,
          draft: detailed.data.draft || false,
          user: {
            login: detailed.data.user?.login || 'unknown',
            avatar_url: detailed.data.user?.avatar_url || '',
            html_url: detailed.data.user?.html_url || '',
          },
          assignees: detailed.data.assignees?.map(a => ({
            login: a.login,
            avatar_url: a.avatar_url,
          })) || [],
          labels: detailed.data.labels.map(l => ({
            name: typeof l === 'string' ? l : l.name || '',
            color: typeof l === 'string' ? '' : l.color || '',
            description: typeof l === 'string' ? null : l.description || null,
          })),
          milestone: detailed.data.milestone ? {
            title: detailed.data.milestone.title,
            state: detailed.data.milestone.state,
          } : null,
          head: {
            ref: detailed.data.head.ref,
            sha: detailed.data.head.sha,
          },
          base: {
            ref: detailed.data.base.ref,
            sha: detailed.data.base.sha,
          },
          html_url: detailed.data.html_url,
          body: detailed.data.body,
          comments: detailed.data.comments,
          review_comments: detailed.data.review_comments,
          commits: detailed.data.commits,
          additions: detailed.data.additions,
          deletions: detailed.data.deletions,
          changed_files: detailed.data.changed_files,
          mergeable: detailed.data.mergeable,
          mergeable_state: detailed.data.mergeable_state,
          requested_reviewers: detailed.data.requested_reviewers?.map(r => ({
            login: typeof r === 'string' ? r : r.login,
          })) || [],
          requested_teams: detailed.data.requested_teams?.map(t => ({
            name: t.name,
          })) || [],
        });
      }

      return detailedPRs;
    } catch (error) {
      console.error('[GitHubClient] Error fetching pull requests:', error);
      if (error instanceof Error) {
        console.error('[GitHubClient] Error message:', error.message);
        console.error('[GitHubClient] Error stack:', error.stack);
      }
      if (error && typeof error === 'object' && 'status' in error) {
        console.error('[GitHubClient] HTTP Status:', (error as any).status);
        console.error('[GitHubClient] Response:', (error as any).response?.data);
      }
      throw error;
    }
  }

  async getPullRequestComments(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<Comment[]> {
    try {
      const issueComments = await this.octokit.paginate(
        this.octokit.rest.issues.listComments,
        {
          owner,
          repo,
          issue_number: pullNumber,
          per_page: 100,
        }
      );

      const reviewComments = await this.octokit.paginate(
        this.octokit.rest.pulls.listReviewComments,
        {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        }
      );

      const allComments: Comment[] = [
        ...issueComments.map(c => ({
          id: c.id,
          user: {
            login: c.user?.login || 'unknown',
            avatar_url: c.user?.avatar_url || '',
          },
          body: c.body || '',
          created_at: c.created_at,
          updated_at: c.updated_at,
          html_url: c.html_url,
        })),
        ...reviewComments.map(c => ({
          id: c.id,
          user: {
            login: c.user?.login || 'unknown',
            avatar_url: c.user?.avatar_url || '',
          },
          body: c.body,
          created_at: c.created_at,
          updated_at: c.updated_at,
          html_url: c.html_url,
        })),
      ];

      return allComments.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  async getCheckRuns(
    owner: string,
    repo: string,
    ref: string
  ): Promise<CheckRun[]> {
    try {
      const checkRuns = await this.octokit.paginate(
        this.octokit.rest.checks.listForRef,
        {
          owner,
          repo,
          ref,
          per_page: 100,
        }
      );

      return checkRuns.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        started_at: run.started_at,
        completed_at: run.completed_at,
        html_url: run.html_url,
        app: run.app ? {
          name: run.app.name,
        } : null,
      }));
    } catch (error) {
      console.error('Error fetching check runs:', error);
      return [];
    }
  }

  async getStatuses(
    owner: string,
    repo: string,
    ref: string
  ): Promise<Status[]> {
    try {
      const statuses = await this.octokit.paginate(
        this.octokit.rest.repos.listCommitStatusesForRef,
        {
          owner,
          repo,
          ref,
          per_page: 100,
        }
      );

      return statuses.map(status => ({
        state: status.state,
        context: status.context,
        description: status.description,
        target_url: status.target_url,
        created_at: status.created_at,
      }));
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return [];
    }
  }
}