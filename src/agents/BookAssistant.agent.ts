import { Agent, Doc, Model, VectorDB } from '@smythos/sdk';
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

/**
 * This is an example of a simple agent where the skills are implemented programmatically
 *
 */

// Ensure Smythos vault exists for production environment
const ensureSmythVault = () => {
    const vaultPath = process.env.SMYTH_VAULT_PATH || path.join(process.env.HOME || process.cwd(), '.smyth', '.sre', 'vault.json');
    
    console.log('🔍 Checking Smythos vault at:', vaultPath);
    console.log('🔑 Environment variables available:');
    console.log('  PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Set' : 'Missing');
    console.log('  GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set' : 'Missing');
    console.log('  googleai:', process.env.googleai ? 'Set' : 'Missing');
    
    if (!fs.existsSync(vaultPath)) {
        console.log('🔧 Creating Smythos vault configuration...');
        
        const vaultDir = path.dirname(vaultPath);
        fs.mkdirSync(vaultDir, { recursive: true });
        
        const vaultConfig = {
            default: {
                echo: "",
                openai: process.env.OPENAI_API_KEY || "",
                anthropic: process.env.ANTHROPIC_API_KEY || "",
                googleai: process.env.GOOGLE_AI_API_KEY || process.env.googleai || "",
                groq: process.env.GROQ_API_KEY || "",
                togetherai: process.env.TOGETHER_API_KEY || "",
                xai: process.env.XAI_API_KEY || "",
                deepseek: process.env.DEEPSEEK_API_KEY || "",
                tavily: process.env.TAVILY_API_KEY || "",
                scrapfly: process.env.SCRAPFLY_API_KEY || ""
            }
        };
        
        fs.writeFileSync(vaultPath, JSON.stringify(vaultConfig, null, 2));
        console.log('✅ Smythos vault created at:', vaultPath);
        console.log('📝 Configured keys:', Object.entries(vaultConfig.default)
            .filter(([key, value]) => value !== "")
            .map(([key]) => key)
        );
    } else {
        // Update existing vault with environment variables
        console.log('🔄 Updating existing vault with environment variables...');
        try {
            const existingVault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
            const updatedVault = {
                ...existingVault,
                default: {
                    ...existingVault.default,
                    openai: process.env.OPENAI_API_KEY || existingVault.default?.openai || "",
                    anthropic: process.env.ANTHROPIC_API_KEY || existingVault.default?.anthropic || "",
                    googleai: process.env.GOOGLE_AI_API_KEY || process.env.googleai || existingVault.default?.googleai || "",
                    groq: process.env.GROQ_API_KEY || existingVault.default?.groq || "",
                    togetherai: process.env.TOGETHER_API_KEY || existingVault.default?.togetherai || "",
                    xai: process.env.XAI_API_KEY || existingVault.default?.xai || "",
                    deepseek: process.env.DEEPSEEK_API_KEY || existingVault.default?.deepseek || "",
                    tavily: process.env.TAVILY_API_KEY || existingVault.default?.tavily || "",
                    scrapfly: process.env.SCRAPFLY_API_KEY || existingVault.default?.scrapfly || ""
                }
            };
            
            fs.writeFileSync(vaultPath, JSON.stringify(updatedVault, null, 2));
            console.log('✅ Vault updated with environment variables');
            console.log('📝 Active keys:', Object.entries(updatedVault.default)
                .filter(([key, value]) => value !== "")
                .map(([key]) => key)
            );
        } catch (error) {
            console.error('❌ Failed to update vault:', error);
        }
    }
};

// Initialize vault before creating agent
ensureSmythVault();

const __dirname = process.cwd();
const BOOKS_NAMESPACE = 'books';

// Debug: Log critical environment variables
console.log('🔧 Critical Environment Variables Check:');
console.log('  PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Set ✓' : 'Missing ❌');
console.log('  GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set ✓' : 'Missing ❌');
console.log('  googleai fallback:', process.env.googleai ? 'Set ✓' : 'Missing ❌');

// Global skill execution gate - prevents repeated tool calls per user input
class SkillExecutionGate {
    private executedSkills = new Set<string>();
    private currentInputId = '';
    private skillResults = new Map<string, string>();
    
    startNewInput(inputId: string) {
        this.currentInputId = inputId;
        this.executedSkills.clear();
        this.skillResults.clear();
        console.log(`[GATE] New input session: ${inputId}`);
    }
    
