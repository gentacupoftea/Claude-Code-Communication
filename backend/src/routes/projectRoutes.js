const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// データベース接続（実際の実装では適切なDB接続を使用）
const db = require('../config/database');

// ファイルアップロード設定
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.txt', '.md', '.xlsx', '.xls', '.json', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`), false);
    }
  },
});

// ミドルウェア: 認証チェック
const authenticateUser = (req, res, next) => {
  // 実際の実装では JWT トークンの検証など
  const userId = req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000000';
  req.userId = userId;
  next();
};

// プロジェクトフォルダ API

// プロジェクトフォルダ一覧取得
router.get('/folders', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        name, 
        parent_id, 
        system_prompt,
        api_settings,
        prompt_variables,
        color,
        icon,
        is_expanded,
        created_at,
        updated_at
      FROM project_folders 
      WHERE user_id = $1 
      ORDER BY sort_order, created_at
    `;
    
    const result = await db.query(query, [req.userId]);
    
    // 階層構造に変換
    const folders = buildFolderTree(result.rows);
    
    res.json({
      success: true,
      data: folders
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      success: false,
      error: 'フォルダの取得に失敗しました'
    });
  }
});

// プロジェクトフォルダ作成
router.post('/folders', authenticateUser, async (req, res) => {
  try {
    const { name, parentId, systemPrompt, apiSettings, promptVariables } = req.body;
    
    const query = `
      INSERT INTO project_folders (
        name, 
        parent_id, 
        user_id,
        system_prompt,
        api_settings,
        prompt_variables
      ) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    
    const result = await db.query(query, [
      name,
      parentId,
      req.userId,
      systemPrompt || null,
      JSON.stringify(apiSettings || {}),
      JSON.stringify(promptVariables || {})
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      success: false,
      error: 'フォルダの作成に失敗しました'
    });
  }
});

// プロジェクトフォルダ更新
router.put('/folders/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, systemPrompt, apiSettings, promptVariables, color, icon } = req.body;
    
    const query = `
      UPDATE project_folders 
      SET 
        name = COALESCE($2, name),
        system_prompt = COALESCE($3, system_prompt),
        api_settings = COALESCE($4, api_settings),
        prompt_variables = COALESCE($5, prompt_variables),
        color = COALESCE($6, color),
        icon = COALESCE($7, icon)
      WHERE id = $1 AND user_id = $8
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id,
      name,
      systemPrompt,
      apiSettings ? JSON.stringify(apiSettings) : null,
      promptVariables ? JSON.stringify(promptVariables) : null,
      color,
      icon,
      req.userId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'フォルダが見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({
      success: false,
      error: 'フォルダの更新に失敗しました'
    });
  }
});

// プロジェクトフォルダ削除
router.delete('/folders/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 関連するファイルとチャットセッションも削除
    const query = `
      DELETE FROM project_folders 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [id, req.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'フォルダが見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: 'フォルダが削除されました'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      error: 'フォルダの削除に失敗しました'
    });
  }
});

// ファイル管理 API

// プロジェクトのファイル一覧取得
router.get('/projects/:projectId/files', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const query = `
      SELECT 
        id,
        original_name,
        file_name,
        file_type,
        file_size,
        storage_url,
        processing_status,
        progress,
        metadata,
        indexed,
        created_at,
        updated_at
      FROM project_files 
      WHERE project_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [projectId, req.userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: 'ファイルの取得に失敗しました'
    });
  }
});

// ファイルアップロード
router.post('/projects/:projectId/files', authenticateUser, upload.array('files'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ファイルが選択されていません'
      });
    }
    
    const uploadedFiles = [];
    
    for (const file of files) {
      const fileId = uuidv4();
      const fileName = `${fileId}-${file.originalname}`;
      const filePath = path.join('uploads', projectId, fileName);
      
      // ファイル保存（実際の実装では Cloud Storage を使用）
      await saveFileToStorage(file.buffer, filePath);
      
      // データベースに記録
      const query = `
        INSERT INTO project_files (
          id,
          project_id,
          user_id,
          original_name,
          file_name,
          file_type,
          file_size,
          storage_path,
          storage_url,
          processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await db.query(query, [
        fileId,
        projectId,
        req.userId,
        file.originalname,
        fileName,
        path.extname(file.originalname).toLowerCase().substring(1),
        file.size,
        filePath,
        `/api/v2/files/${fileId}/download`,
        'completed'
      ]);
      
      uploadedFiles.push(result.rows[0]);
      
      // ファイル内容のインデックス作成（非同期）
      processFileForIndexing(fileId, file, filePath);
    }
    
    res.status(201).json({
      success: true,
      data: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: 'ファイルのアップロードに失敗しました'
    });
  }
});

