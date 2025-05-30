import { WorkerLLM, LLMRequest } from '../types';

export function selectBestWorkers(
  request: LLMRequest, 
  workers: WorkerLLM[]
): WorkerLLM[] {
  const query = request.query.toLowerCase();
  const selectedWorkers: WorkerLLM[] = [];

  // キーワードベースの簡易選択ロジック
  const keywords = {
    analyzer: ['分析', '解析', 'データ', '統計', 'トレンド', '傾向'],
    visualizer: ['グラフ', 'チャート', '可視化', '図', '表示'],
    planner: ['計画', 'プラン', 'スケジュール', '戦略', '予定']
  };

  workers.forEach(worker => {
    const workerKeywords = keywords[worker.type as keyof typeof keywords] || [];
    if (workerKeywords.some(keyword => query.includes(keyword))) {
      selectedWorkers.push(worker);
    }
  });

  // 何も選択されなかった場合は汎用Workerを選択
  if (selectedWorkers.length === 0) {
    const generalWorker = workers.find(w => w.type === 'general');
    if (generalWorker) selectedWorkers.push(generalWorker);
  }

  return selectedWorkers;
}