/**
 * 最適化されたデータベースクエリユーティリティ
 * 
 * データベースクエリのパフォーマンスを最適化するためのヘルパー関数を提供します。
 * N+1クエリ問題やパフォーマンスのボトルネックを解決します。
 */

import { getRepository, In, LessThan, MoreThanOrEqual } from 'typeorm';
import { ChatSession, ChatMessage, User, ApiLog, UserPreference } from '../entities';

/**
 * リレーションを含むセッション情報を効率的に取得
 * N+1クエリ問題を解決
 */
export async function getSessionWithMessages(sessionId: string) {
  // 効率的なクエリ - 一度のクエリでリレーションを取得
  return await getRepository(ChatSession)
    .createQueryBuilder('session')
    .leftJoinAndSelect('session.messages', 'messages')
    .leftJoinAndSelect('session.user', 'user')
    .where('session.id = :sessionId', { sessionId })
    .orderBy('messages.createdAt', 'ASC')
    .getOne();
}

/**
 * ユーザーの会話セッションと最新メッセージを効率的に取得
 */
export async function getUserSessionsWithLatestMessage(userId: string) {
  return await getRepository(ChatSession)
    .createQueryBuilder('session')
    .leftJoinAndSelect(subQuery => {
      return subQuery
        .select('msg.*')
        .from(ChatMessage, 'msg')
        .where(qb => {
          const subQuery = qb
            .subQuery()
            .select('MAX(m.createdAt)')
            .from(ChatMessage, 'm')
            .where('m.sessionId = msg.sessionId')
            .getQuery();
          return `msg.createdAt = ${subQuery}`;
        });
    }, 'latestMessage', 'latestMessage.sessionId = session.id')
    .where('session.userId = :userId', { userId })
    .orderBy('session.updatedAt', 'DESC')
    .getMany();
}

/**
 * 古いセッションをアーカイブする一括操作
 */
export async function archiveOldSessions(cutoffDate: Date) {
  // 効率的な一括更新
  return await getRepository(ChatSession)
    .createQueryBuilder()
    .update()
    .set({ archived: true })
    .where('lastActivity < :cutoffDate', { cutoffDate })
    .execute();
}

/**
 * 複数ユーザーの基本情報を効率的に取得
 */
export async function getUsersBulk(userIds: string[]) {
  if (!userIds.length) return [];
  
  return await getRepository(User)
    .createQueryBuilder('user')
    .select(['user.id', 'user.name', 'user.email', 'user.isActive'])
    .where('user.id IN (:...userIds)', { userIds })
    .getMany();
}

/**
 * APIログの範囲ごとの集計（パフォーマンス分析用）
 */
export async function aggregateApiLogsByTimeRange(
  startDate: Date,
  endDate: Date,
  interval: 'hour' | 'day' | 'week' = 'day'
) {
  const timeFunction = 
    interval === 'hour' ? 'date_trunc(\'hour\', "createdAt")' :
    interval === 'week' ? 'date_trunc(\'week\', "createdAt")' :
    'date_trunc(\'day\', "createdAt")';
  
  return await getRepository(ApiLog)
    .createQueryBuilder('log')
    .select(`${timeFunction}`, 'timeInterval')
    .addSelect('COUNT(*)', 'requestCount')
    .addSelect('AVG(log.duration)', 'avgDuration')
    .addSelect('MAX(log.duration)', 'maxDuration')
    .addSelect('COUNT(CASE WHEN log.statusCode >= 400 THEN 1 END)', 'errorCount')
    .where('log.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
    .groupBy('timeInterval')
    .orderBy('timeInterval', 'ASC')
    .getRawMany();
}

/**
 * 大量データの効率的なページング（キーセットページング）
 */
export async function getMessagesWithKeysetPagination(
  sessionId: string, 
  lastId?: string,
  lastCreatedAt?: Date,
  limit: number = 20
) {
  const queryBuilder = getRepository(ChatMessage)
    .createQueryBuilder('message')
    .where('message.sessionId = :sessionId', { sessionId })
    .orderBy('message.createdAt', 'DESC')
    .addOrderBy('message.id', 'DESC')
    .take(limit);
  
  // キーセットページング条件（前回の最終レコードより後のデータを取得）
  if (lastId && lastCreatedAt) {
    queryBuilder.andWhere(
      '(message.createdAt, message.id) < (:lastCreatedAt, :lastId)',
      { lastCreatedAt, lastId }
    );
  }
  
  return await queryBuilder.getMany();
}

/**
 * ユーザー設定のバルク更新
 */
export async function bulkUpdateUserPreferences(updates: Array<{userId: string, settings: any}>) {
  // トランザクション内でバルク操作を実行
  const queryRunner = getRepository(UserPreference).manager.connection.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  
  try {
    // ユーザーIDの抽出
    const userIds = updates.map(update => update.userId);
    
    // 現在の設定を取得
    const preferences = await queryRunner.manager.find(UserPreference, {
      where: { userId: In(userIds) }
    });
    
    // ユーザーIDで設定をインデックス化
    const preferenceMap = new Map(
      preferences.map(pref => [pref.userId, pref])
    );
    
    // 更新/挿入用の配列を準備
    const toUpdate: UserPreference[] = [];
    const toInsert: UserPreference[] = [];
    
    // 各更新をカテゴライズ
    for (const update of updates) {
      const existing = preferenceMap.get(update.userId);
      
      if (existing) {
        // 既存の設定をマージ
        existing.settings = {
          ...existing.settings,
          ...update.settings
        };
        toUpdate.push(existing);
      } else {
        // 新しい設定を作成
        const newPref = new UserPreference();
        newPref.userId = update.userId;
        newPref.settings = update.settings;
        toInsert.push(newPref);
      }
    }
    
    // バルク更新と挿入を実行
    if (toUpdate.length > 0) {
      await queryRunner.manager.save(toUpdate);
    }
    
    if (toInsert.length > 0) {
      await queryRunner.manager.save(toInsert);
    }
    
    // トランザクションをコミット
    await queryRunner.commitTransaction();
    
    return { updated: toUpdate.length, inserted: toInsert.length };
  } catch (error) {
    // エラー時はロールバック
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    // リソースの解放
    await queryRunner.release();
  }
}

/**
 * 大量データの効率的な削除（バッチ処理）
 */
export async function batchDeleteOldRecords(
  entityClass: any,
  dateField: string,
  cutoffDate: Date,
  batchSize: number = 1000
): Promise<number> {
  let totalDeleted = 0;
  let deleted = 0;
  
  do {
    // バッチサイズ単位で削除
    const result = await getRepository(entityClass)
      .createQueryBuilder()
      .delete()
      .where(`${dateField} < :cutoffDate`, { cutoffDate })
      .execute();
    
    deleted = result.affected || 0;
    totalDeleted += deleted;
    
    // 負荷軽減のために短い待機
    if (deleted >= batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (deleted >= batchSize);
  
  return totalDeleted;
}