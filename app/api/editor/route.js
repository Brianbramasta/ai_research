
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req) {
  try {
    const { code, prompt } = await req.json();
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `As a code assistant, analyze and improve this code based on the following request: "${prompt}"\n\nCode:\n${code}`
      }]
    });

    return NextResponse.json({
      result: response.content[0].text,
      success: true
    });
    
  } catch (error) {
    console.error('Error in editor API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
