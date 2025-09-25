import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import BookAssistantAgent, { skillGate } from '../agents/BookAssistant.agent.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SEND_EMAIL_URL = process.env.SEND_EMAIL_URL || 'https://cmfwa1ah7ycfcjxgthiwbjwr9.agent.pa.smyth.ai/api/send_email';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Alias health endpoint to match availableAPIs mapping
app.get('/api/health', (req, res) => {
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
            },
            {
                name: 'send_email',
                description: 'Send an email to specified recipients with subject and body content',
                inputs: { 
                    to: { description: 'Email recipient address', required: true },
                    subject: { description: 'Email subject', required: false },
                    body: { description: 'Email body content', required: false }
                }
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

        console.log('🧠 Processing intelligent prompt:', prompt);
        
        // Define available API endpoints with their descriptions
        const availableAPIs = {
            "health_check": {
                "method": "GET",
                "path": "/api/health",
                "description": "Check the health status of the agent backend system",
                "body": null
            },
            "list_skills": {
                "method": "GET", 
                "path": "/api/agent/skills",
                "description": "Get a list of all available skills from the agent backend",
                "body": null
            },
            "execute_skill": {
                "method": "POST",
                "path": "/api/agent/skills/:skillName",
                "description": "Execute a specific skill by providing the skill name",
                "body": {}
            },
            "execute_all_skills": {
                "method": "POST",
                "path": "/api/agent/skills/execute-all",
                "description": "Execute multiple skills in batch",
                "body": {"skillsToExecute": []}
            },
            "search_documents": {
                "method": "POST",
                "path": "/api/agent/skills/lookup_document",
                "description": "Search through indexed documents using a query",
                "body": {"user_query": ""}
            },
            "get_document_info": {
                "method": "POST",
                "path": "/api/agent/skills/get_document_info", 
                "description": "Get detailed information about a specific document",
                "body": {"document_name": ""}
            },
            "purge_documents": {
                "method": "POST",
                "path": "/api/agent/skills/purge_documents",
                "description": "Remove all indexed documents from the vector database",
                "body": {"confirmation": "yes"}
            },
            "index_document": {
                "method": "POST",
                "path": "/api/agent/skills/index_document",
                "description": "Index a document by providing the document path",
                "body": {"document_path": ""}
            },
            "list_documents": {
                "method": "GET",
                "path": "/api/documents/pdfs",
                "description": "Get a list of all available documents in the system",
                "body": null
            },
            "smart_answer": {
                "method": "POST",
                "path": "/api/agent/skills/lookup_document",
                "description": "Provide intelligent answers to user questions by automatically finding and searching relevant documents",
                "body": {"user_query": ""}
            },
            "send_email": {
                "method": "POST",
                "path": SEND_EMAIL_URL,
                "description": "Send an email to specified recipients with subject and body content",
                "body": {"to": "", "subject": "", "body": ""}
            }
        };

        // Create prompt for Gemini AI to analyze and choose the right API
        const analysisPrompt = `
You are an API routing assistant. Analyze the user's prompt and determine which API endpoint to call.

User Prompt: "${prompt}"

Available APIs:
${JSON.stringify(availableAPIs, null, 2)}

Instructions:
1. Analyze the user's intent from their prompt
2. Choose the most appropriate API from the available options
3. Extract any required parameters from the user's prompt
4. Return ONLY a JSON response in this exact format:

{
  "api_key": "chosen_api_key_from_available_apis",
  "parameters": {object_with_extracted_parameters},
  "reasoning": "brief explanation of why this API was chosen"
}

Examples:
- If user asks "What documents do you have?", choose "list_documents"
- If user asks "Search for information about Bitcoin", choose "search_documents" with user_query parameter
- If user asks "Index the bitcoin.pdf file", choose "index_document" with document_path parameter
- If user asks "Tell me about Bitcoin document", choose "get_document_info" with document_name parameter
- If user asks "send email to bob@example.com body: hello sub: hi", choose "send_email" with parameters {"to":"bob@example.com","subject":"hi","body":"hello"}

Return only valid JSON, no other text.
        `;

        // Send to Gemini AI for analysis
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        console.log('🤖 Sending prompt to Gemini for API analysis...');
        
        const result = await model.generateContent(analysisPrompt);
        const response = await result.response;
        const analysisText = response.text();
        
        console.log('✅ Gemini analysis received:', analysisText);
        
        // Parse Gemini's response
        let analysis;
        try {
            // Clean the response to extract JSON
            const cleanedResponse = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            analysis = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('❌ Failed to parse Gemini response:', parseError);
            return res.status(500).json({
                error: 'Failed to analyze prompt',
                message: 'Could not determine appropriate API endpoint'
            });
        }

        const chosenAPI = availableAPIs[analysis.api_key];
        if (!chosenAPI) {
            return res.status(400).json({
                error: 'Invalid API chosen',
                message: `API "${analysis.api_key}" not found in available endpoints`
            });
        }

        console.log(`🎯 Chosen API: ${analysis.api_key} - ${chosenAPI.description}`);
        console.log(`📝 Reasoning: ${analysis.reasoning}`);
        
        // Make the API call internally
        let apiResult;
        const baseURL = `http://localhost:${PORT}`;
        
        try {
            if (chosenAPI.method === 'GET') {
                const getUrl = chosenAPI.path.startsWith('http') ? chosenAPI.path : `${baseURL}${chosenAPI.path}`;
                const response = await fetch(getUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                apiResult = await response.json();
            } else {
                // POST request
                let requestBody = chosenAPI.body || {};
                let apiPath = chosenAPI.path;
                
                // Handle dynamic skill paths
                if (apiPath.includes(':skillName') && analysis.parameters?.skillName) {
                    apiPath = apiPath.replace(':skillName', analysis.parameters.skillName);
                    // Remove skillName from body since it's in the URL
                    const { skillName, ...bodyParams } = analysis.parameters;
                    requestBody = { ...requestBody, ...bodyParams };
                } else {
                    // Merge extracted parameters
                    if (analysis.parameters) {
                        requestBody = { ...requestBody, ...analysis.parameters };
                    }
                }

                // Special handling and validation for send_email
                if (analysis.api_key === 'send_email') {
                    // Pre-parse original prompt for common patterns if values missing or empty
                    const original = typeof prompt === 'string' ? prompt : '';

                    // Extract 'to' if not provided or invalid
                    if (!requestBody.to || typeof requestBody.to !== 'string' || !/.+@.+\..+/.test(requestBody.to)) {
                        const emailMatch = original.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
                        if (emailMatch) {
                            requestBody.to = emailMatch[1];
                        }
                    }

                    // Extract subject/body from patterns like 'sub:'/'subject:' and 'body:'
                    const subjMatch = original.match(/(?:\bsub(?:ject)?\s*[:=-]\s*)([^\n;]+)/i);
                    const bodyMatch = original.match(/(?:\bbody\s*[:=-]\s*)([^\n;]+)/i);
                    if ((!requestBody.subject || requestBody.subject.trim() === '') && subjMatch) {
                        requestBody.subject = subjMatch[1].trim();
                    }
                    if ((!requestBody.body || requestBody.body.trim() === '') && bodyMatch) {
                        requestBody.body = bodyMatch[1].trim();
                    }

                    // Fallback: heuristic ordering 'send email to X ... subject Y ... body Z'
                    if (!requestBody.subject) {
                        const subjAlt = original.match(/subject\s+(?:is\s+)?"?([^"\n]+)"?/i);
                        if (subjAlt) requestBody.subject = subjAlt[1].trim();
                    }
                    if (!requestBody.body) {
                        const bodyAlt = original.match(/body\s+(?:is\s+)?"?([^"\n]+)"?/i);
                        if (bodyAlt) requestBody.body = bodyAlt[1].trim();
                    }

                    // Normalize fields
                    if (typeof requestBody.to === 'string') requestBody.to = requestBody.to.trim();
                    if (typeof requestBody.subject === 'string') requestBody.subject = requestBody.subject.trim();
                    if (typeof requestBody.body === 'string') requestBody.body = requestBody.body.trim();

                    // Validate recipient
                    if (!requestBody.to || typeof requestBody.to !== 'string') {
                        return res.status(400).json({
                            error: 'Validation error',
                            message: 'Recipient email (to) is required for send_email',
                            details: { provided: requestBody.to }
                        });
                    }
                    // Very light email shape check (not strict)
                    const simpleEmail = /.+@.+\..+/;
                    if (!simpleEmail.test(requestBody.to)) {
                        return res.status(400).json({
                            error: 'Validation error',
                            message: 'Invalid email format for recipient (to)'
                        });
                    }

                    // Defaults for optional fields
                    if (!requestBody.subject) requestBody.subject = 'No Subject';
                    if (!requestBody.body) requestBody.body = 'No content';
                }
                
                const endpoint = apiPath.startsWith('http') ? apiPath : `${baseURL}${apiPath}`;
                console.log('🔗 Making API call to:', endpoint);
                console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }
                
                apiResult = await response.json();
            }
            
            console.log('✅ API call completed successfully');
            
        } catch (apiError) {
            console.error('❌ API call failed:', apiError);
            return res.status(500).json({
                error: 'API call failed',
                message: apiError.message,
                chosenAPI: {
                    key: analysis.api_key,
                    method: chosenAPI.method,
                    path: chosenAPI.path,
                    description: chosenAPI.description
                },
                parameters: analysis.parameters
            });
        }

        // Return the complete result
        res.json({
            success: true,
            originalPrompt: prompt,
            chosenAPI: {
                key: analysis.api_key,
                method: chosenAPI.method,
                path: chosenAPI.path,
                description: chosenAPI.description
            },
            reasoning: analysis.reasoning,
            parameters: analysis.parameters,
            result: apiResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('❌ Smart prompt processing error:', error);
        res.status(500).json({
            error: 'Failed to process smart prompt',
            message: error.message,
            details: error.stack
        });
    }
});

