import express from 'express';
import cors from 'cors';
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

// Get all available skills
app.get('/api/agent/skills', (req, res) => {
    try {
        // Manually define the available skills since we can't access them via the SDK
        const skills = [
            {
                name: 'index_book',
                description: 'Use this skill to index a book in a vector database. The user will provide the path to the book (e.g., "data/bitcoin.pdf" or "agentbackend/data/bitcoin.pdf")',
                inputs: { book_path: { description: 'Path to the PDF book file', required: true } }
            },
            {
                name: 'lookup_book',
                description: 'Use this skill ONCE to lookup content in the Pinecone vector database. Do not call this skill multiple times for the same query.',
                inputs: { user_query: { description: 'The search query to find in books', required: true } }
            },
            {
                name: 'purge_books',
                description: 'Use this skill to remove all indexed books from the vector database. WARNING: This will delete all data! Only call this once per user request.',
                inputs: { confirmation: { description: 'Set to "yes" to confirm deletion of all books', required: false } }
            },
            {
                name: 'get_book_info',
                description: 'Use this skill to get information about a book',
                inputs: { book_name: { description: 'This need to be a name of a book, extract it from the user query', required: true } }
            }
        ];
        
        res.json({
            success: true,
            data: {
                agentId: 'book-assistant',
                agentName: 'Book Assistant',
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

// Prompt the agent with natural language
app.post('/api/agent/prompt', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'message is required'
            });
        }
        
        // Generate a unique input ID for the skill execution gate
        const inputId = `api-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        skillGate.startNewInput(inputId);
        
        console.log(`[API] Processing prompt: ${message}`);
        
        const result = await BookAssistantAgent.prompt(message);
        
        res.json({
            success: true,
            data: {
                prompt: message,
                response: result,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] Error processing prompt:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Start server
export const startServer = () => {
    return new Promise<void>((resolve) => {
        app.listen(PORT, () => {
            console.log(`🚀 API Server running on http://localhost:${PORT}`);
            console.log(`📚 Book Assistant Agent API is ready!`);
            console.log(`\nAvailable endpoints:`);
            console.log(`  GET  /health - Health check`);
            console.log(`  GET  /api/agent/skills - List all available skills`);
            console.log(`  POST /api/agent/skills/:skillName - Execute a specific skill`);
            console.log(`  POST /api/agent/skills/execute-all - Execute multiple skills`);
            console.log(`  POST /api/agent/prompt - Send natural language prompt to agent`);
            resolve();
        });
    });
};

export default app;