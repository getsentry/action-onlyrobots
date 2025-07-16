export declare function verifyWebhookSignature(body: string, signature: string | null, secret: string): Promise<boolean>;
export interface GitHubConfig {
    GITHUB_TOKEN?: string;
    GITHUB_WEBHOOK_SECRET: string;
}
export declare class GitHubClient {
    private token?;
    private webhookSecret;
    constructor(config: GitHubConfig);
    private getHeaders;
    fetchPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<Array<{
        filename: string;
        patch: string;
    }>>;
    private isCodeFile;
    verifyWebhookSignature(body: string, signature: string | null): Promise<boolean>;
    createCheckRun(owner: string, repo: string, data: {
        name: string;
        head_sha: string;
        status: 'queued' | 'in_progress' | 'completed';
        conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
        output?: {
            title: string;
            summary: string;
            text?: string;
        };
    }): Promise<void>;
}
export declare function fetchPullRequestFiles(owner: string, repo: string, pullNumber: number, token?: string): Promise<any[]>;
export declare function createCheckRun(owner: string, repo: string, data: {
    name: string;
    head_sha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
    output?: {
        title: string;
        summary: string;
        text?: string;
    };
}, token: string): Promise<void>;
//# sourceMappingURL=github.d.ts.map