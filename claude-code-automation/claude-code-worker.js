import { parentPort, workerData } from 'worker_threads';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeTask(task) {
  const { command, project_path, taskId } = task;
  
  try {
    console.log(`Worker executing task ${taskId}: ${command}`);
    
    // プロジェクトディレクトリで実行
    const fullCommand = `cd ${project_path} && ${command}`;
    const { stdout, stderr } = await execAsync(fullCommand, {
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    
    const result = {
      taskId,
      success: true,
      stdout,
      stderr,
      completedAt: new Date().toISOString()
    };
    
    parentPort.postMessage(result);
  } catch (error) {
    const result = {
      taskId,
      success: false,
      error: error.message,
      stderr: error.stderr,
      completedAt: new Date().toISOString()
    };
    
    parentPort.postMessage(result);
  }
}

// ワーカーを開始
if (workerData && workerData.task) {
  executeTask(workerData.task);
}