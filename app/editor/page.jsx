
"use client";

import { useState } from 'react';
import { Loader2, Send, Code } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import dynamic from 'next/dynamic';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';

export default function Editor() {
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          prompt,
        }),
      });
      
      const data = await response.json();
      setResult(data.result);
      if (data.updatedCode) {
        setCode(data.updatedCode);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const highlightCode = (code) => {
    try {
      return Prism.highlight(code, Prism.languages.javascript, 'javascript');
    } catch (e) {
      return code;
    }
  };

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">AI Code Editor</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Code</label>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono h-[400px]"
              placeholder="Enter your code here..."
            />
          </div>
          
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like to do with the code?"
                className="resize-none"
                rows={2}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="mb-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium mb-2">Result</label>
          <div className="bg-slate-50 rounded-md p-4 h-[400px] overflow-auto">
            <pre>
              <code
                dangerouslySetInnerHTML={{
                  __html: result ? highlightCode(result) : 'AI response will appear here...'
                }}
              />
            </pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
