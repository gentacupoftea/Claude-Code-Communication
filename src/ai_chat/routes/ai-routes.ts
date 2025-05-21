/**
 * AI Chat Routes
 * 
 * Defines the API endpoints for the AI chat functionality
 */

import { Router } from 'express';
import { AIChatController } from '../controllers/ai-chat-controller';

const router = Router();
const controller = new AIChatController();

/**
 * @route POST /api/ai/chat
 * @desc Send a message to the AI assistant
 * @access Public
 */
router.post('/chat', controller.sendMessage.bind(controller));

/**
 * @route GET /api/ai/providers
 * @desc Get available AI providers and the active provider
 * @access Public
 */
router.get('/providers', controller.getAvailableProviders.bind(controller));

/**
 * @route GET /api/ai/history
 * @desc Get conversation history
 * @access Public
 */
router.get('/history', controller.getConversationHistory.bind(controller));

/**
 * @route POST /api/ai/clear
 * @desc Clear conversation history
 * @access Public
 */
router.post('/clear', controller.clearConversation.bind(controller));

/**
 * @route GET /api/ai/chart-examples
 * @desc Get chart examples
 * @access Public
 */
router.get('/chart-examples', controller.getChartExamples.bind(controller));

export default router;