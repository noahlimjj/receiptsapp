// Mock the Telegram Bot API
const mockGetFile = jest.fn().mockResolvedValue({
  file_path: 'test/path/to/photo.jpg'
});

const mockSendMessage = jest.fn().mockResolvedValue({});

// Create a mock class for TelegramBot
class MockTelegramBot {
  constructor() {
    this.getFile = mockGetFile;
    this.sendMessage = mockSendMessage;
  }
}

// Mock the Notion client
const mockPagesCreate = jest.fn().mockResolvedValue({});
const mockNotionClient = jest.fn().mockImplementation(() => ({
  pages: {
    create: mockPagesCreate
  }
}));

// Mock the modules before requiring the handler
jest.mock('node-telegram-bot-api', () => MockTelegramBot);

jest.mock('@notionhq/client', () => ({
  Client: mockNotionClient
}));

// Now require the handler after setting up mocks
const { handler } = require('../functions/telegram-bot');
require('dotenv').config();

describe('Telegram Bot Handler', () => {
  let testEvent;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a test event with a photo message
    testEvent = {
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

  it('should handle OPTIONS request for CORS', async () => {
    const optionsEvent = {
      ...testEvent,
      httpMethod: 'OPTIONS'
    };
    
    const response = await handler(optionsEvent, {});
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});
