//IMPORTANT NOTE : Your API keys are configured in one of the following files :
//  .smyth/.sre/vault.json
//  ~/.smyth/.sre/vault.json

//Edit the vault.json file to update your API keys

import BookAssistantAgent from './agents/BookAssistant.agent.js';
import { runChat } from './utils/TerminalChat.js';
import { startServer } from './api/server.js';

const main = async () => {
    // Check command line arguments to determine mode
    const args = process.argv.slice(2);
    const mode = args[0] || 'api'; // default to API mode
    
    if (mode === 'chat') {
        console.log('Starting Book Assistant Chat...');
        
        //Use the Book Assistant agent
        const agent = BookAssistantAgent;

        //Create a chat object from the agent
        //this is used to identify the chat session, using the same ID will load the previous chat session
        const sessionId = `my-chat-session-book-assistant`;
        const chat = agent.chat({
            id: sessionId,
            persist: true,
        });

        //Run the chat session in the terminal (pass agent for direct skill calls on special intents)
        runChat(chat, agent);
    } else {
        console.log('Starting Book Assistant API Server...');
        
        // Start the Express API server
        await startServer();
        
        console.log(`\n📖 Book Assistant is ready to help!`);
        console.log(`\nTo test the API, try these commands:`);
        console.log(`  curl http://localhost:5000/health`);
        console.log(`  curl http://localhost:5000/api/agent/skills`);
        console.log(`  curl -X POST http://localhost:5000/api/agent/skills/get_book_info -H "Content-Type: application/json" -d '{"book_name": "Bitcoin"}'`);
        console.log(`\nTo run in chat mode instead: npm start chat`);
    }
};

main();

//Below you can find other ways to interact with the agent

//1. call a skill directly
// const result = await BookAssistantAgent.call('get_book_info', {
//     book_name: 'The Black Swan',
// });
// console.log(result);

//2. prompt
//const result = await BookAssistantAgent.prompt('Who is the author of the book "The Black Swan"?');
//console.log(result);

//3. prompt and stream response
// const stream = await BookAssistantAgent.prompt('Who is the author of the book "The Black Swan"?').stream();
// stream.on(TLLMEvent.Content, (content) => {
//     console.log(content);
// });
