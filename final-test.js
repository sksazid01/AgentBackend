import OpenAI from 'openai';

console.log('🧪 Final API Key Test - Simple Request');

const openai = new OpenAI({
  apiKey: 'sk-ab099078-b39c-4d50-9522-13a3c1143e04',
  baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
});

try {
  // Try to list models first (simpler request)
  console.log('🔍 Trying to list models...');
  const models = await openai.models.list();
  console.log('✅ Models list successful!');
  console.log('Available models:', models.data?.map(m => m.id) || 'None');
  
} catch (error) {
  console.log('❌ Models list failed:', error.message);
  console.log('Status:', error.status);
  
  // Try a basic chat completion with minimal parameters
  try {
    console.log('\n🔄 Trying basic chat completion...');
    const response = await openai.chat.completions.create({
      model: 'cmfwa1ah7ycfcjxgthiwbjwr9@dev',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    
    console.log('✅ Chat completion successful!');
    console.log('Response:', response?.choices?.[0]?.message?.content);
    
  } catch (chatError) {
    console.log('❌ Chat completion failed:', chatError.message);
    console.log('Status:', chatError.status);
    console.log('Details:', {
      code: chatError.code,
      type: chatError.type,
      param: chatError.param
    });
  }
}