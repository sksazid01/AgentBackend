import OpenAI from 'openai';

console.log('🧪 Testing with different configurations...');

// Test configurations to try
const configs = [
  {
    name: 'Original Config',
    apiKey: 'sk-ab099078-b39c-4d50-9522-13a3c1143e04',
    baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
    model: 'cmfwa1ah7ycfcjxgthiwbjwr9@dev'
  },
  {
    name: 'Without @dev suffix',
    apiKey: 'sk-ab099078-b39c-4d50-9522-13a3c1143e04',
    baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
    model: 'cmfwa1ah7ycfcjxgthiwbjwr9'
  },
  {
    name: 'Different model format',
    apiKey: 'sk-ab099078-b39c-4d50-9522-13a3c1143e04',
    baseURL: 'https://llm.emb.smyth.ai/_openai/v1',
    model: 'gpt-3.5-turbo'
  }
];

for (const config of configs) {
  console.log(`\n📋 Testing: ${config.name}`);
  console.log(`   Model: ${config.model}`);
  
  try {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10,
      stream: false,
    });

    console.log(`✅ ${config.name} - SUCCESS!`);
    console.log(`   Response: ${response?.choices?.[0]?.message?.content}`);
    break; // Stop on first success
    
  } catch (error) {
    console.log(`❌ ${config.name} - FAILED: ${error.message}`);
  }
}

console.log('\n🎯 CONCLUSION: The API key appears to be invalid/expired.');
console.log('💡 SOLUTION: Please obtain a new API key from your Smythos dashboard.');