/**
 * client.js — Backlog API クライアント (共通モジュール)
 */

export class BacklogClient {
  constructor(spaceId, apiKey, domain = 'backlog.jp') {
    this.baseUrl = `https://${spaceId}.${domain}/api/v2`;
    this.apiKey = apiKey;
  }

  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('apiKey', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      console.error(`Error: Backlog API エラー (${res.status}): ${body}`);
      process.exit(1);
    }
    return res.json();
  }

  /** プロジェクトキー → プロジェクト ID に解決 */
  async resolveProjectIds(projectKeys) {
    const projects = await this.get('/projects');
    const keyToId = Object.fromEntries(projects.map(p => [p.projectKey, p.id]));

    return projectKeys.map(key => {
      if (!(key in keyToId)) {
        console.error(`Error: プロジェクト '${key}' が見つかりません`);
        console.error(`  利用可能: ${Object.keys(keyToId).join(', ')}`);
        process.exit(1);
      }
      return keyToId[key];
    });
  }

  /** ページネーションで全課題を取得 */
  async fetchAllIssues(projectIds, statusIds, extraParams = {}) {
    const issues = [];
    let offset = 0;
    const count = 100;

    process.stdout.write(`ステータス [${statusIds.join(', ')}] の課題を取得中...\n`);

    while (true) {
      const batch = await this.get('/issues', {
        'projectId[]': projectIds,
        'statusId[]':  statusIds,
        ...extraParams,
        count,
        offset,
      });

      issues.push(...batch);
      process.stdout.write(`  取得済み: ${issues.length} 件\r`);

      if (batch.length < count) break;
      offset += count;
    }

    process.stdout.write('\n');
    return issues;
  }
}
