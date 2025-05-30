import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler';

const schemas = {
  createAnalysis: Joi.object({
    body: Joi.object({
      targetAudience: Joi.string().optional().allow(''),
      options: Joi.string().optional() // JSON文字列として受け取る
    }),
    files: Joi.object({
      videos: Joi.array().items(
        Joi.object({
          originalname: Joi.string().required(),
          mimetype: Joi.string().valid('video/mp4', 'video/avi', 'video/mov', 'video/wmv').required(),
          size: Joi.number().max(500 * 1024 * 1024).required() // 500MB
        })
      ).max(5).optional(),
      transcript: Joi.array().items(
        Joi.object({
          originalname: Joi.string().required(),
          mimetype: Joi.string().valid('text/plain', 'application/pdf').required(),
          size: Joi.number().max(10 * 1024 * 1024).required() // 10MB
        })
      ).max(1).optional(),
      survey: Joi.array().items(
        Joi.object({
          originalname: Joi.string().required(),
          mimetype: Joi.string().valid('application/json').required(),
          size: Joi.number().max(5 * 1024 * 1024).required() // 5MB
        })
      ).max(1).optional(),
      purchase_data: Joi.array().items(
        Joi.object({
          originalname: Joi.string().required(),
          mimetype: Joi.string().valid('text/csv', 'application/vnd.ms-excel').required(),
          size: Joi.number().max(50 * 1024 * 1024).required() // 50MB
        })
      ).max(1).optional()
    })
  })
};

export const validateRequest = (schemaName: keyof typeof schemas) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new Error(`Schema ${schemaName} not found`);
      }

      // オプションをパースしてバリデーション
      if (req.body.options && typeof req.body.options === 'string') {
        try {
          const parsedOptions = JSON.parse(req.body.options);
          const optionsSchema = Joi.object({
            includeEmotionAnalysis: Joi.boolean().optional(),
            includeSentimentAnalysis: Joi.boolean().optional(),
            includePersonalityTraits: Joi.boolean().optional(),
            includeBehaviorPatterns: Joi.boolean().optional(),
            generateDetailedReport: Joi.boolean().optional()
          });
          
          const { error: optionsError } = optionsSchema.validate(parsedOptions);
          if (optionsError) {
            throw new AppError(`Invalid options: ${optionsError.message}`, 400);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new AppError('Invalid JSON in options field', 400);
          }
          throw e;
        }
      }

      // リクエスト全体のバリデーション
      const { error } = schema.validate({
        body: req.body,
        files: req.files
      });

      if (error) {
        const errorMessage = error.details
          .map(detail => detail.message)
          .join(', ');
        throw new AppError(errorMessage, 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ファイルサイズチェックミドルウェア
export const checkFileSize = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '524288000'); // 500MB
  
  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length']);
    if (contentLength > maxSize) {
      return next(new AppError('Request too large', 413));
    }
  }
  
  next();
};