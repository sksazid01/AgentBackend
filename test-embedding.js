import BookAssistantAgent from './dist/index.js';

// Test the embedding system
async function testEmbedding() {
    try {
        console.log('Testing Gemini embedding system...');
        
        // First, try to index a book
        console.log('1. Testing book indexing...');
        const indexResult = await BookAssistantAgent.call('index_book', {
            book_path: 'data/bitcoin.pdf'
        });
        console.log('Index result:', indexResult);
        
        // Then, try to search for something
        console.log('2. Testing book lookup...');
        const searchResult = await BookAssistantAgent.call('lookup_book', {
            user_query: 'What is Bitcoin?'
        });
        console.log('Search result:', searchResult);
        
        console.log('✅ Gemini embedding system test completed successfully!');
    } catch (error) {
        console.error('❌ Error testing embedding system:', error);
        console.error('Stack trace:', error.stack);
    }
}

testEmbedding();