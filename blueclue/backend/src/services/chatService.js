import ChatMessage from '../models/ChatMessage.js';
import ChatConversation from '../models/ChatConversation.js';

/**
 * Message Processing Service
 * Handles intent recognition, response generation, and message logging
 */

/**
 * Simple intent recognition based on keywords
 * @param {string} message - User message
 * @returns {Object} {intent, confidence}
 */
function recognizeIntent(message) {
  const lowercaseMessage = message.toLowerCase();
  
  // Define intent patterns with keywords
  const intentPatterns = {
    greeting: {
      keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
      confidence: 0.9
    },
    create_ticket: {
      keywords: ['create ticket', 'new ticket', 'submit ticket', 'open ticket', 'report issue', 'problem', 'help with'],
      confidence: 0.85
    },
    check_status: {
      keywords: ['ticket status', 'check ticket', 'ticket update', 'my tickets', 'where is my ticket'],
      confidence: 0.85
    },
    technical_support: {
      keywords: ['how to', 'how do i', 'can you help', 'need help', 'support', 'assistance'],
      confidence: 0.8
    },
    account_help: {
      keywords: ['password', 'login', 'account', 'username', 'reset', 'forgot'],
      confidence: 0.85
    },
    knowledge_base: {
      keywords: ['article', 'guide', 'tutorial', 'documentation', 'faq', 'how-to'],
      confidence: 0.8
    },
    escalation: {
      keywords: ['speak to human', 'talk to person', 'escalate', 'manager', 'supervisor'],
      confidence: 0.9
    },
    gratitude: {
      keywords: ['thank', 'thanks', 'appreciate', 'helpful'],
      confidence: 0.9
    },
    farewell: {
      keywords: ['bye', 'goodbye', 'see you', 'exit', 'quit'],
      confidence: 0.9
    }
  };
  
  // Check each intent pattern
  let bestMatch = { intent: 'general_inquiry', confidence: 0.5 };
  
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    for (const keyword of pattern.keywords) {
      if (lowercaseMessage.includes(keyword)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = { intent, confidence: pattern.confidence };
        }
        break;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Generate bot response based on intent
 * @param {string} intent - Detected intent
 * @param {string} userMessage - Original user message
 * @param {Object} context - Conversation context
 * @returns {Object} {response, suggestedArticles, suggestions}
 */
function generateResponse(intent, userMessage, context = {}) {
  const responses = {
    greeting: {
      response: "Hello! I'm the BlueClue support assistant. How can I help you today?",
      suggestions: [
        "Create a new ticket",
        "Check ticket status",
        "Browse knowledge base",
        "Get technical help"
      ],
      suggestedArticles: []
    },
    create_ticket: {
      response: "I can help you create a support ticket. Could you please describe the issue you're experiencing? Include details like:\n\n• What were you trying to do?\n• What happened instead?\n• Any error messages you saw",
      suggestions: [
        "It's a technical issue",
        "I need account help",
        "Hardware problem",
        "Software issue"
      ],
      suggestedArticles: []
    },
    check_status: {
      response: "I can help you check your ticket status. You can view all your tickets in the 'My Tickets' section. Would you like me to guide you there?",
      suggestions: [
        "Yes, show me my tickets",
        "How do I track a ticket?",
        "What's the typical response time?"
      ],
      suggestedArticles: []
    },
    technical_support: {
      response: "I'm here to help with technical issues. Let me search our knowledge base for relevant articles. In the meantime, could you tell me more about what you're trying to accomplish?",
      suggestions: [
        "Password reset",
        "Software installation",
        "Network issues",
        "Email problems"
      ],
      suggestedArticles: []
    },
    account_help: {
      response: "I can assist with account-related issues. Common account topics include:\n\n• Password resets\n• Login problems\n• Account access\n• Profile updates\n\nWhat specifically are you needing help with?",
      suggestions: [
        "Reset my password",
        "Can't login",
        "Update account info",
        "Two-factor authentication"
      ],
      suggestedArticles: []
    },
    knowledge_base: {
      response: "Our knowledge base contains helpful articles and guides. I can search for articles related to your question. What topic are you interested in?",
      suggestions: [
        "Getting started guides",
        "Troubleshooting tips",
        "Common issues",
        "How-to guides"
      ],
      suggestedArticles: []
    },
    escalation: {
      response: "I understand you'd like to speak with a person. I can help you create a support ticket, and a technician will be assigned to assist you. Would you like me to do that?",
      suggestions: [
        "Yes, create a ticket",
        "No, I'll try the chatbot first",
        "What's the typical wait time?"
      ],
      suggestedArticles: []
    },
    gratitude: {
      response: "You're welcome! I'm glad I could help. Is there anything else you need assistance with?",
      suggestions: [
        "Yes, I have another question",
        "No, that's all",
        "Rate this conversation"
      ],
      suggestedArticles: []
    },
    farewell: {
      response: "Thank you for using BlueClue support! If you need help in the future, don't hesitate to reach out. Have a great day!",
      suggestions: [],
      suggestedArticles: []
    },
    general_inquiry: {
      response: "I'm here to help! I can assist you with:\n\n• Creating support tickets\n• Checking ticket status\n• Finding helpful articles\n• Answering common questions\n\nWhat would you like help with?",
      suggestions: [
        "Create a ticket",
        "Check my tickets",
        "Browse knowledge base",
        "Contact support"
      ],
      suggestedArticles: []
    }
  };
  
  return responses[intent] || responses.general_inquiry;
}

/**
 * Process a chat message
 * @param {number} userId - User ID
 * @param {string} message - User message
 * @param {number} conversationId - Optional: Existing conversation ID
 * @returns {Promise<Object>} {response, suggestions, articleLinks, conversationId, messageId}
 */
export async function processChatMessage(userId, message, conversationId = null) {
  try {
    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await ChatConversation.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
    } else {
      // Get active conversation or create new one
      conversation = await ChatConversation.getActiveByUserId(userId);
      if (!conversation) {
        conversation = await ChatConversation.create(userId);
      }
    }
    
    // Recognize intent
    const { intent, confidence } = recognizeIntent(message);
    
    // Get conversation context
    const previousMessages = await ChatMessage.getByConversationId(conversation.id, 10);
    const context = {
      messageCount: previousMessages.length,
      previousIntents: previousMessages.map(m => m.intent).filter(Boolean)
    };
    
    // Generate response
    const { response, suggestions, suggestedArticles } = generateResponse(intent, message, context);
    
    // Save user message
    const userMessageRecord = await ChatMessage.create({
      conversationId: conversation.id,
      sender: 'user',
      message,
      intent,
      confidence
    });
    
    // Save bot response
    const botMessageRecord = await ChatMessage.create({
      conversationId: conversation.id,
      sender: 'bot',
      message: response,
      intent: `response_${intent}`,
      confidence: 1.0,
      suggestedArticles
    });
    
    return {
      response,
      suggestions: suggestions || [],
      articleLinks: suggestedArticles || [],
      conversationId: conversation.id,
      messageId: botMessageRecord.id,
      intent,
      confidence
    };
    
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
}

/**
 * Get conversation context and history
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object>} {conversation, messages}
 */
export async function getConversationHistory(conversationId) {
  const conversation = await ChatConversation.getById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const messages = await ChatMessage.getByConversationId(conversationId);
  
  return {
    conversation,
    messages
  };
}

/**
 * Clear chat history for a user
 * @param {number} userId - User ID
 * @param {number} conversationId - Optional: Specific conversation to clear
 * @returns {Promise<Object>} {deletedConversations, deletedMessages}
 */
export async function clearChatHistory(userId, conversationId = null) {
  if (conversationId) {
    // Clear specific conversation
    const conversation = await ChatConversation.getById(conversationId);
    if (!conversation || conversation.user_id !== userId) {
      throw new Error('Conversation not found or unauthorized');
    }
    
    const deletedMessages = await ChatMessage.deleteByConversationId(conversationId);
    await ChatConversation.delete(conversationId);
    
    return {
      deletedConversations: 1,
      deletedMessages
    };
  } else {
    // Clear all conversations for user
    const conversations = await ChatConversation.getByUserId(userId);
    let totalDeletedMessages = 0;
    
    for (const conv of conversations) {
      const deletedMessages = await ChatMessage.deleteByConversationId(conv.id);
      totalDeletedMessages += deletedMessages;
      await ChatConversation.delete(conv.id);
    }
    
    return {
      deletedConversations: conversations.length,
      deletedMessages: totalDeletedMessages
    };
  }
}

export default {
  processChatMessage,
  getConversationHistory,
  clearChatHistory,
  recognizeIntent,
  generateResponse
};