// ファイルダウンロード
router.get('/files/:fileId/download', authenticateUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const query = `
      SELECT * FROM project_files 
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await db.query(query, [fileId, req.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ファイルが見つかりません'
      });
    }
    
    const file = result.rows[0];
    const filePath = file.storage_path;
    
    // ファイル存在確認
    const fileContent = await loadFileFromStorage(filePath);
    
    // アクセスログ記録
    await logFileAccess(fileId, req.userId, 'download', req);
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.send(fileContent);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: 'ファイルのダウンロードに失敗しました'
    });
  }
});

// ファイル削除
router.delete('/files/:fileId', authenticateUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const query = `
      DELETE FROM project_files 
      WHERE id = $1 AND user_id = $2
      RETURNING storage_path
    `;
    
    const result = await db.query(query, [fileId, req.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ファイルが見つかりません'
      });
    }
    
    // ストレージからファイル削除
    const filePath = result.rows[0].storage_path;
    await deleteFileFromStorage(filePath);
    
    res.json({
      success: true,
      message: 'ファイルが削除されました'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'ファイルの削除に失敗しました'
    });
  }
});

// チャットセッション API

// プロジェクトのチャットセッション一覧取得
router.get('/projects/:projectId/chats', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        id,
        title,
        description,
        status,
        is_pinned,
        tags,
        message_count,
        last_message_content,
        last_message_role,
        last_activity_at,
        created_at,
        updated_at
      FROM chat_sessions 
      WHERE project_id = $1 AND user_id = $2 AND status != 'deleted'
      ORDER BY is_pinned DESC, last_activity_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await db.query(query, [projectId, req.userId, limit, offset]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({
      success: false,
      error: 'チャットセッションの取得に失敗しました'
    });
  }
});

// チャットセッション作成
router.post('/projects/:projectId/chats', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title = '新しいチャット', description, systemPrompt } = req.body;
    
    const query = `
      INSERT INTO chat_sessions (
        project_id,
        user_id,
        title,
        description,
        system_prompt
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      projectId,
      req.userId,
      title,
      description,
      systemPrompt
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({
      success: false,
      error: 'チャットセッションの作成に失敗しました'
    });
  }
});

// チャットメッセージ取得
router.get('/chats/:chatId/messages', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        id,
        role,
        content,
        content_type,
        metadata,
        llm_provider,
        model_name,
        tokens_used,
        referenced_files,
        sequence_number,
        created_at,
        updated_at
      FROM chat_messages 
      WHERE chat_session_id = $1 AND user_id = $2 AND is_deleted = false
      ORDER BY sequence_number ASC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await db.query(query, [chatId, req.userId, limit, offset]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'メッセージの取得に失敗しました'
    });
  }
});

// チャットメッセージ追加
router.post('/chats/:chatId/messages', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { role, content, metadata = {}, referencedFiles = [] } = req.body;
    
    // 次のシーケンス番号を取得
    const seqQuery = `
      SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
      FROM chat_messages 
      WHERE chat_session_id = $1
    `;
    const seqResult = await db.query(seqQuery, [chatId]);
    const sequenceNumber = seqResult.rows[0].next_seq;
    
    const query = `
      INSERT INTO chat_messages (
        chat_session_id,
        user_id,
        role,
        content,
        metadata,
        referenced_files,
        sequence_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      chatId,
      req.userId,
      role,
      content,
      JSON.stringify(metadata),
      referencedFiles,
      sequenceNumber
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      error: 'メッセージの追加に失敗しました'
    });
  }
});

// ヘルパー関数

function buildFolderTree(folders, parentId = null) {
  const tree = [];
  
  for (const folder of folders) {
    if (folder.parent_id === parentId) {
      const children = buildFolderTree(folders, folder.id);
      tree.push({
        ...folder,
        children
      });
    }
  }
  
  return tree;
}

async function saveFileToStorage(buffer, filePath) {
  // 実際の実装では Google Cloud Storage や AWS S3 を使用
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);
}

async function loadFileFromStorage(filePath) {
  // 実際の実装では Cloud Storage からダウンロード
  return await fs.readFile(filePath);
}

async function deleteFileFromStorage(filePath) {
  // 実際の実装では Cloud Storage から削除
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file from storage:', error);
  }
}

async function processFileForIndexing(fileId, file, filePath) {
  // ファイル内容の抽出とインデックス作成（非同期処理）
  try {
    let indexContent = '';
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (fileExt === '.csv') {
      // CSV ファイルの処理
      indexContent = await extractCsvContent(filePath);
    } else if (fileExt === '.txt' || fileExt === '.md') {
      // テキストファイルの処理
      indexContent = await fs.readFile(filePath, 'utf8');
    }
    // 他のファイル形式の処理も追加
    
    // インデックス更新
    const query = `
      UPDATE project_files 
      SET 
        index_content = $1,
        indexed = true,
        metadata = metadata || $2
      WHERE id = $3
    `;
    
    const metadata = {
      processedAt: new Date().toISOString(),
      contentLength: indexContent.length
    };
    
    await db.query(query, [indexContent, JSON.stringify(metadata), fileId]);
    
  } catch (error) {
    console.error('Error processing file for indexing:', error);
  }
}

async function extractCsvContent(filePath) {
  // CSV ファイルの内容抽出（簡易版）
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 100); // 最初の100行のみ
  return lines.join('\n');
}

async function logFileAccess(fileId, userId, action, req) {
  try {
    const query = `
      INSERT INTO file_access_logs (
        file_id,
        user_id,
        action,
        ip_address,
        user_agent,
        access_method
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await db.query(query, [
      fileId,
      userId,
      action,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent'),
      'api'
    ]);
  } catch (error) {
    console.error('Error logging file access:', error);
  }
}

module.exports = router;