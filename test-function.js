// Load environment variables
require('dotenv').config({ path: '.env' });

// Test the serverless function directly
const { handler } = require('./functions/telegram-bot');

console.log('Environment variables loaded:');
console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '***' : 'Not set');
console.log('- NOTION_API_KEY:', process.env.NOTION_API_KEY ? '***' : 'Not set');
console.log('- NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID || 'Not set');

// Create a test event
const testEvent = {
  httpMethod: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    update_id: 10000,
    message: {
      message_id: 1,
      from: {
        id: 714320320,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      chat: {
        id: 714320320,
        first_name: 'Test',
        username: 'testuser',
        type: 'private'
      },
      date: 1600000000,
      text: '/start'
    }
  })
};

// Run the handler
handler(testEvent, {})
  .then(result => {
    console.log('Function result:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Function error:', error);
  });
