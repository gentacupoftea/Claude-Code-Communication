// MultiLLMシステム設定ファイル

module.exports = {
  // Orchestrator（統括AI）設定
  orchestrator: {
    model: "claude-3-opus",
    temperature: 0.7,
    maxTokens: 4096,
    // タスク処理設定
    taskProcessing: {
      maxConcurrentTasks: 10,
      taskTimeout: 300000, // 5分
      retryAttempts: 3
    }
  },
  
  // Worker LLMs設定
  workers: {
    backend: {
      model: "gpt-4-turbo",
      specialization: ["API", "Database", "Performance", "Backend Logic"],
      maxConcurrentTasks: 3,
      temperature: 0.3
    },
    frontend: {
      model: "claude-3-sonnet",
      specialization: ["React", "UI/UX", "CSS", "TypeScript", "Component Design"],
      maxConcurrentTasks: 3,
      temperature: 0.5
    },
    review: {
      model: "gpt-4",
      specialization: ["CodeReview", "Security", "BestPractices", "Performance"],
      maxConcurrentTasks: 5,
      temperature: 0.2
    },
    documentation: {
      model: "claude-3-sonnet",
      specialization: ["Documentation", "API Docs", "Tutorials", "README"],
      maxConcurrentTasks: 2,
      temperature: 0.4
    },
    analytics: {
      model: "gpt-4",
      specialization: ["DataAnalysis", "Reporting", "Metrics", "Visualization"],
      maxConcurrentTasks: 2,
      temperature: 0.3
    },
    creative: {
      model: "dall-e-3",
      specialization: ["ImageGeneration", "Design", "Illustration"],
      maxConcurrentTasks: 1
    }
  },
  
  // メモリ管理設定
  memory: {
    syncInterval: 300, // 5分
    conflictResolution: "latest", // latest, merge, manual
    autoSummarize: {
      enabled: true,
      threshold: 0.8, // トークン使用率80%で要約
      summaryModel: "gpt-3.5-turbo",
      summaryMaxTokens: 1000
    },
    storage: {
      type: "openmemory", // openmemory, redis, postgresql
      connectionString: process.env.OPENMEMORY_URL || "http://localhost:8765"
    }
  },
  
  // 統合サービス設定
  integrations: {
    github: {
      enabled: true,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      token: process.env.GITHUB_TOKEN,
      autoReview: {
        enabled: true,
        assignReviewer: true,
        labelPRs: true,
        commentOnIssues: true
      },
      repositories: [
        {
          owner: "gentacupoftea",
          repo: "shopify-mcp-server",
          autoReviewBranches: ["main", "develop"]
        }
      ]
    },
    
    slack: {
      enabled: true,
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      channels: {
        general: process.env.SLACK_CHANNEL_ID || "C123456789",
        alerts: process.env.SLACK_ALERTS_CHANNEL || "C987654321"
      },
      features: {
        threadTracking: true,
        autoReply: true,
        mentionResponse: true,
        slashCommands: true
      }
    },
    
    mcp: {
      enabled: true,
      services: {
        search: {
          enabled: true,
          provider: "tavily",
          apiKey: process.env.TAVILY_API_KEY
        },
        github: {
          enabled: true,
          token: process.env.GITHUB_TOKEN
        },
        terminal: {
          enabled: true,
          allowedCommands: ["ls", "cat", "grep", "find", "echo"],
          workingDirectory: process.cwd()
        }
      }
    }
  },
  
  // セキュリティ設定
  security: {
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 60,
      requestsPerHour: 1000
    },
    allowedOrigins: [
      "http://localhost:3000",
      "https://multillm-demo-2025.web.app",
      "https://conea.ai"
    ]
  },
  
  // ログ設定
  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: "json",
    outputs: ["console", "file"],
    file: {
      path: "./logs/multiLLM.log",
      maxSize: "10MB",
      maxFiles: 5
    }
  },
  
  // デプロイメント設定
  deployment: {
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3001,
    host: process.env.HOST || "0.0.0.0",
    cors: {
      enabled: true,
      credentials: true
    }
  },
  
  // モニタリング設定
  monitoring: {
    enabled: true,
    metrics: {
      collectInterval: 60, // 1分
      retention: 604800 // 7日間
    },
    alerts: {
      errorThreshold: 10, // 10エラー/分でアラート
      latencyThreshold: 5000, // 5秒以上でアラート
      tokenUsageThreshold: 0.9 // 90%使用でアラート
    }
  },
  
  // タスクルーティング設定
  taskRouting: {
    rules: [
      {
        keywords: ["バグ", "エラー", "修正", "fix", "bug", "error"],
        worker: "backend",
        priority: "high"
      },
      {
        keywords: ["UI", "デザイン", "スタイル", "design", "style", "layout"],
        worker: "frontend",
        priority: "medium"
      },
      {
        keywords: ["PR", "レビュー", "review", "pull request"],
        worker: "review",
        priority: "high"
      },
      {
        keywords: ["ドキュメント", "説明", "document", "readme"],
        worker: "documentation",
        priority: "low"
      },
      {
        keywords: ["分析", "レポート", "analyze", "report", "metrics"],
        worker: "analytics",
        priority: "medium"
      },
      {
        keywords: ["画像", "イラスト", "image", "illustration", "図"],
        worker: "creative",
        priority: "low"
      }
    ],
    defaultWorker: "backend",
    defaultPriority: "medium"
  }
};