    canExecute(skillName: string): boolean {
        const key = `${this.currentInputId}:${skillName}`;
        if (this.executedSkills.has(key)) {
            console.log(`[GATE] Blocking repeated execution of ${skillName} - already executed in this session`);
            return false;
        }
        this.executedSkills.add(key);
        console.log(`[GATE] Allowing execution of ${skillName}`);
        return true;
    }
    
    markCompleted(skillName: string, result: string) {
        const key = `${this.currentInputId}:${skillName}`;
        this.skillResults.set(key, result);
        console.log(`[GATE] Skill ${skillName} completed with result`);
    }
    
    isAlreadyExecuted(skillName: string): boolean {
        const key = `${this.currentInputId}:${skillName}`;
        return this.executedSkills.has(key);
    }
    
    getBlockedMessage(skillName: string): string {
        const key = `${this.currentInputId}:${skillName}`;
        const result = this.skillResults.get(key);
        if (result) {
            return `✅ TASK ALREADY COMPLETED: ${result}`;
        }
        return `✅ TASK ALREADY COMPLETED: The ${skillName} operation has already been successfully executed in this session. No further action is needed.`;
    }
}

const skillGate = new SkillExecutionGate();

// Simple tracking - reset on application restart
let purgeExecuted = false;

//#region [ Agent Instance] ===================================

//We create the agent instance
const agent = new Agent({
    id: 'book-assistant', //<=== agent id is important for data isolation in vector DBs and Storage

    //the name of the agent, this is how the agent will identify itself
    name: 'Book Assistant',

    //here we are using a builtin model
    //note that we are not passing an apiKey because we will rely on smyth vault for the model credentials
    model: 'gemini-2.0-flash',

    //the behavior of the agent, this describes the personnality and behavior of the agent
    behavior: `You are a helpful document assistant. 

CRITICAL EXECUTION RULES:
1. Call each skill EXACTLY ONCE per user request
2. After calling a skill and receiving ANY response, IMMEDIATELY respond to the user with the result
3. DO NOT attempt to call the same skill again or any other skills after getting ANY response
4. If you receive a "TASK COMPLETE" or "TASK ALREADY COMPLETED" message, your job is FINISHED - respond to the user immediately
5. If you receive any blocking or already executed message, tell the user it was completed and STOP

WORKFLOW:
- For indexing requests: Call index_document ONCE → Get ANY response → Tell user the result → STOP IMMEDIATELY
- For search requests: Call lookup_document ONCE → Get ANY response → Tell user the result → STOP IMMEDIATELY  
- For delete requests: Call purge_documents ONCE → Get ANY response → Tell user the result → STOP IMMEDIATELY
- For info requests: Call get_document_info ONCE → Get ANY response → Tell user the result → STOP IMMEDIATELY

CRITICAL: After receiving ANY skill response (success, error, or blocked), you MUST immediately provide a final response to the user and stop processing. Never attempt additional skill calls or actions.

Available skills:
- index_document: Index a PDF document 
- lookup_document: Search in documents
- purge_documents: Delete all documents  
- get_document_info: Get document information

Be concise and direct. Complete your response immediately after receiving ANY skill result.`,
});

//We create a Pinecone vectorDB instance, at the agent scope
//Pinecone is a production-ready vector database for remote storage
const pinecone = agent.vectorDB.Pinecone(BOOKS_NAMESPACE, {
    indexName: 'ilts',
    apiKey: process.env.PINECONE_API_KEY,
    embeddings: Model.GoogleAI('gemini-embedding-001', { 
        apiKey: process.env.GOOGLE_AI_API_KEY || process.env.googleai 
    }),
});

//#endregion

//#region [ Skills ] ===================================

