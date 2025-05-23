// シンプルなメモリAPI（OpenMemoryのフォールバック）
const fs = require('fs').promises;
const path = require('path');

class SimpleMemoryAPI {
  constructor() {
    this.memoryFile = path.join(__dirname, 'data', 'simple_memory.json');
    this.memories = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const data = await fs.readFile(this.memoryFile, 'utf8');
      this.memories = JSON.parse(data);
    } catch (error) {
      // ファイルが存在しない場合は空配列で開始
      this.memories = [];
    }
    this.initialized = true;
  }

  async save() {
    try {
      await fs.writeFile(this.memoryFile, JSON.stringify(this.memories, null, 2));
    } catch (error) {
      console.error('Failed to save memory file:', error);
    }
  }

  async addMemory(userId, content, metadata = {}) {
    await this.initialize();
    
    const memory = {
      id: this.generateId(),
      user_id: userId,
      content: content,
      created_at: new Date().toISOString(),
      metadata: {
        client: 'simple-memory-api',
        ...metadata
      }
    };
    
    this.memories.unshift(memory); // 最新を先頭に
    
    // 1000件を超えたら古いものを削除
    if (this.memories.length > 1000) {
      this.memories = this.memories.slice(0, 1000);
    }
    
    await this.save();
    return memory;
  }

  async searchMemories(userId, query = '', limit = 10) {
    await this.initialize();
    
    let userMemories = this.memories.filter(m => m.user_id === userId);
    
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      userMemories = userMemories.filter(m => 
        m.content.toLowerCase().includes(searchTerm)
      );
    }
    
    return {
      memories: userMemories.slice(0, limit),
      total: userMemories.length
    };
  }

  async getRecentMemories(userId, limit = 20) {
    await this.initialize();
    
    const userMemories = this.memories
      .filter(m => m.user_id === userId)
      .slice(0, limit);
    
    return {
      memories: userMemories,
      total: userMemories.length
    };
  }

  async getStats(userId = null) {
    await this.initialize();
    
    if (userId) {
      const userMemories = this.memories.filter(m => m.user_id === userId);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const recentMemories = userMemories.filter(m => 
        new Date(m.created_at) > weekAgo
      );
      
      return {
        total: userMemories.length,
        total_memories: userMemories.length,
        recent_memories: recentMemories.length,
        last_updated: new Date().toISOString(),
        service_status: 'simple-fallback'
      };
    } else {
      // 全ユーザーの統計
      return {
        total: this.memories.length,
        total_memories: this.memories.length,
        last_updated: new Date().toISOString(),
        service_status: 'simple-fallback'
      };
    }
  }

  generateId() {
    return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = SimpleMemoryAPI;