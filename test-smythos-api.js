import OpenAI from 'openai';

console.log('🧪 Testing Smythos API connection...');
console.log('📋 Configuration:');
console.log('  API Key: sk-ab099078-b39c-4d50-9522-13a3c1143e04');
console.log('  Base URL: https://llm.emb.smyth.ai/_openai/v1');
console.log('  Model: cmfwa1ah7ycfcjxgthiwbjwr9@dev');
console.log('');

const openai = new OpenAI({
  apiKey: 'sk-ab099078-b39c-4d50-9522-13a3c1143e04',
  baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
});

try {
  console.log('🚀 Making API request...');
  
  const response = await openai.chat.completions.create({
    model: 'cmfwa1ah7ycfcjxgthiwbjwr9@dev',
    messages: [{ role: 'user', content: 'Hello, what can you do?' }],
    stream: false,
  });

  console.log('✅ API call successful!');
  console.log('📝 Response:');
  console.log(response?.choices);
  
  if (response?.choices && response.choices.length > 0) {
    console.log('💬 Message content:');
    console.log(response.choices[0].message.content);
  }
  
  console.log('📊 Usage:');
  console.log(response?.usage);
  
} catch (error) {
  console.error('❌ API call failed:');
  console.error('Error message:', error.message);
  console.error('Error status:', error.status);
  console.error('Error code:', error.code);
  console.error('Error type:', error.type);
  console.error('Full error:', error);
}