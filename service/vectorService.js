import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { chunkText } from '../utils/parser.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'lms_knowledge';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const VECTOR_SIZE = parseInt(process.env.OPENAI_EMBEDDING_DIMENSION) || 1536;

// Lazy-init: constructing the OpenAI client at module load crashes the whole server
// when OPENAI_API_KEY is unset. Build it on first use so the LMS can boot without
// AI features configured; with a key present, behavior is unchanged.
let openaiClient = null;
function getOpenAI() {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 20000,
            maxRetries: 1,
        });
    }
    return openaiClient;
}

// Bound per-call embedding input size and per-document chunk count to cap cost/latency.
const MAX_EMBEDDING_INPUT_CHARS = 8000;
const MAX_CHUNKS = 200;

class VectorService {
    constructor() {
        this.isInitialized = false;
    }

    async ensureCollection() {
        if (this.isInitialized) return;
        try {
            const collections = await client.getCollections();
            const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

            if (!exists) {
                await client.createCollection(COLLECTION_NAME, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine',
                    },
                });
                console.log(`Qdrant Collection '${COLLECTION_NAME}' created.`);
            }
            this.isInitialized = true;
        } catch (error) {
            console.error('Error ensuring Qdrant collection:', error);
        }
    }

    async getEmbedding(text) {
        const input = text.replace(/\n/g, ' ').slice(0, MAX_EMBEDDING_INPUT_CHARS);
        const response = await getOpenAI().embeddings.create({
            model: EMBEDDING_MODEL,
            input,
        });
        return response.data[0].embedding;
    }

    async upsertKnowledge(knowledgeId, title, content, type) {
        await this.ensureCollection();

        const chunks = chunkText(content, 1000, 200).slice(0, MAX_CHUNKS);
        const points = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await this.getEmbedding(chunk);
            points.push({
                id: uuidv4(),
                vector: embedding,
                payload: {
                    knowledgeId: knowledgeId.toString(),
                    title,
                    content: chunk,
                    type,
                    chunkIndex: i
                },
            });
        }

        await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: points,
        });

        console.log(`Indexed ${points.length} chunks for knowledge base item: ${title}`);
    }

    async deleteKnowledge(knowledgeId) {
        await this.ensureCollection();
        await client.delete(COLLECTION_NAME, {
            filter: {
                must: [
                    {
                        key: 'knowledgeId',
                        match: {
                            value: knowledgeId.toString(),
                        },
                    },
                ],
            },
        });
        console.log(`Deleted vectors for knowledge base item: ${knowledgeId}`);
    }

    async searchKnowledge(query, limit = 5) {
        await this.ensureCollection();
        const queryEmbedding = await this.getEmbedding(query);

        const results = await client.search(COLLECTION_NAME, {
            vector: queryEmbedding,
            limit: limit,
            with_payload: true,
        });

        return results.map(hit => ({
            title: hit.payload.title,
            content: hit.payload.content,
            score: hit.score,
            knowledgeId: hit.payload.knowledgeId
        }));
    }
}

export default new VectorService();
