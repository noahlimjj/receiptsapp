const axios = require('axios');

// This is a test script to simulate a Telegram webhook event
async function testWebhook() {
  try {
    const webhookUrl = 'https://68b0ff28d95c.ngrok-free.app/.netlify/functions/telegram-bot';
    
    // Sample Telegram update object (simulating a message with a photo)
    const update = {
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
    };

    console.log('Sending POST request to:', webhookUrl);
    console.log('Request payload:', JSON.stringify(update, null, 2));
    
    const response = await axios({
      method: 'post',
      url: webhookUrl,
      data: update,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Resolve any status code < 500
      }
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error testing webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testWebhook();
