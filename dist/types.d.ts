export interface ActionConfig {
    githubToken: string;
    openaiApiKey: string;
    owner: string;
    repo: string;
    prNumber: number;
}
export interface PullRequestEvent {
    action: string;
    pull_request: {
        id: number;
        number: number;
        title: string;
        body: string | null;
        html_url: string;
        user: {
            login: string;
            type: string;
        };
        head: {
            ref: string;
            sha: string;
        };
        base: {
            ref: string;
            sha: string;
        };
    };
    repository: {
        id: number;
        name: string;
        full_name: string;
        owner: {
            login: string;
        };
    };
    installation?: {
        id: number;
    };
}
