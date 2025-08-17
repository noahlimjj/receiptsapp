const { handler } = require('./functions/telegram-bot');
const fs = require('fs');
require('dotenv').config();

// Create a test event with a photo message
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
      photo: [
        {
          file_id: 'test_photo_1',
          file_unique_id: 'unique_test_photo_1',
          file_size: 1000,
          width: 100,
          height: 100
        }
      ]
    }
  })
};

// Mock the Telegram bot methods
const mockGetFile = jest.fn().mockResolvedValue({
  file_path: 'test/path/to/photo.jpg'
});

const mockSendMessage = jest.fn().mockResolvedValue({});

// Mock the Notion client
const mockPagesCreate = jest.fn().mockResolvedValue({});

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    getFile: mockGetFile,
    sendMessage: mockSendMessage
  }));
});

jest.mock('@notionhq/client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    pages: {
      create: mockPagesCreate
    }
  }))
}));

// Run the test
describe('Telegram Bot Handler', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should handle a photo message', async () => {
    // Call the handler with the test event
    const response = await handler(testEvent, {});

    // Verify the response
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).status).toBe('OK');

    // Verify the bot was called with the correct arguments
    expect(mockGetFile).toHaveBeenCalledWith('test_photo_1');
    expect(mockSendMessage).toHaveBeenCalled();
    
    // Verify Notion was called
    expect(mockPagesCreate).toHaveBeenCalled();
  });
});

// Run the test
(async () => {
  try {
    console.log('Running test...');
    const response = await handler(testEvent, {});
    console.log('Response:', response);
  } catch (error) {
    console.error('Test failed:', error);
  }
})();
