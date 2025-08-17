require('dotenv').config();
const { Client } = require('@notionhq/client');

// Initialize the Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function testNotionIntegration() {
  try {
    console.log('Testing Notion integration with updated schema...');
    
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      throw new Error('NOTION_DATABASE_ID is not set in .env file');
    }
    
    if (!process.env.NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not set in .env file');
    }
    
    console.log('✅ Environment variables are set');
    
    // Create a test page with the correct schema
    console.log('\nCreating a test page...');
    const testPage = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: 'Test Receipt - $9.99'
              }
            }
          ]
        },
        'amount': {
          number: 9.99
        },
        'Date': {
          date: { start: new Date().toISOString().split('T')[0] }
        },
        'type': {
          rich_text: [
            {
              text: {
                content: 'Test'
              }
            }
          ]
        },
        'receipt url': {
          rich_text: [
            {
              text: {
                content: 'https://example.com/receipt.jpg'
              }
            }
          ]
        }
      }
    });
    
    console.log('✅ Successfully created test page!');
    console.log('Page URL:', testPage.url);
    console.log('\n🎉 Notion integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Notion integration:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nError details:', {
        status: error.status,
        code: error.code,
        headers: error.headers,
        body: error.body
      });
    }
    
    process.exit(1);
  }
}

// Run the test
testNotionIntegration();
