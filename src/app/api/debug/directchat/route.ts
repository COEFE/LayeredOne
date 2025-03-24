import { NextRequest, NextResponse } from 'next/server';
import { AnthropicMessage } from '@anthropic-ai/sdk';

// Import environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

// Debug flag to log detailed information
const DEBUG = process.env.NODE_ENV === 'development' || true; // Force debug for now

export async function POST(request: NextRequest) {
  try {
    console.log("DirectChat API route called");

    // Parse request body
    const body = await request.json();
    const { messages, model } = body;

    console.log(`Using model: ${model || 'claude-3-7-sonnet-20250219'} (fallback if not specified)`);
    console.log(`Messages count: ${messages?.length || 0}`);
    
    if (DEBUG) {
      console.log('Environment:', process.env.NODE_ENV);
      console.log('API Key present:', !!ANTHROPIC_API_KEY);
      if (ANTHROPIC_API_KEY) {
        console.log('API Key length:', ANTHROPIC_API_KEY.length);
        console.log('API Key starts with:', ANTHROPIC_API_KEY.substring(0, 4) + '...');
      }
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array is required" },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      console.error("Anthropic API key not found");
      return NextResponse.json(
        { error: "Claude API key not configured. Please add ANTHROPIC_API_KEY to your environment variables." },
        { status: 500 }
      );
    }

    // Choose API based on model
    let apiResponse;
    // Default to Anthropic/Claude API
    try {
      apiResponse = await callClaudeApi(messages, model || 'claude-3-7-sonnet-20250219');
    } catch (err: any) {
      console.error("Error calling Claude API:", err);
      return NextResponse.json(
        { 
          error: `Error calling Claude API: ${err.message}`,
          errorDetail: err.toString() 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ response: apiResponse });
  } catch (error: any) {
    console.error("Unhandled error in direct chat API:", error);
    return NextResponse.json(
      { error: `Error processing request: ${error.message}` },
      { status: 500 }
    );
  }
}

// Claude API call function
async function callClaudeApi(messages: any[], modelName: string) {
  const systemMessage = "You are a helpful AI assistant that specializes in financial and accounting analysis.";
  
  console.log(`Calling Claude API with model: ${modelName}`);
  console.log(`Using API key: ${ANTHROPIC_API_KEY ? "Present (length: " + ANTHROPIC_API_KEY.length + ")" : "Missing!"}`);
  
  // Convert messages to Anthropic format
  const formattedMessages: AnthropicMessage[] = messages.map((msg: any) => ({
    role: msg.role,
    content: msg.content
  }));

  // Claude API call
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01' // Standard version compatible with Claude 3.7
    },
    body: JSON.stringify({
      model: modelName,
      messages: formattedMessages,
      system: systemMessage,
      max_tokens: 1000
    })
  });
  
  console.log(`API request sent with model: ${modelName}`);
  console.log(`API request headers:`, {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY ? 'Present (masked)' : 'Missing!',
    'anthropic-version': '2023-06-01'
  });

  if (!response.ok) {
    let errorInfo = '';
    try {
      const errorData = await response.json();
      errorInfo = JSON.stringify(errorData);
      console.error("Claude API error (JSON):", errorData);
    } catch (e) {
      const errorText = await response.text();
      errorInfo = errorText;
      console.error("Claude API error (text):", errorText);
    }
    throw new Error(`Claude API error: ${response.status} - ${errorInfo}`);
  }

  const result = await response.json();
  
  if (DEBUG) {
    // Log a sanitized version of the response (without full content for brevity)
    const sanitizedResult = { ...result };
    if (sanitizedResult.content && typeof sanitizedResult.content === 'string' && sanitizedResult.content.length > 100) {
      sanitizedResult.content = sanitizedResult.content.substring(0, 100) + '... [truncated]';
    }
    console.log("Claude API response success:", JSON.stringify(sanitizedResult, null, 2));
  } else {
    console.log("Claude API response success");
  }
  
  return result;
}