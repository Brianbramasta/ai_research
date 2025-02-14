if (typeof self === "undefined") {
  global.self = global;
}

import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';

// Update configuration
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  try {
    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'Failed to parse form data' },
        { status: 400 }
      );
    }

    const apiKey = formData.get('apiKey');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Initialize Anthropic with the provided API key
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const mode = formData.get('mode');
    const prompt = formData.get('prompt');
    const knowledge = formData.get('knowledge') || '';
    const files = formData.getAll('files');
    const knowledgeFiles = formData.getAll('knowledgeFiles');
    
    // Validate inputs
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (mode === 'text') {
      // Process files if they exist
      let fileContent = '';
      let projectKnowledge = '';

      // Process main files
      if (files && files.length > 0) {
        fileContent = await Promise.all(files.map(async (file) => {
          const content = await file.text();
          return `File: ${file.name}\n${content}\n---\n`;
        }));
        fileContent = fileContent.join('\n');
      }

      // Process knowledge files
      if (knowledgeFiles && knowledgeFiles.length > 0) {
        projectKnowledge = await Promise.all(knowledgeFiles.map(async (file) => {
          if (file.type.startsWith('text/')) {
            const content = await file.text();
            return `Knowledge File: ${file.name}\n${content}\n---\n`;
          }
          return `Knowledge File: ${file.name} (Binary file)\n---\n`;
        }));
        projectKnowledge = projectKnowledge.join('\n');
      }

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Analyze the following project and provide feedback based on this prompt:
            ${prompt}

            Additional Context: ${knowledge}

            Project Files:
            ${fileContent}

            Project Knowledge Files:
            ${projectKnowledge}

            Please provide a detailed analysis using the following structure:
            ## Summary
            Provide a brief overview of the analysis

            ## Key Findings
            List the main points discovered

            ## Detailed Analysis
            Break down the analysis into clear sections

            ## Recommendations
            Provide actionable suggestions

            Use markdown formatting:
            - Use headers for each sections
            - Use bold (**text**) for important points
            - Use numbered lists for sequential items
            - Use bullet points for unordered lists
            
            Make the response clear, well-structured, and easy to read.`
          }
        ]
      });

      // Instead of fetch, use direct file system or database call
      // We'll create a separate function to handle history
      try {
        await saveToHistory({
          prompt,
          response: response.content[0].text,
          mode: 'text',
          files: files.length > 0 ? await Promise.all(files.map(async file => ({
            name: file.name,
            content: await file.text()
          }))) : [],
          knowledgeFiles: knowledgeFiles.length > 0 ? await Promise.all(knowledgeFiles.map(async file => ({
            name: file.name,
            content: file.type.startsWith('text/') ? await file.text() : null,
            type: file.type
          }))) : []
        });
      } catch (historyError) {
        console.error('Failed to save to history:', historyError);
        // Continue execution even if history save fails
      }

      return NextResponse.json({ 
        analysis: response.content[0].text 
      });
    }

    if (mode === 'create') {
      // Process knowledge files first
      let projectKnowledge = '';
      if (knowledgeFiles && knowledgeFiles.length > 0) {
        projectKnowledge = await Promise.all(knowledgeFiles.map(async (file) => {
          if (file.type.startsWith('text/')) {
            const content = await file.text();
            return `Knowledge File: ${file.name}\n${content}\n---\n`;
          }
          return `Knowledge File: ${file.name} (Binary file)\n---\n`;
        }));
        projectKnowledge = projectKnowledge.join('\n');
      }

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Create a complete project based on the following requirements:
            
            Project Description: ${prompt}
            Additional Context: ${knowledge}

            Project Knowledge Files:
            ${projectKnowledge}
            
            Please provide a complete project structure with all necessary files and their contents.
            Use this format for each file:
            === START FILE: path/to/file ===
            file content here
            === END FILE ===
            
            Include all necessary configuration files, README.md, and proper folder structure.
            Make sure the project is fully functional and follows best practices.`
          }
        ]
      });

      // Process AI response to extract files
      const output = response.content[0].text;
      const files = [];
      const fileRegex = /=== START FILE: (.*?) ===([\s\S]*?)=== END FILE ===/g;
      let match;
      
      while ((match = fileRegex.exec(output)) !== null) {
        const filePath = match[1];
        const content = match[2].trim();
        files.push({ path: filePath, content });
      }

      // Generate tree structure
      const tree = generateTreeStructure(files);

      // Replace fetch with direct history save
      try {
        await saveToHistory({
          prompt,
          response: output,
          mode: 'create',
          knowledgeFiles: knowledgeFiles.length > 0 ? await Promise.all(knowledgeFiles.map(async file => ({
            name: file.name,
            content: file.type.startsWith('text/') ? await file.text() : null,
            type: file.type
          }))) : []
        });
      } catch (historyError) {
        console.error('Failed to save to history:', historyError);
      }

      return NextResponse.json({
        message: "Project created successfully!",
        projectStructure: {
          tree,
          files
        }
      });
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Process files with validation and store result in fileTree variable
    let fileTree;
    let combinedFileContent = '';
    try {
      // Tambahkan logging untuk debug
      console.log('Files received:', files);
      console.log('File content:', combinedFileContent);

      // Dalam fungsi POST, setelah menerima files
      console.log('Initial files:', files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      })));

      // Perbaiki proses pembacaan file
      fileTree = await Promise.all(files.map(async (file) => {
        if (!file || !file.name) {
          throw new Error('Invalid file object');
        }
        let content;
        try {
          content = await file.text();
          console.log(`File ${file.name} content:`, content.substring(0, 100));
          
          // Normalize path
          const normalizedPath = file.name.replace(/\\/g, '/');
          
          // Add to combined content immediately
          combinedFileContent += `File: ${normalizedPath}\n${content}\n---\n`;
          
          return {
            path: normalizedPath,
            content,
            originalContent: content
          };
        } catch (error) {
          console.error(`Error reading file ${file.name}:`, error);
          throw error;
        }
      }));
    } catch (error) {
      return NextResponse.json(
        { error: 'File processing failed', details: error.message },
        { status: 400 }
      );
    }

    // Process knowledge files
    const knowledgeContent = await Promise.all(knowledgeFiles.map(async (file) => {
      if (file.type.startsWith('text/')) {
        const content = await file.text();
        return `File ${file.name}: ${content}`;
      }
      return `Binary file ${file.name} (type: ${file.type}) included in project knowledge`;
    }));

    // Generate system prompt
    const systemPrompt = `You are an AI code assistant. Analyze and modify the following project files. Your response should:
1. Identify appropriate locations for code changes
2. Provide modified code with clear indicators of where changes should be made
3. Use the following format for each change:
=== START LOCATION ===
{describe where the change should be made, e.g., "after the imports", "inside the handleSubmit function"}
=== END LOCATION ===
=== START CODE ===
{your code changes}
=== END CODE ===

Project Requirements:
${prompt}

Additional Context:
${knowledge}`;

    // Enhanced AI error handling - Simpan response dalam variabel
    let response;
    try {
      // Perbaiki format prompt untuk AI
      const aiPrompt = `Modify the following files according to the requirements.
Requirements: ${prompt}

Files to modify:
${combinedFileContent}

Please provide changes in this format:
=== START FILE: filename.ext ===
entire file content with changes
=== END FILE ===

For each file you modify, include the complete file content with your changes.`;

      // Update AI call
      response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: aiPrompt
          }
        ]
      });
    } catch (error) {
      console.error('AI API Error:', error);
      return NextResponse.json(
        { 
          error: 'AI processing failed', 
          details: error.message,
          cause: error.cause
        },
        { status: 502 }
      );
    }

    // Save to history
    try {
      await saveToHistory({
        prompt: prompt,
        response: response.content[0].text
      });
    } catch (historyError) {
      console.error('Failed to save to history:', historyError);
    }

    // Validate AI response
    if (!response?.content?.[0]?.text) {
      throw new Error('Invalid response from AI service');
    }

    // Process AI response
    const output = response.content[0].text;
    // Pass combinedFileContent instead of undefined fileContent
    const changes = processAIResponse(output, combinedFileContent);

    // Parse modified files
    const fileRegex = /=== START FILE: (.*?) ===([\s\S]*?)=== END FILE ===/g;
    let match;
    while ((match = fileRegex.exec(output)) !== null) {
      const filePath = match[1];
      const fileContent = match[2].trim();
      
      // Find the original file content from fileTree
      const originalFile = fileTree.find(f => f.path === filePath);
      
      changes.push({
        file: filePath,
        content: fileContent,
        originalContent: originalFile ? originalFile.originalContent : '',
        type: 'modified'
      });
    }

    // Add unmodified files reference
    fileTree.forEach(file => {
      if (!changes.find(c => c.file === file.path)) {
        changes.push({
          file: file.path,
          type: 'unchanged'
        });
      }
    });

    if (mode === 'code') {
      // Create new zip instance
      const zip = new JSZip();

      // Add modified files to zip
      changes.forEach(change => {
        if (change.type === 'modified') {
          zip.file(change.file, change.content);
        }
      });

      // Replace fetch with direct history save
      try {
        await saveToHistory({
          prompt,
          response: JSON.stringify({
            changes,
            zipData: await zip.generateAsync({ type: "base64" })
          }),
          mode: 'code',
          originalFiles: await Promise.all(files.map(async file => ({
            name: file.name,
            content: await file.text()
          })))
        });
      } catch (historyError) {
        console.error('Failed to save to history:', historyError);
      }

      // Return both changes and zipData in one JSON response
      return NextResponse.json({ 
        changes,
        zipData: await zip.generateAsync({ type: "blob" })
      });
    }

    return NextResponse.json({ changes });
  } catch (error) {
    console.error('Detailed Error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return NextResponse.json(
      { 
        error: 'Server error',
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    );
  }
}

