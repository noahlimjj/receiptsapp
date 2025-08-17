// Simple script to test the Telegram bot handler
const { handler } = require('./functions/telegram-bot');
const fs = require('fs');
require('dotenv').config();

// Create a test event with a text message
const testEvent = {
  httpMethod: 'POST',
  path: '/.netlify/functions/telegram-bot',
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
      text: '/start',
      entities: [
        {
          offset: 0,
          length: 6,
          type: 'bot_command'
        }
      ]
    }
  })
};

console.log('Testing Telegram bot handler with a /start command...');

// Call the handler with the test event
handler(testEvent, {})
  .then(response => {
    console.log('Handler response:', JSON.stringify(response, null, 2));
  })
  .catch(error => {
    console.error('Error in handler:', error);
  });
