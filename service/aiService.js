import OpenAI from 'openai';
import AIMessage from '../models/AIMessage.js';
import AIChatRoom from '../models/AIChatRoom.js';
import AISettings from '../models/AISettings.js';
import KnowledgeBase from '../models/KnowledgeBase.js';
import vectorService from './vectorService.js';

class AIService {
    constructor() {
        this.openai = null;
    }

    async generateSystemPrompt(settings) {
        if (!settings) return "You are a helpful AI assistant.";

        let prompt = settings.systemPrompt || "You are a helpful AI assistant.";

        if (settings.about) {
            prompt += `\n\nAbout you/the platform: ${settings.about}`;
        }

        if (settings.tone && settings.tone !== 'neutral') {
            prompt += `\n\nYour tone of voice should be: ${settings.tone}`;
        }

        if (settings.responseLength) {
            prompt += `\n\nResponse length preference: ${settings.responseLength}`;
        }

        if (settings.gender && settings.gender !== 'neutral') {
            prompt += `\n\nYour persona gender: ${settings.gender}`;
        }

        if (settings.languages && settings.languages.length > 0) {
            prompt += `\n\nYou can communicate in these languages: ${settings.languages.join(', ')}`;
        }

        if (settings.useEmojis) {
            prompt += `\n\nUse emojis in your responses when appropriate to make them more engaging.`;
        } else {
            prompt += `\n\nDo NOT use emojis in your responses.`;
        }

        if (settings.useBulletPoints) {
            prompt += `\n\nUse bullet points for lists to improve readability.`;
        }

        if (settings.dos && settings.dos.length > 0) {
            prompt += `\n\nThings you SHOULD do:\n- ${settings.dos.join('\n- ')}`;
        }

        if (settings.donts && settings.donts.length > 0) {
            prompt += `\n\nThings you SHOULD NOT do:\n- ${settings.donts.join('\n- ')}`;
        }

        if (settings.avoidWords) {
            prompt += `\n\nCRITICAL: Avoid using the following words or phrases: ${settings.avoidWords}`;
        }

        return prompt;
    }

    initialize() {
        if (!this.openai && process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                timeout: 30000,
                maxRetries: 2,
            });
            console.log('✅ OpenAI Service Initialized');
        } else if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️ OPENAI_API_KEY is missing in environment variables. AI Service will not function.');
        }
    }

    async retrieveContext(userId, query) {
        try {
            const searchResults = await vectorService.searchKnowledge(query, 5);

            if (!searchResults || searchResults.length === 0) return "";

            let contextStr = "Here is some relevant information from the knowledge base to help you answer the user's question:\n";
            searchResults.forEach(result => {
                contextStr += `\n--- SOURCE: ${result.title} ---\n${result.content}\n`;
            });

            return contextStr;
        } catch (error) {
            console.error('Error retrieving context from Qdrant:', error);
            return "";
        }
    }

    /**
     * FUTURE: Define tools for the AI (Function Calling)
     * e.g., get_course_summary, check_quiz_score
     */
    getAvailableTools() {
        return [
            /*
            {
                type: 'function',
                function: {
                    name: 'get_course_details',
                    description: 'Get details about a specific course',
                    parameters: { type: 'object', properties: { courseName: { type: 'string' } } }
                }
            }
            */
        ];
    }

    async *streamResponse(userId, chatRoomId, userMessageText) {
        if (!this.openai) this.initialize();
        if (!this.openai) {
            throw new Error('AI Service not configured (Missing API Key)');
        }

        try {
            let settings = await AISettings.findOne();
            if (!settings) settings = await AISettings.create({});

            const chatRoom = await AIChatRoom.findById(chatRoomId).select('contextSummary title');
            const knowledgeContext = await this.retrieveContext(userId, userMessageText);

            const recentMessages = await AIMessage.find({ chatRoomId })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('role content toolCalls')
                .lean();

            const conversationHistory = recentMessages.reverse().map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // 2. Build System Prompt
            let finalSystemPrompt = await this.generateSystemPrompt(settings);

            if (knowledgeContext) {
                finalSystemPrompt += `\n\n${knowledgeContext}`;
            }

            if (chatRoom && chatRoom.contextSummary) {
                finalSystemPrompt += `\n\nContext from previous conversation:\n${chatRoom.contextSummary}`;
            }

            // 3. Construct Payload
            const messages = [
                { role: 'system', content: finalSystemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessageText }
            ];

            // 4. Call OpenAI with stream
            const stream = await this.openai.chat.completions.create({
                model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
                messages: messages,
                temperature: (settings.temperature || 7) / 10,
                max_tokens: settings.responseLength === 'long' ? 1000 : (settings.responseLength === 'short' ? 250 : 500),
                stream: true,
                // tools: this.getAvailableTools(),
            });

            // 5. Yield chunks as they arrive
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                // const toolCall = chunk.choices[0]?.delta?.tool_calls; // Handle streaming tool calls in future
                if (content) {
                    yield { content };
                }
            }

        } catch (error) {
            console.error('Error in AI stream:', error);
            throw new Error('Failed to stream response from AI provider');
        }
    }
}

export default new AIService();