// Add this helper function in the same file
async function saveToHistory(data) {
  try {
    const response = await fetch('http://localhost:3001/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`History API returned ${response.status}`);
    }
  } catch (error) {
    console.error('History save error:', error);
    throw error;
  }
}

function generateTreeStructure(files) {
  const tree = [];
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = tree;
    
    parts.forEach((part, index) => {
      const existing = currentLevel.find(item => item.name === part);
      if (!existing) {
        if (index === parts.length - 1) {
          currentLevel.push({ name: part, type: 'file' });
        } else {
          const newFolder = { name: part, type: 'folder', children: [] };
          currentLevel.push(newFolder);
          currentLevel = newFolder.children;
        }
      } else if (existing.type === 'folder') {
        currentLevel = existing.children;
      }
    });
  });

  return formatTree(tree);
}

function formatTree(tree, level = 0) {
  return tree.map(item => {
    const indent = '  '.repeat(level);
    if (item.type === 'folder') {
      return `${indent}${item.name}/\n${formatTree(item.children, level + 1)}`;
    }
    return `${indent}${item.name}`;
  }).join('\n');
}

// Modifikasi processAIResponse untuk mengembalikan format yang konsisten
const processAIResponse = (output, fileContent) => {
  console.log('Processing AI output:', output);
  const changes = [];
  
  // Extract file modifications
  const fileRegex = /=== START FILE: (.*?) ===([\s\S]*?)=== END FILE ===/g;
  let match;
  
  while ((match = fileRegex.exec(output)) !== null) {
    const filePath = match[1].trim();
    const newContent = match[2].trim();
    
    console.log(`Found modification for file: ${filePath}`);
    
    changes.push({
      file: filePath,
      content: newContent,
      type: 'modified'
    });
  }

  // Add unchanged files
  const files = fileContent.split('---\n').filter(Boolean);
  files.forEach(file => {
    const [header] = file.split('\n');
    const fileName = header.replace('File: ', '').trim();
    
    if (!changes.find(c => c.file === fileName)) {
      changes.push({
        file: fileName,
        type: 'unchanged'
      });
    }
  });

  console.log('Final changes:', changes);
  return changes;
};

const findInsertionPoint = (content, description) => {
  const lines = content.split('\n');
  
  // Common patterns for location finding
  if (description.includes('after imports')) {
    return lines.findIndex(line => !line.trim().startsWith('import')) + 1;
  }
  
  if (description.includes('inside function')) {
    const funcName = description.match(/inside (\w+) function/)?.[1];
    if (funcName) {
      const funcIndex = lines.findIndex(line => line.includes(`function ${funcName}`));
      return funcIndex + 1;
    }
  }
  
  // Default to end of file if no specific location found
  return lines.length;
};