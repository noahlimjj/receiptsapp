// Load environment variables from .env file
require('dotenv').config();
const { Client } = require('@notionhq/client');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Jimp = require('jimp');

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Handle incoming webhook from Telegram
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const update = JSON.parse(event.body);
    await handleUpdate(update);
    
    return {
      statusCode: 200,
      body: 'OK',
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
};

// Process Telegram update
async function handleUpdate(update) {
  // Check if the update contains a message
  if (!update.message) return;

  const chatId = update.message.chat.id;
  const message = update.message;

  try {
    // Handle photo messages
    if (message.photo) {
      await handlePhoto(chatId, message);
    }
    // Handle document messages (PDFs)
    else if (message.document) {
      await handleDocument(chatId, message);
    }
    // Handle text messages
    else if (message.text) {
      await handleText(chatId, message.text);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await bot.sendMessage(chatId, 'Sorry, there was an error processing your receipt. Please try again.');
  }
}

// Handle photo messages
async function handlePhoto(chatId, message) {
  // Get the highest resolution photo
  const photo = message.photo[message.photo.length - 1];
  const file = await bot.getFile(photo.file_id);
  const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  
  // Process the image and extract text
  const extractedText = await processImage(imageUrl);
  
  // Create Notion page with the extracted data
  await createNotionPage({
    text: extractedText,
    date: new Date(message.date * 1000).toISOString(),
    amount: extractAmount(extractedText),
    imageUrl: imageUrl,
    chatId: chatId
  });
  
  await bot.sendMessage(chatId, '✅ Receipt processed and saved to Notion!');
}

// Handle document messages (PDFs)
async function handleDocument(chatId, message) {
  const document = message.document;
  
  // Check if it's a PDF
  if (!document.mime_type.includes('pdf')) {
    await bot.sendMessage(chatId, 'Please send a PDF or photo of your receipt.');
    return;
  }
  
  const file = await bot.getFile(document.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  
  // Download and process the PDF
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const data = await pdfParse(response.data);
  
  // Create Notion page with the extracted data
  await createNotionPage({
    text: data.text,
    date: new Date(message.date * 1000).toISOString(),
    amount: extractAmount(data.text),
    fileUrl: fileUrl,
    chatId: chatId
  });
  
  await bot.sendMessage(chatId, '✅ PDF receipt processed and saved to Notion!');
}

// Handle text messages
async function handleText(chatId, text) {
  if (text === '/start' || text === '/help') {
    await bot.sendMessage(chatId, 
      '📝 Receipt Bot Help\n\n' +
      'To save a receipt, simply send a photo or PDF of your receipt.\n' +
      'The bot will extract the text and amount, and save it to Notion.\n\n' +
      'Commands:\n' +
      '/start - Show this help message\n' +
      '/help - Show this help message'
    );
  }
}

// Process image and extract text using OCR
async function processImage(imageUrl) {
  // In a real implementation, you would use an OCR service like Tesseract.js or Google Cloud Vision
  // For now, we'll just return a placeholder
  console.log('Processing image:', imageUrl);
  return 'Sample extracted text from receipt. Total: $12.34';
}

// Extract amount from text using regex
function extractAmount(text) {
  // This is a simple regex to find amounts like $12.34 or 12.34
  const amountMatch = text.match(/\$?\d+(?:\.\d{2})?/g);
  return amountMatch ? amountMatch[0].replace('$', '') : '0.00';
}

// Create a new Notion page with the receipt data
async function createNotionPage({ text, date, amount, imageUrl, fileUrl, chatId }) {
  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: `Receipt - ${new Date(date).toLocaleDateString()}`,
              },
            },
          ],
        },
        'Amount': {
          number: parseFloat(amount) || 0,
        },
        'Date': {
          date: {
            start: date,
          },
        },
        'Source': {
          select: {
            name: 'Telegram',
          },
        },
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
                  content: text,
                },
              },
            ],
          },
        },
        ...(imageUrl ? [{
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: {
              url: imageUrl,
            },
          },
        }] : []),
        ...(fileUrl ? [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Download PDF: ',
                },
              },
              {
                type: 'text',
                text: {
                  content: 'PDF Receipt',
                  link: {
                    url: fileUrl,
                  },
                },
              },
            ],
          },
        }] : []),
      ],
    });
    
    console.log('Successfully created Notion page');
  } catch (error) {
    console.error('Error creating Notion page:', error);
    throw error;
  }
}