//Index a document in Pinecone vector database
const indexDocumentSkill = agent.addSkill({
    name: 'index_document',
    description: 'Use this skill to index a document in a vector database. The user can provide just the filename (e.g., "bitcoin.pdf") and it will automatically look in the data directory.',
    process: async ({ document_path }) => {
        // Check execution gate
        if (!skillGate.canExecute('index_document')) {
            const blockedMsg = skillGate.getBlockedMessage('index_document');
            console.log(`[GATE] Returning blocked message: ${blockedMsg}`);
            return blockedMsg;
        }
        
        try {
            // Auto-prepend 'data/' if the path doesn't already include it and isn't absolute
            let processedPath = document_path;
            if (!path.isAbsolute(document_path) && !document_path.startsWith('data/') && !document_path.includes('/')) {
                processedPath = `data/${document_path}`;
                console.log(`[DEBUG] Auto-prepended 'data/' to filename: ${processedPath}`);
            }
            
            console.log(`[DEBUG] Attempting to index document: ${processedPath}`);
            console.log(`[DEBUG] Using index name: ilts`);
            
            // Handle both relative and absolute paths, and clean up duplicated directory names
            let filePath;
            if (path.isAbsolute(processedPath)) {
                filePath = processedPath;
            } else {
                // Remove leading 'agentbackend/' if present since we're already in that directory
                const cleanPath = processedPath.replace(/^agentbackend\//, '');
                filePath = path.resolve(__dirname, cleanPath);
            }
            
            console.log(`[DEBUG] Resolved file path: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
                const errorMsg = `File resolved path to ${filePath} does not exist`;
                console.log(`[ERROR] ${errorMsg}`);
                skillGate.markCompleted('index_document', errorMsg);
                return errorMsg;
            }

            console.log(`[DEBUG] Parsing document...`);
            const parsedDoc = await Doc.pdf.parse(filePath);
            console.log(`[DEBUG] Document parsed successfully`);

            const name = path.basename(filePath);
            console.log(`[DEBUG] Inserting document ${name} into Pinecone vector DB...`);
            console.log(`[DEBUG] Document will be inserted with namespace: ${BOOKS_NAMESPACE}`);
            
            // Test Pinecone connection first
            try {
                console.log(`[DEBUG] Testing Pinecone connection...`);
                const testResult = await pinecone.search('test', { topK: 1 });
                console.log(`[DEBUG] Pinecone connection successful`);
            } catch (connError) {
                console.log(`[ERROR] Pinecone connection failed:`, connError.message);
                const errorMsg = `Pinecone connection failed: ${connError.message}`;
                skillGate.markCompleted('index_document', errorMsg);
                return errorMsg;
            }
            
            const result = await pinecone.insertDoc(name, parsedDoc, { 
                fileName: name, 
                indexedAt: new Date().toISOString(),
                namespace: BOOKS_NAMESPACE 
            });
            console.log(`[DEBUG] Insert result:`, result);

            if (result) {
                const successMsg = `✅ TASK COMPLETE: Document ${name} has been successfully indexed in the vector database. The indexing operation is finished. Do not perform any additional actions.`;
                console.log(`[SUCCESS] ${successMsg}`);
                skillGate.markCompleted('index_document', successMsg);
                
                return successMsg;
            } else {
                const failMsg = `❌ Document ${name} indexing failed - no result returned`;
                console.log(`[ERROR] ${failMsg}`);
                skillGate.markCompleted('index_document', failMsg);
                return failMsg;
            }
        } catch (error) {
            const errorMsg = `❌ Error indexing document: ${error.message}`;
            console.error(`[ERROR] ${errorMsg}`, error);
            console.error(`[ERROR] Stack trace:`, error.stack);
            skillGate.markCompleted('index_document', errorMsg);
            return errorMsg;
        }
    },
});

// Add input description for index_document skill
indexDocumentSkill.in({
    document_path: {
        description: 'Name of the document file (e.g., "bitcoin.pdf"). The system will automatically look in the data directory. You can also provide full paths like "data/bitcoin.pdf"',
    },
});

//Lookup a document in Pinecone vector database
agent.addSkill({
    name: 'lookup_document',
    description: 'Use this skill ONCE to lookup content in the Pinecone vector database. Do not call this skill multiple times for the same query.',
    process: async ({ user_query }) => {
        // Check execution gate
        if (!skillGate.canExecute('lookup_document')) {
            const blockedMsg = skillGate.getBlockedMessage('lookup_document');
            console.log(`[GATE] Returning blocked message: ${blockedMsg}`);
            return blockedMsg;
        }
        
        try {
            console.log(`[DEBUG] Searching for: "${user_query}"`);
            
            const result = await pinecone.search(user_query, {
                topK: 3,
            });
            
            console.log(`[DEBUG] Search completed. Found ${result?.length || 0} results`);
            
            if (!result || result.length === 0) {
                const noResultMsg = "❌ No relevant content found in the indexed documents. Please make sure documents are indexed first using the 'index_document' skill.";
                skillGate.markCompleted('lookup_document', noResultMsg);
                return noResultMsg;
            }
            
            // Simple approach - just return the first result's text
            const firstResult = result[0];
            const text = firstResult.text || firstResult.content || firstResult.pageContent || 'No text found in result';
            const source = firstResult.metadata?.fileName || firstResult.metadata?.datasourceLabel || 'PDF Document';
            
            console.log(`[DEBUG] Extracted text length:`, text.length);
            
            const response = `✅ SEARCH COMPLETE: Found relevant content from ${source}:\n\n${text}\n\nThe search operation is finished. Do not perform any additional actions.`;
            console.log(`[DEBUG] Returning response successfully`);
            skillGate.markCompleted('lookup_document', response);
            
            return response;
            
        } catch (error) {
            const errorMsg = `❌ Error searching documents: ${error.message}`;
            console.error(`[ERROR] ${errorMsg}`, error);
            skillGate.markCompleted('lookup_document', errorMsg);
            return errorMsg;
        }
    },
});

// Helper to purge ALL namespaces from the Pinecone index (bypasses SDK scoping)
async function purgeAllNamespacesDirect(): Promise<{ purged: string[] }> {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = 'ilts';
    if (!apiKey) throw new Error('Missing PINECONE_API_KEY');
    const client = new Pinecone({ apiKey });
    const index = client.Index(indexName);
    const stats = await index.describeIndexStats();
    const namespaces = Object.keys((stats as any)?.namespaces || {});

    const purged: string[] = [];
    for (const ns of namespaces) {
        try {
            await index.namespace(ns).deleteAll();
            purged.push(ns);
        } catch (e) {
            console.warn(`[WARN] Failed to purge namespace '${ns}':`, (e as any)?.message || e);
        }
    }
    return { purged };
}

//Purge all data from Pinecone vector database (useful for testing)
const purgeSkill = agent.addSkill({
    name: 'purge_documents',
    description: 'Use this skill to remove all indexed documents from the vector database. WARNING: This will delete all data! Only call this once per user request.',
    process: async (params) => {
        console.log(`[DEBUG] Purge skill called with params:`, params);
        
        // Check execution gate
        if (!skillGate.canExecute('purge_documents')) {
            const blockedMsg = skillGate.getBlockedMessage('purge_documents');
            console.log(`[GATE] Returning blocked message: ${blockedMsg}`);
            return blockedMsg;
        }
        
        try {
            console.log(`[DEBUG] Executing Pinecone purge operation (SDK-scoped namespace)...`);
            await pinecone.purge();

            console.log(`[DEBUG] Purging ALL namespaces directly from Pinecone index for completeness...`);
            const { purged } = await purgeAllNamespacesDirect();
            console.log(`[DEBUG] Purged namespaces:`, purged);
            
            // Mark as executed for this session
            purgeExecuted = true;
            
            const successMsg = `✅ DELETION COMPLETE: All PDF documents have been successfully removed from the vector database. The database is now empty. (Purged ${purged.length} namespaces: ${purged.join(', ')}) Do not perform any additional actions.`;
            console.log(`[SUCCESS] ${successMsg}`);
            skillGate.markCompleted('purge_documents', successMsg);
            return successMsg;
            
        } catch (error) {
            console.error(`[ERROR] Purge operation failed:`, error.message);
            const errorMsg = `Failed to delete documents: ${error.message}`;
            skillGate.markCompleted('purge_documents', errorMsg);
            return errorMsg;
        }
    },
});

// Add explicit input validation to prevent retries
purgeSkill.in({
    confirmation: {
        description: 'Set to "yes" to confirm deletion of all documents',
        optional: true
    }
});

//Openlibrary lookup : this is a simple skill that uses the openlibrary API to get information about a book
const openlibraryLookupSkill = agent.addSkill({
    name: 'get_document_info',
    description: 'Use this skill to get information about a document/book',
    process: async ({ document_name }) => {
        // Check execution gate
        if (!skillGate.canExecute('get_document_info')) {
            const blockedMsg = skillGate.getBlockedMessage('get_document_info');
            console.log(`[GATE] Returning blocked message: ${blockedMsg}`);
            return blockedMsg;
        }
        
        try {
            const url = `https://openlibrary.org/search.json?q=${document_name}`;
            const response = await fetch(url);
            const data = await response.json();
            const result = data.docs[0];
            
            skillGate.markCompleted('get_document_info', JSON.stringify(result));
            return result;
        } catch (error) {
            const errorMsg = `Error fetching document info: ${error.message}`;
            skillGate.markCompleted('get_document_info', errorMsg);
            return errorMsg;
        }
    },
});

//The skill that we just created requires a document_name input,
// sometime the agent LLM will need a description or more details about the input in order to use it properly
//below we add a description to the document_name input in order to tell the LLM how to use it
openlibraryLookupSkill.in({
    document_name: {
        description: 'This need to be a name of a document/book, extract it from the user query',
    },
});

//#endregion

export { skillGate };
export default agent;
