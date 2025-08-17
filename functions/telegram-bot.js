const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('@notionhq/client');
const pdfParse = require('pdf-parse');
const Jimp = require('jimp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Handle incoming messages
exports.handler = async (event, context) => {
  // Log the raw incoming request
  console.log('=== Incoming Request ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('Headers:', event.headers);
  console.log('Raw Body:', event.body ? event.body.substring(0, 1000) + (event.body.length > 1000 ? '...' : '') : 'No body');
  
  // Handle preflight OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Try to parse and log the body if it exists
  let parsedBody;
  if (event.body) {
    try {
      parsedBody = JSON.parse(event.body);
      console.log('Parsed Body:', JSON.stringify(parsedBody, null, 2));
    } catch (e) {
      console.error('Failed to parse body as JSON:', e);
    }
  }

  try {
    // Check if the request is a POST request
    if (event.httpMethod !== 'POST') {
      console.log('Method not allowed:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ status: 'error', message: 'Method Not Allowed' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Use the already parsed body
    const update = parsedBody;
    console.log('Update object:', JSON.stringify(update, null, 2));
    
    const chatId = update.message?.chat?.id;
    const message = update.message;
    
    console.log('Chat ID:', chatId);
    console.log('Message:', message);
    
    if (!chatId) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'No chat ID' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Handle document (PDF) messages
    if (message.document) {
      const fileId = message.document.file_id;
      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      
      // Download the file
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      // Process PDF
      if (message.document.mime_type === 'application/pdf') {
        const pdfData = await pdfParse(buffer);
        await processReceipt(chatId, {
          text: pdfData.text,
          date: new Date(),
          type: 'pdf',
          fileUrl
        });
      }
    }
    // Handle photo messages
    else if (message.photo && message.photo.length > 0) {
      console.log('Received photo message:', JSON.stringify(message.photo, null, 2));
      
      // Get the highest resolution photo (last in the array)
      const photo = message.photo[message.photo.length - 1];
      console.log('Selected photo for processing:', JSON.stringify(photo, null, 2));
      
      try {
        // Get file info from Telegram
        const file = await bot.getFile(photo.file_id);
        console.log('File info from Telegram:', JSON.stringify(file, null, 2));
        
        // Construct the file URL
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        console.log('File URL:', fileUrl);
        
        // Process the receipt with the image URL
        await processReceipt(chatId, {
          text: 'Image receipt - manual processing required',
          date: new Date(),
          type: 'image',
          fileUrl
        });
        
        console.log('Successfully processed photo message');
      } catch (error) {
        console.error('Error processing photo:', error);
        await bot.sendMessage(chatId, 'Sorry, there was an error processing your photo. Please try again.');
        throw error; // Re-throw to be caught by the outer try-catch
      }
    }
    // Handle text messages
    else if (message.text) {
      await bot.sendMessage(chatId, 'Please send me a receipt (PDF or photo)');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'OK' }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Error processing request',
        error: error.message 
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// Process receipt and save to Notion
async function processReceipt(chatId, receipt) {
  try {
    console.log('Processing receipt for chat:', chatId);
    console.log('Receipt data:', JSON.stringify(receipt, null, 2));
    
    // Validate required fields
    if (!receipt || !receipt.date || !receipt.text) {
      throw new Error('Missing required receipt data');
    }
    
    // Ensure NOTION_DATABASE_ID is set
    if (!process.env.NOTION_DATABASE_ID) {
      throw new Error('NOTION_DATABASE_ID is not set in environment variables');
    }
    
    console.log('Creating Notion page in database:', process.env.NOTION_DATABASE_ID);
    
    // Create a new page in Notion
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: `Receipt from ${receipt.date.toLocaleDateString()}`
              }
            }
          ]
        },
        'Date': {
          date: {
            start: receipt.date.toISOString()
          }
        },
        'Type': {
          select: {
            name: receipt.type
          }
        },
        'Status': {
          select: {
            name: 'To Process'
          }
        },
        'Amount': {
          number: extractAmount(receipt.text)
        },
        'Receipt URL': {
          url: receipt.fileUrl
        }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: receipt.text.substring(0, 2000) // Truncate if too long
                }
              }
            ]
          }
        }
      ]
    });

    console.log('Successfully created Notion page:', response.id);
    await bot.sendMessage(chatId, '✅ Receipt saved to Notion!');
  } catch (error) {
    console.error('Error saving to Notion:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      status: error.status,
      code: error.code
    });
    await bot.sendMessage(chatId, `❌ Error saving receipt to Notion: ${error.message}`);
  }
}

// Helper function to extract amount from text
function extractAmount(text) {
  // This is a simple regex to find amounts like $10.99 or 10.99
  // You might need to adjust this based on your receipt format
  const amountMatch = text.match(/\$?\d+(?:\.\d{2})?/);
  return amountMatch ? parseFloat(amountMatch[0].replace('$', '')) : null;
}
