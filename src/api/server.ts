import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import BookAssistantAgent, { skillGate } from '../agents/BookAssistant.agent.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get list of PDF files in data directory
app.get('/api/documents/pdfs', (req, res) => {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        
        // Check if data directory exists
        if (!fs.existsSync(dataDir)) {
            return res.status(404).json({
                success: false,
                error: 'Data directory not found'
            });
        }

        // Read directory contents
        const files = fs.readdirSync(dataDir);
        
        // Filter only PDF files
        const pdfFiles = files.filter(file => 
            file.toLowerCase().endsWith('.pdf')
        ).map(file => ({
            name: file,
            path: `data/${file}`,
            fullPath: path.join(dataDir, file)
        }));

        res.json({
            success: true,
            data: {
                totalPdfs: pdfFiles.length,
                pdfs: pdfFiles,
                dataDirectory: dataDir,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] Error reading PDF files:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get all available skills
app.get('/api/agent/skills', (req, res) => {
    try {
        // Manually define the available skills since we can't access them via the SDK
        const skills = [
            {
                name: 'index_document',
                description: 'Use this skill to index a document in a vector database. The user will provide the path to the document (e.g., "data/bitcoin.pdf" or "agentbackend/data/bitcoin.pdf")',
                inputs: { document_path: { description: 'Path to the PDF document file', required: true } }
            },
            {
                name: 'lookup_document',
                description: 'Use this skill ONCE to lookup content in the Pinecone vector database. Do not call this skill multiple times for the same query.',
                inputs: { user_query: { description: 'The search query to find in documents', required: true } }
            },
            {
                name: 'purge_documents',
                description: 'Use this skill to remove all indexed documents from the vector database. WARNING: This will delete all data! Only call this once per user request.',
                inputs: { confirmation: { description: 'Set to "yes" to confirm deletion of all documents', required: false } }
            },
            {
                name: 'get_document_info',
                description: 'Use this skill to get information about a document/book',
                inputs: { document_name: { description: 'This need to be a name of a document/book, extract it from the user query', required: true } }
            }
        ];
        
        res.json({
            success: true,
            data: {
                agentId: 'document-assistant',
                agentName: 'Document Assistant',
                skills: skills
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Execute a specific skill
app.post('/api/agent/skills/:skillName', async (req, res) => {
    try {
        const { skillName } = req.params;
        const parameters = req.body;
        
        // Generate a unique input ID for the skill execution gate
        const inputId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        skillGate.startNewInput(inputId);
        
        console.log(`[API] Executing skill: ${skillName} with parameters:`, parameters);
        
        const result = await BookAssistantAgent.call(skillName, parameters);
        
        res.json({
            success: true,
            data: {
                skill: skillName,
                parameters: parameters,
                result: result,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`[API] Error executing skill ${req.params.skillName}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            skill: req.params.skillName
        });
    }
});

// Execute all skills with provided parameters
app.post('/api/agent/skills/execute-all', async (req, res) => {
    try {
        const { skillsToExecute } = req.body;
        
        if (!skillsToExecute || !Array.isArray(skillsToExecute)) {
            return res.status(400).json({
                success: false,
                error: 'skillsToExecute must be an array of skill execution objects'
            });
        }
        
        // Generate a unique input ID for the skill execution gate
        const inputId = `api-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        skillGate.startNewInput(inputId);
        
        const results = [];
        
        for (const skillExecution of skillsToExecute) {
            const { skillName, parameters = {} } = skillExecution;
            
            try {
                console.log(`[API] Executing skill: ${skillName} with parameters:`, parameters);
                const result = await BookAssistantAgent.call(skillName, parameters);
                
                results.push({
                    skill: skillName,
                    parameters: parameters,
                    success: true,
                    result: result,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error(`[API] Error executing skill ${skillName}:`, error);
                results.push({
                    skill: skillName,
                    parameters: parameters,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                executedSkills: results,
                totalSkills: results.length,
                successfulSkills: results.filter(r => r.success).length,
                failedSkills: results.filter(r => !r.success).length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] Error in execute-all endpoint:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Smart prompt endpoint that chooses necessary skills
app.post('/api/prompt', async (req: any, res: any) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({
                error: 'Prompt is required',
                message: 'Please provide a prompt in the request body'
            });
        }

        console.log('🧠 Processing prompt with Gemini AI:', prompt);
        
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI('AIzaSyC-BH4oOoKeoTHIm5tBTGIbN6j9HlB8x80');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        console.log('🤖 Sending prompt to Gemini...');
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini response received successfully');
        console.log('Response choices:', text);
        
        res.json({
            success: true,
            response: text,
            model: 'gemini-1.5-flash',
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('❌ Gemini AI Error:', error);
        res.status(500).json({
            error: 'Failed to process prompt',
            message: error.message,
            details: error.response?.data || 'Internal server error'
        });
    }
});

// Chat endpoint using Smythos OpenAI-compatible API
app.post('/api/chat', async (req: any, res: any) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                error: 'Message is required',
                message: 'Please provide a message in the request body'
            });
        }

        console.log('💬 Processing chat message:', message);
        
        const openai = new OpenAI({
            apiKey: 'sk-97851db9-6a52-4ea1-b974-100209bc96f1',
            baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
        });

        const response = await openai.chat.completions.create({
            model: 'cmfwa1ah7ycfcjxgthiwbjwr9@dev',
            messages: [{ role: 'user', content: message }],
            stream: false,
        });

        console.log('✅ Chat response received successfully');
        console.log('Response choices:', response?.choices);
        
        res.json({
            success: true,
            response: response.choices[0].message.content,
            model: 'cmfwa1ah7ycfcjxgthiwbjwr9@dev',
            choices: response?.choices,
            usage: response?.usage,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('❌ Smythos Chat API Error:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            message: error.message,
            details: error.response?.data || 'Internal server error'
        });
    }
});

// Get list of skills available


// Start server
export const startServer = () => {
    return new Promise<void>((resolve) => {
        app.listen(PORT, () => {
            console.log(`🚀 API Server running on http://localhost:${PORT}`);
            console.log(`📚 Document Assistant Agent API is ready!`);
            console.log(`\nAvailable endpoints:`);
            console.log(`  GET  /health - Health check`);
            console.log(`  GET  /api/documents/pdfs - List all PDF files in data directory`);
            console.log(`  GET  /api/agent/skills - List all available skills`);
            console.log(`  POST /api/agent/skills/:skillName - Execute a specific skill`);
            console.log(`  POST /api/agent/skills/execute-all - Execute multiple skills`);
            console.log(`  GET  /api/prompt/test - Test Smythos API connection`);
            console.log(`  POST /api/prompt - Direct Gemini AI prompt processing`);
            console.log(`  POST /api/chat - Chat using Smythos OpenAI-compatible API`);
            console.log(`  POST /api/agent/prompt - Send natural language prompt to agent`);
            resolve();
        });
    });
};

export default app;