// // Chat endpoint using Smythos OpenAI-compatible API
// app.post('/api/chat', async (req: any, res: any) => {
//     try {
//         const { message } = req.body;
        
//         if (!message) {
//             return res.status(400).json({
//                 error: 'Message is required',
//                 message: 'Please provide a message in the request body'
//             });
//         }

//         console.log('💬 Processing chat message:', message);
        
//         // Initialize OpenAI client with environment variables
//         const apiKey = process.env.SMYTHOS_API_KEY;
//         const baseURL = process.env.SMYTHOS_BASE_URL;
//         const model = process.env.SMYTHOS_MODEL;
        
//         if (!apiKey || !baseURL || !model) {
//             throw new Error('Missing required Smythos environment variables (SMYTHOS_API_KEY, SMYTHOS_BASE_URL, SMYTHOS_MODEL)');
//         }
        
//         const openai = new OpenAI({
//             apiKey: apiKey,
//             baseURL: baseURL,
//         });

//         const response = await openai.chat.completions.create({
//             model: model,
//             messages: [{ role: 'user', content: message }],
//             stream: false,
//         });

//         console.log('✅ Chat response received successfully');
//         console.log('Response choices:', response?.choices);
        
//         res.json({
//             success: true,
//             response: response.choices[0].message.content,
//             model: model,
//             choices: response?.choices,
//             usage: response?.usage,
//             timestamp: new Date().toISOString()
//         });
        
//     } catch (error: any) {
//         console.error('❌ Smythos Chat API Error:', error);
//         res.status(500).json({
//             error: 'Failed to process chat message',
//             message: error.message,
//             details: error.response?.data || 'Internal server error'
//         });
//     }
// });

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