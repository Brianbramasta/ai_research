
"use client";

import { useState } from 'react';
import { Loader2, Send, Code, FolderTree, Settings, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import dynamic from 'next/dynamic';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
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
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('javascript');

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/editor', {
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
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const highlightCode = (code) => {
    try {
      return Prism.highlight(code, Prism.languages[language], language);
    } catch (e) {
      return code;
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">AI Code Editor</h1>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost">
              <FolderTree className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Code</label>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`text-sm ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="typescript">TypeScript</option>
                  <option value="css">CSS</option>
                </select>
              </div>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`font-mono h-[400px] ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
                placeholder="Enter your code here..."
              />
            </div>
            
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">AI Prompt</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What would you like to do with the code?"
                  className={`resize-none ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
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

          <Card className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <label className="block text-sm font-medium mb-2">AI Response</label>
            <div className={`${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} rounded-md p-4 h-[400px] overflow-auto`}>
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
    </div>
  );
}
