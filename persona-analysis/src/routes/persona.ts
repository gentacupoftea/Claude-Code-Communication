import { Router } from 'express';
import multer from 'multer';
import { validateRequest } from '../middleware/validation';
import { authenticateUser } from '../middleware/auth';
import { 
  createAnalysis,
  getAnalysis,
  listAnalyses,
  deleteAnalysis,
  getAnalysisStatus,
  downloadReport
} from '../controllers/personaController';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 10
  }
});

// すべてのルートに認証を適用
router.use(authenticateUser);

// 分析の作成
router.post(
  '/analyze',
  upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'transcript', maxCount: 1 },
    { name: 'survey', maxCount: 1 },
    { name: 'purchase_data', maxCount: 1 }
  ]),
  validateRequest('createAnalysis'),
  createAnalysis
);

// 分析リストの取得
router.get('/analyses', listAnalyses);

// 特定の分析の取得
router.get('/analyses/:id', getAnalysis);

// 分析ステータスの取得
router.get('/analyses/:id/status', getAnalysisStatus);

// 分析レポートのダウンロード
router.get('/analyses/:id/report', downloadReport);

// 分析の削除
router.delete('/analyses/:id', deleteAnalysis);

export default router;