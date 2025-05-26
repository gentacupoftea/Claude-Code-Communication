/**
 * Conea自律AIエージェント - 自律PR作成システム
 * コード生成結果からGitHub PR自動作成
 */

const fs = require('fs').promises;
const path = require('path');
const shelljs = require('shelljs');
const { Octokit } = require('@octokit/rest');

class AutonomousPR {
  constructor(githubToken, repoOwner, repoName) {
    this.octokit = new Octokit({ auth: githubToken });
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.workingDir = process.cwd();
  }

  async createAutonomousPR(generationResult) {
    try {
      console.log('🤖 自律PR作成開始...');

      // 1. ブランチ作成
      const branchName = this.generateBranchName(generationResult.intent);
      await this.createBranch(branchName);

      // 2. ファイル変更適用
      const changes = await this.applyChanges(generationResult);

      // 3. コミット作成
      const commitHash = await this.createCommit(generationResult, changes);

      // 4. ブランチプッシュ
      await this.pushBranch(branchName);

      // 5. PR作成
      const prUrl = await this.createPullRequest(generationResult, branchName, changes);

      // 6. 自動レビュー依頼
      await this.requestReviews(prUrl, generationResult);

      // 7. ラベル付与
      await this.addLabels(prUrl, generationResult);

      return {
        success: true,
        prUrl: prUrl,
        branchName: branchName,
        commitHash: commitHash,
        changes: changes,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('自律PR作成エラー:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  generateBranchName(intent) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const featureName = intent.parameters.featureName || 'unknown';
    const type = intent.type.replace('_', '-');
    
    return `autonomous/${type}/${featureName}-${timestamp}`.toLowerCase();
  }

  async createBranch(branchName) {
    return new Promise((resolve, reject) => {
      shelljs.exec(`git checkout -b ${branchName}`, (code, stdout, stderr) => {
        if (code === 0) {
          console.log(`✅ ブランチ作成: ${branchName}`);
          resolve(branchName);
        } else {
          reject(new Error(`Branch creation failed: ${stderr}`));
        }
      });
    });
  }

  async applyChanges(generationResult) {
    const changes = {
      added: [],
      modified: [],
      deleted: []
    };

    // 生成されたコードファイルを保存
    for (const [filePath, code] of generationResult.code) {
      await this.ensureDirectory(path.dirname(filePath));
      
      const fileExists = await this.fileExists(filePath);
      
      if (fileExists) {
        // 既存ファイルをバックアップ
        const backupPath = `${filePath}.backup`;
        await fs.copyFile(filePath, backupPath);
        changes.modified.push({
          path: filePath,
          backup: backupPath,
          type: 'modified'
        });
      } else {
        changes.added.push({
          path: filePath,
          type: 'added'
        });
      }

      await fs.writeFile(filePath, code, 'utf8');
      console.log(`📝 ファイル保存: ${filePath}`);
    }

    // テストファイルを保存
    for (const [testPath, testCode] of generationResult.tests) {
      await this.ensureDirectory(path.dirname(testPath));
      await fs.writeFile(testPath, testCode, 'utf8');
      changes.added.push({
        path: testPath,
        type: 'test'
      });
      console.log(`🧪 テストファイル保存: ${testPath}`);
    }

    // ドキュメント更新
    if (generationResult.documentation.readme) {
      await this.updateReadme(generationResult.documentation.readme);
      changes.modified.push({
        path: 'README.md',
        type: 'documentation'
      });
    }

    return changes;
  }

  async createCommit(generationResult, changes) {
    const intent = generationResult.intent;
    const commitMessage = this.generateCommitMessage(intent, changes);

    return new Promise((resolve, reject) => {
      // ファイルをステージング
      shelljs.exec('git add .', (code, stdout, stderr) => {
        if (code !== 0) {
          reject(new Error(`Git add failed: ${stderr}`));
          return;
        }

        // コミット実行
        const escapedMessage = commitMessage.replace(/"/g, '\\"');
        shelljs.exec(`git commit -m "${escapedMessage}"`, (code, stdout, stderr) => {
          if (code === 0) {
            const commitHash = stdout.match(/\[.*\s(\w+)\]/)?.[1] || 'unknown';
            console.log(`✅ コミット作成: ${commitHash}`);
            resolve(commitHash);
          } else {
            reject(new Error(`Git commit failed: ${stderr}`));
          }
        });
      });
    });
  }

  generateCommitMessage(intent, changes) {
    const type = this.getCommitType(intent.type);
    const scope = intent.parameters.featureName || 'general';
    const description = this.generateCommitDescription(intent, changes);

    return `${type}(${scope}): ${description}

🤖 Autonomous implementation

Details:
- Intent: ${intent.type}
- Priority: ${intent.priority}
- Scope: ${intent.scope.size}
- Files: ${changes.added.length} added, ${changes.modified.length} modified

Generated by Conea Autonomous Agent
Co-authored-by: Claude <noreply@anthropic.com>`;
  }

  getCommitType(intentType) {
    const typeMap = {
      'feature_development': 'feat',
      'bug_fix': 'fix',
      'refactoring': 'refactor',
      'testing': 'test',
      'deployment': 'build',
      'documentation': 'docs'
    };
    return typeMap[intentType] || 'feat';
  }

  generateCommitDescription(intent, changes) {
    switch (intent.type) {
      case 'feature_development':
        return `implement ${intent.parameters.featureName} feature`;
      case 'bug_fix':
        return `fix ${intent.parameters.errorType} error`;
      case 'refactoring':
        return `refactor code for better performance`;
      case 'testing':
        return `add comprehensive test coverage`;
      default:
        return 'autonomous code generation';
    }
  }

  async pushBranch(branchName) {
    return new Promise((resolve, reject) => {
      shelljs.exec(`git push -u origin ${branchName}`, (code, stdout, stderr) => {
        if (code === 0) {
          console.log(`✅ ブランチプッシュ: ${branchName}`);
          resolve(true);
        } else {
          reject(new Error(`Git push failed: ${stderr}`));
        }
      });
    });
  }

  async createPullRequest(generationResult, branchName, changes) {
    const intent = generationResult.intent;
    const title = this.generatePRTitle(intent);
    const body = this.generatePRBody(generationResult, changes);

    try {
      const response = await this.octokit.pulls.create({
        owner: this.repoOwner,
        repo: this.repoName,
        title: title,
        head: branchName,
        base: 'main',
        body: body,
        draft: false
      });

      console.log(`✅ PR作成完了: ${response.data.html_url}`);
      return response.data.html_url;

    } catch (error) {
      throw new Error(`PR creation failed: ${error.message}`);
    }
  }

  generatePRTitle(intent) {
    const emoji = this.getIntentEmoji(intent.type);
    const featureName = intent.parameters.featureName || 'Unknown';
    return `${emoji} [Autonomous] ${featureName} - ${intent.type.replace('_', ' ')}`;
  }

  getIntentEmoji(intentType) {
    const emojiMap = {
      'feature_development': '✨',
      'bug_fix': '🐛',
      'refactoring': '♻️',
      'testing': '🧪',
      'deployment': '🚀',
      'documentation': '📚'
    };
    return emojiMap[intentType] || '🤖';
  }

  generatePRBody(generationResult, changes) {
    const intent = generationResult.intent;
    
    return `## 🤖 Autonomous Implementation

**Original Request:** ${intent.message}

### 📋 Implementation Summary

- **Intent Type:** ${intent.type}
- **Priority:** ${intent.priority}
- **Estimated Duration:** ${intent.scope.estimatedHours} hours
- **Complexity:** ${intent.scope.complexity}

### 🔧 Changes Made

#### Files Added (${changes.added.length})
${changes.added.map(change => `- \`${change.path}\` (${change.type})`).join('\n')}

#### Files Modified (${changes.modified.length})
${changes.modified.map(change => `- \`${change.path}\` (${change.type})`).join('\n')}

### 🧪 Testing

- Unit tests generated: ✅
- Integration tests: ${this.hasIntegrationTests(changes) ? '✅' : '⏳'}
- Manual testing required: ${intent.scope.complexity === 'high' ? '✅' : '❌'}

### 📚 Documentation

- Code comments: ✅
- README updated: ${generationResult.documentation.readme ? '✅' : '❌'}
- API documentation: ${generationResult.documentation.api ? '✅' : '❌'}

### 🔍 Quality Checks

- [ ] Code review required
- [ ] Security review (if applicable)
- [ ] Performance impact assessment
- [ ] Breaking changes assessment

### 🚀 Deployment Notes

${this.generateDeploymentNotes(intent)}

### 🏷️ Labels

This PR should be labeled with:
- \`autonomous-generation\`
- \`${intent.type}\`
- \`priority-${intent.priority}\`
- \`size-${intent.scope.size}\`

---

*This PR was automatically generated by Conea Autonomous Agent*
*Review and approval required before merge*`;
  }

  generateDeploymentNotes(intent) {
    switch (intent.type) {
      case 'feature_development':
        return '- Feature flag recommended for gradual rollout\n- Database migrations may be required\n- Monitor performance impact';
      case 'bug_fix':
        return '- Can be deployed immediately after approval\n- Monitor error rates post-deployment';
      case 'refactoring':
        return '- Thorough testing recommended\n- Monitor performance metrics\n- No breaking changes expected';
      default:
        return '- Standard deployment process';
    }
  }

  async requestReviews(prUrl, generationResult) {
    const prNumber = this.extractPRNumber(prUrl);
    const reviewers = this.determineReviewers(generationResult.intent);

    if (reviewers.length === 0) return;

    try {
      await this.octokit.pulls.requestReviewers({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
        reviewers: reviewers
      });
      console.log(`✅ レビュー依頼: ${reviewers.join(', ')}`);
    } catch (error) {
      console.warn('レビュー依頼エラー:', error.message);
    }
  }

  async addLabels(prUrl, generationResult) {
    const prNumber = this.extractPRNumber(prUrl);
    const labels = this.generateLabels(generationResult.intent);

    try {
      await this.octokit.issues.addLabels({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: prNumber,
        labels: labels
      });
      console.log(`✅ ラベル追加: ${labels.join(', ')}`);
    } catch (error) {
      console.warn('ラベル追加エラー:', error.message);
    }
  }

  determineReviewers(intent) {
    // 実際のプロジェクトに応じてレビューアーを決定
    const reviewers = [];
    
    if (intent.type === 'feature_development') {
      reviewers.push('tech-lead', 'senior-developer');
    }
    
    if (intent.priority === 'urgent') {
      reviewers.push('project-manager');
    }
    
    if (intent.scope.complexity === 'high') {
      reviewers.push('architect');
    }

    return reviewers.filter(reviewer => reviewer); // 実在するユーザーのみ
  }

  generateLabels(intent) {
    const labels = [
      'autonomous-generation',
      intent.type.replace('_', '-'),
      `priority-${intent.priority}`,
      `size-${intent.scope.size}`
    ];

    if (intent.scope.complexity === 'high') {
      labels.push('needs-careful-review');
    }

    if (intent.type === 'bug_fix') {
      labels.push('bug');
    }

    return labels;
  }

  extractPRNumber(prUrl) {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  hasIntegrationTests(changes) {
    return changes.added.some(change => 
      change.path.includes('integration') || 
      change.path.includes('e2e')
    );
  }

  async ensureDirectory(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory already exists or creation failed
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async updateReadme(readmeUpdate) {
    try {
      const readmePath = 'README.md';
      const currentReadme = await fs.readFile(readmePath, 'utf8');
      const updatedReadme = this.mergeReadmeContent(currentReadme, readmeUpdate);
      await fs.writeFile(readmePath, updatedReadme, 'utf8');
    } catch (error) {
      console.warn('README更新エラー:', error.message);
    }
  }

  mergeReadmeContent(current, update) {
    // 簡単なマージロジック - 実際にはより洗練された処理が必要
    if (current.includes('## Features')) {
      return current.replace(
        '## Features',
        `## Features\n\n${update}\n`
      );
    } else {
      return `${current}\n\n## Recent Updates\n\n${update}`;
    }
  }
}

module.exports = AutonomousPR;