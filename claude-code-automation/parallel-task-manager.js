import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

class ParallelTaskManager extends EventEmitter {
  constructor(maxWorkers = 4) {
    super();
    this.maxWorkers = maxWorkers;
    this.workers = new Map();
    this.taskQueue = [];
    this.taskResults = new Map();
  }

  async executeTask(task) {
    const taskId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    if (this.workers.size < this.maxWorkers) {
      this.createWorker({ ...task, taskId });
    } else {
      this.taskQueue.push({ ...task, taskId });
    }
    
    return taskId;
  }

  createWorker(task) {
    const worker = new Worker('./claude-code-worker.js', {
      workerData: { task }
    });

    const workerId = Date.now().toString();
    this.workers.set(workerId, { worker, taskId: task.taskId });

    worker.on('message', (result) => {
      this.taskResults.set(task.taskId, result);
      this.emit('taskComplete', { workerId, taskId: task.taskId, result });
    });

    worker.on('error', (error) => {
      this.emit('taskError', { workerId, taskId: task.taskId, error });
    });

    worker.on('exit', (code) => {
      this.workers.delete(workerId);
      
      if (code !== 0) {
        this.emit('workerExit', { workerId, code });
      }
      
      // 次のタスクを実行
      if (this.taskQueue.length > 0) {
        const nextTask = this.taskQueue.shift();
        this.createWorker(nextTask);
      }
    });

    return workerId;
  }
  
  getTaskStatus(taskId) {
    if (this.taskResults.has(taskId)) {
      return { status: 'completed', result: this.taskResults.get(taskId) };
    }
    
    // タスクがワーカーで実行中か確認
    for (const [workerId, workerInfo] of this.workers) {
      if (workerInfo.taskId === taskId) {
        return { status: 'running', workerId };
      }
    }
    
    // タスクがキューにあるか確認
    const queuePosition = this.taskQueue.findIndex(t => t.taskId === taskId);
    if (queuePosition !== -1) {
      return { status: 'queued', position: queuePosition + 1 };
    }
    
    return { status: 'unknown' };
  }
  
  getAllTasks() {
    const tasks = [];
    
    // 実行中のタスク
    for (const [workerId, workerInfo] of this.workers) {
      tasks.push({
        taskId: workerInfo.taskId,
        status: 'running',
        workerId
      });
    }
    
    // キューにあるタスク
    this.taskQueue.forEach((task, index) => {
      tasks.push({
        taskId: task.taskId,
        status: 'queued',
        position: index + 1
      });
    });
    
    // 完了したタスク
    for (const [taskId, result] of this.taskResults) {
      tasks.push({
        taskId,
        status: 'completed',
        result
      });
    }
    
    return tasks;
  }
}

export default ParallelTaskManager;