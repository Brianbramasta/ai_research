import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const historyPath = path.join(process.cwd(), 'data', 'history.json');

export async function GET() {
  try {
    const history = await fs.readFile(historyPath, 'utf8');
    return NextResponse.json(JSON.parse(history));
  } catch (error) {
    console.error('Error reading history:', error);
    // If file doesn't exist, create it with empty history
    if (error.code === 'ENOENT') {
      await fs.writeFile(historyPath, JSON.stringify({ messages: [] }));
      return NextResponse.json({ messages: [] });
    }
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
    
    history.messages.push({
      created_at: new Date().toISOString(),
      mode: data.mode,
      prompt: data.prompt,
      response: data.response,
      files: data.files || [],
      knowledgeFiles: data.knowledgeFiles || [],
      originalFiles: data.originalFiles || []
    });

    // Keep only last 50 messages
    if (history.messages.length > 50) {
      history.messages = history.messages.slice(-50);
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving history:', error);
    return NextResponse.json(
      { error: 'Failed to save history', details: error.message },
      { status: 500 }
    );
  }
}

// Tambahkan method DELETE
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));

    if (id) {
      // Delete specific history item
      const index = history.messages.findIndex(msg => 
        new Date(msg.created_at).getTime() === parseInt(id)
      );
      if (index > -1) {
        history.messages.splice(index, 1);
      }
    } else {
      // Delete all history
      history.messages = [];
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting history:', error);
    return NextResponse.json(
      { error: 'Failed to delete history', details: error.message },
      { status: 500 }
    );
  }
}
