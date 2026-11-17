export interface GitFileStatus {
  path: string;
  indexStatus: string; // 'M' | 'A' | 'D' | '?' | ' ' etc.
  workTreeStatus: string;
  isStaged: boolean;
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  relativeTime: string;
  message: string;
}

export interface GitRepoDetails {
  isRepo: boolean;
  branch: string;
  isDirty: boolean;
  remoteUrl?: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  untrackedFiles: GitFileStatus[];
}
