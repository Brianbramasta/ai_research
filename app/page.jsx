"use client";

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react'; // Update import
import { useDropzone } from 'react-dropzone';
// Add Prism.js import
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import * as Diff from 'diff'; // Add this import
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { Loader2, Upload, Wand2, Download, Check, X, Save, Code, Maximize2, Minimize2, FileText, Code as CodeIcon, PlusCircle, Trash2, ChevronRight, Plus, Minus } from "lucide-react"; // Add new icons
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"; // Add this import
import { Label } from "../components/ui/label"; // Add this import

// Dynamically import JSZip to avoid SSR issues
const JSZip = dynamic(() => import('jszip'), { ssr: false });

// Add syntax highlighting helper
const highlightCode = (code, language) => {
  try {
    return Prism.highlight(code, Prism.languages[language] || Prism.languages.javascript, language);
  } catch (e) {
    return code;
  }
};

export default function Home() {
  const [files, setFiles] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [modifiedFiles, setModifiedFiles] = useState(null);
  const [fileChanges, setFileChanges] = useState([]);
  const [originalFiles, setOriginalFiles] = useState(new Map());
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [mode, setMode] = useState('code'); // Add mode state
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [projectStructure, setProjectStructure] = useState(null);
  const [showFullCode, setShowFullCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [diffs, setDiffs] = useState({}); // Add diffs state

  // Add this useEffect for random background
  useEffect(() => {
    const natureImages = [
      'https://images.unsplash.com/photo-1506102383123-c8ef1e872756?q=80&w=1920',
      'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1920',
      'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1920',
      'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?q=80&w=1920',
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=1920'
    ];

    const randomImage = natureImages[Math.floor(Math.random() * natureImages.length)];
    setBackgroundImage(randomImage);
  }, []);

  const requestDirectoryPermission = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setDirectoryHandle(handle);
      return handle;
    } catch (error) {
      console.error('Error requesting directory permission:', error);
      return null;
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    // Request permission first
    const handle = await requestDirectoryPermission();
    if (!handle) {
      alert('Need directory permission to enable file modifications');
      return;
    }

    const fileTree = acceptedFiles.map(file => {
      const fileContent = file;
      // Pastikan menggunakan webkitRelativePath untuk mendapatkan full path
      const filePath = file.webkitRelativePath || file.path || file.name;
      setOriginalFiles(prev => new Map(prev).set(filePath, fileContent));
      
      return {
        path: filePath,
        name: file.name,
        content: file,
        type: file.type,
      };
    });
    
    setFiles(prev => [...prev, ...fileTree]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    directory: true,
    webkitdirectory: "true",
    noClick: false,
    noKeyboard: false
  });

  const handleKnowledgeFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => 
      file.type.match(/(text\/plain|image\/.*|application\/pdf)/)
    );

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only text, images and PDFs are supported.');
    }

    const fileContents = await Promise.all(validFiles.map(async (file) => {
      return { 
        file,
        // Jangan baca content di sini, biarkan handling di API
        content: null,
        type: file.type 
      };
    }));

    setKnowledgeFiles([...knowledgeFiles, ...fileContents]);
  };

  // Modify handleAnalyze to handle both modes
  const handleAnalyze = async () => {
    if (!prompt) {
      alert('Please enter a prompt');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Include files for both code and text modes
      if (mode === 'code' || mode === 'text') {
        files.forEach(file => {
          formData.append('files', file.content, file.path);
        });

        // Perbaikan untuk knowledge files
        knowledgeFiles.forEach(kf => {
          // Pastikan mengirim file asli, bukan object
          formData.append('knowledgeFiles', kf.file);
        });
      }
      
      formData.append('prompt', prompt);
      formData.append('knowledge', knowledge);
      formData.append('mode', mode);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      // Baca response sekali saja dan simpan
      const responseData = await response.json();

      if (mode === 'create') {
        setResult({
          message: responseData.message,
          type: 'create'
        });
        setProjectStructure(responseData.projectStructure);
      } else if (mode === 'code') {
        const zipBlob = new Blob([responseData.zipData], { type: 'application/zip' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        
        // Calculate diffs for modified files
        const newDiffs = {};
        for (const change of responseData.changes) {
          if (change.type === 'modified') {
            const original = originalFiles.get(change.file);
            if (original) {
              const originalContent = await original.text();
              newDiffs[change.file] = Diff.diffLines(originalContent, change.content);
            }
          }
        }
        
        setModifiedFiles(downloadUrl);
        setFileChanges(responseData.changes);
        setDiffs(newDiffs);
        setResult({
          message: "Project successfully modified! Review changes below."
        });
      } else {
        // Handle text mode response
        setResult({
          message: responseData.analysis,
          type: 'text'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while analyzing');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = modifiedFiles;
    link.download = 'modified-project.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmChange = async (change) => {
    try {
      if (!directoryHandle) {
        throw new Error('No directory permission');
      }

      // Navigate to file location and create/update file
      const pathParts = change.file.split('/');
      const fileName = pathParts.pop();
      let currentDir = directoryHandle;

      // Create subdirectories if needed
      for (const part of pathParts) {
        if (part) {
          currentDir = await currentDir.getDirectoryHandle(part, { create: true });
        }
      }

      // Create or update the file (renamed fileHandle to newFileHandle)
      const newFileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(change.content);
      await writable.close();

      // Update UI state
      setFiles(prev => prev.map(f => 
        f.path === change.file 
          ? { ...f, content: new File([change.content], fileName) }
          : f
      ));

      // Remove from changes list
      setFileChanges(prev => prev.filter(c => c.file !== change.file));

      alert(`Successfully updated ${change.file}`);
    } catch (error) {
      console.error('Error applying changes:', error);
      alert(`Failed to apply changes to file: ${error.message}`);
    }
  };

  const handleRejectChange = (change) => {
    setFileChanges(prev => prev.filter(c => c.file !== change.file));
  };

  const handleApplyAll = async () => {
    const modifiedChanges = fileChanges.filter(change => change.type === 'modified');
    
    for (const change of modifiedChanges) {
      try {
        await handleConfirmChange(change);
      } catch (error) {
        console.error(`Failed to apply changes to ${change.file}:`, error);
        // Continue with remaining files even if one fails
      }
    }
    
    // Clear remaining changes after applying all
    setFileChanges([]);
  };

  const handleDeclineAll = () => {
    setFileChanges([]);
  };

  // Add function to fetch history
  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      if (data.messages) {
        setHistory(data.messages);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleDownloadProject = async (files) => {
    const zip = new JSZip();
    
    files.forEach(file => {
      zip.file(file.path, file.content);
    });
    
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToLocation = async (files) => {
    try {
      const handle = await requestDirectoryPermission();
      if (!handle) {
        throw new Error('No directory permission');
      }

      for (const file of files) {
        const pathParts = file.path.split('/');
        const fileName = pathParts.pop();
        let currentDir = handle;

        // Create subdirectories if needed
        for (const part of pathParts) {
          if (part) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: true });
          }
        }

        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.content);
        await writable.close();
      }

      alert('Project saved successfully!');
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Failed to save project: ${error.message}`);
    }
  };

  // Tambahkan fungsi untuk menampilkan kode lengkap
  const handleShowFullCode = () => {
    setShowFullCode(!showFullCode);
  };

  // Add handler untuk click history
  const restoreFilesFromHistory = async (historyFiles) => {
    if (!historyFiles || historyFiles.length === 0) return;
    
    const restoredFiles = historyFiles.map(file => ({
      path: file.name,
      name: file.name,
      content: new File([file.content], file.name),
      type: file.name.endsWith('.jsx') ? 'text/jsx' : 'text/plain'
    }));

    setFiles(restoredFiles);
  };

  const handleHistoryClick = async (item) => {
    setPrompt(item.prompt);
    setMode(item.mode);

    // Restore files and knowledge files if they exist
    if (item.files) {
      await restoreFilesFromHistory(item.files);
    }
    if (item.knowledgeFiles) {
      const restoredKnowledgeFiles = item.knowledgeFiles.map(kf => ({
        file: new File([kf.content || ''], kf.name, { type: kf.type }),
        content: null,
        type: kf.type
      }));
      setKnowledgeFiles(restoredKnowledgeFiles);
    }

    switch (item.mode) {
      case 'create':
        const files = [];
        const fileRegex = /=== START FILE: (.*?) ===([\s\S]*?)=== END FILE ===/g;
        let match;
        
        while ((match = fileRegex.exec(item.response)) !== null) {
          files.push({
            path: match[1],
            content: match[2].trim()
          });
        }

        setResult({
          message: "Project loaded from history",
          type: 'create'
        });
        setProjectStructure({
          tree: generateTreeStructure(files),
          files
        });
        break;

      case 'code':
        const { changes, zipData } = JSON.parse(item.response);
        const zipBlob = new Blob([Buffer.from(zipData, 'base64')], { type: 'application/zip' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        
        setModifiedFiles(downloadUrl);
        setFileChanges(changes);
        setResult({
          message: "Code changes loaded from history",
          type: 'code'
        });

        if (item.originalFiles) {
          await restoreFilesFromHistory(item.originalFiles);
        }
        break;

      case 'text':
        setResult({
          message: item.response,
          type: 'text'
        });
        break;
    }
  };

  // Add loading skeleton component
  const ResultSkeleton = () => (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  );

  // Add function to get mode icon
  const getModeIcon = (mode) => {
    switch (mode) {
      case 'create':
        return <PlusCircle className="h-4 w-4" />;
      case 'code':
        return <CodeIcon className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleDeleteHistory = async (createdAt) => {
    try {
      const response = await fetch(
        `/api/history${createdAt ? `?id=${new Date(createdAt).getTime()}` : ''}`, 
        { method: 'DELETE' }
      );
      
      if (!response.ok) throw new Error('Failed to delete history');
      
      // Refresh history list
      fetchHistory();
    } catch (error) {
      console.error('Error deleting history:', error);
      alert('Failed to delete history');
    }
  };

  const formatPath = (path) => {
    // Convert forward slashes to backslashes and ensure proper Windows-style path
    return path.replace(/\//g, '\\');
  };

  const formatTextResponse = (text) => {
    // Split by common header patterns
    const sections = text.split(/(?=#{1,3} |\*\*[\w\s]+:\*\*|^\d+\.|Analysis:|Summary:|Recommendations:|Details:|Findings:)/gm);
    
    return sections.map((section, index) => {
      // Check if section starts with markdown headers or bold text
      const isHeader = /^#{1,3} /.test(section.trim());
      const isBoldHeader = /^\*\*[\w\s]+:\*\*/.test(section.trim());
      const isNumbered = /^\d+\./.test(section.trim());
      const isNamedSection = /^(Analysis|Summary|Recommendations|Details|Findings):/.test(section.trim());

      if (isHeader) {
        const level = (section.match(/^#+/) || [''])[0].length;
        const text = section.replace(/^#+\s/, '');
        return (
          <div key={index} className={`
            ${level === 1 ? 'text-2xl font-bold text-green-800 mt-6 mb-4' : ''}
            ${level === 2 ? 'text-xl font-semibold text-green-700 mt-5 mb-3' : ''}
            ${level === 3 ? 'text-lg font-medium text-green-600 mt-4 mb-2' : ''}
          `}>
            {text}
          </div>
        );
      } else if (isBoldHeader || isNamedSection) {
        const text = section.replace(/^\*\*|\*\*:/, '').replace(':', '');
        return (
          <div key={index}>
            <h3 className="text-lg font-semibold text-green-700 mt-4 mb-2">{text}</h3>
            <div className="pl-4 text-gray-700">
              {section.split(/(?<=:)(.+)/s)[1]}
            </div>
          </div>
        );
      } else if (isNumbered) {
        const [number, ...content] = section.split(/(?<=\.\s)/);
        return (
          <div key={index} className="flex gap-2 mt-2">
            <span className="font-medium text-green-600">{number}</span>
            <div className="text-gray-700">{content}</div>
          </div>
        );
      } else {
        return (
          <p key={index} className="mt-2 text-gray-700">
            {section}
          </p>
        );
      }
    });
  };

  const HistoryItem = ({ item, onClick, onDelete }) => (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="w-full justify-start text-left"
        onClick={onClick}
      >
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-2 min-w-[180px]">
            {getModeIcon(item.mode)}
            <time className="text-sm text-muted-foreground">
              {new Date(item.created_at).toLocaleString()}
            </time>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <span className="truncate font-medium">{item.prompt}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {item.mode === 'create' 
                  ? 'Project Generation'
                  : item.mode === 'code' 
                  ? `Code Analysis (${item.originalFiles?.length || 0} files)`
                  : `Text Analysis ${item.files?.length ? `(${item.files.length} files)` : ''}`}
              </span>
              {(item.files?.length > 0 || item.originalFiles?.length > 0) && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                  With Files
                </span>
              )}
            </div>
          </div>
        </div>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderDiff = (filePath) => {
    return (
      <div className="diff-container">
        {diffs[filePath].map((part, index) => {
          const color = part.added ? 'bg-green-100' : part.removed ? 'bg-red-100' : 'bg-gray-50';
          const icon = part.added ? <Plus className="h-3 w-3 text-green-600" /> : 
            part.removed ? <Minus className="h-3 w-3 text-red-600" /> : 
            <ChevronRight className="h-3 w-3 text-gray-400" />;
          
          return (
            <div key={index} className={`${color} flex items-start p-1`}>
              <span className="mr-2 mt-1">{icon}</span>
              <code className={color}>
                {part.value.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </code>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Add overlay for better contrast */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      
      {/* Wrap existing content in relative container */}
      <div className="relative container mx-auto p-8">
        {/* Update card backgrounds for better contrast */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-green-900">AI Project Analysis Tool</h1>
          <Button
            variant="outline"
            className="border-green-600 text-green-700 hover:bg-green-50/80 bg-white/80"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchHistory();
            }}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </Button>
        </div>

        {showHistory && (
          <Card className="mb-8 bg-white/90 backdrop-blur border-green-100 shadow-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">History</h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete all history?')) {
                    handleDeleteHistory();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
            <ScrollArea className="h-[300px] w-full rounded-md p-4">
              <div className="space-y-2">
                {history.map((item, index) => (
                  <HistoryItem
                    key={index}
                    item={item}
                    onClick={() => handleHistoryClick(item)}
                    onDelete={() => handleDeleteHistory(item.created_at)}
                  />
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-6 bg-white/90 backdrop-blur shadow-lg border-green-100">
            <h2 className="text-2xl font-semibold mb-4 text-green-800">Project Files</h2>
            {mode !== 'create' && (
              <>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
                    isDragActive ? 'border-green-500 bg-green-50' : 'border-green-200 hover:border-green-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-green-400" />
                  <p className="mt-2 text-green-700">
                    {isDragActive
                      ? "Drop the project here ..."
                      : "Drag & drop project folder here, or click to select"}
                  </p>
                </div>
                
                <ScrollArea className="h-40 mt-4 rounded-md border border-green-100 p-4 bg-white/50">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono text-gray-900">
                          {formatPath(file.path)}
                        </span>
                        <span className="text-xs text-gray-500">{file.type}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2 text-green-800">Prompt</h3>
              <Textarea
                placeholder={mode === 'create' 
                  ? "Describe the project you want to create..." 
                  : "Describe the modifications needed..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] bg-white/70 border-green-200 focus-visible:ring-green-400"
              />
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2 text-green-800">Additional Context</h3>
              <Textarea
                placeholder={mode === 'create'
                  ? "Provide additional requirements or context..."
                  : "Provide additional context..."
                }
                value={knowledge}
                onChange={(e) => setKnowledge(e.target.value)}
                className="min-h-[100px] bg-white/70 border-green-200 focus-visible:ring-green-400"
              />
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2 text-green-800">Project Knowledge Files</h3>
              <div className="space-y-4">
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,image/*"
                  onChange={handleKnowledgeFileChange}
                  className="hidden"
                  id="knowledge-files"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('knowledge-files').click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Knowledge Files
                </Button>
                
                <ScrollArea className="h-40 rounded-md border border-green-100 p-4 bg-white/50">
                  {knowledgeFiles.map((kf, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm font-mono">{kf.file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setKnowledgeFiles(files => files.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>

            <div className="mt-6">
              <Label>Analysis Mode</Label>
              <RadioGroup
                defaultValue="code"
                onValueChange={setMode}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="code" id="code" />
                  <Label htmlFor="code">Code Analysis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="text" />
                  <Label htmlFor="text">Text Analysis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="create" />
                  <Label htmlFor="create">Create Project</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleAnalyze}
              disabled={loading || (mode === 'code' && files.length === 0)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {mode === 'create' ? 'Create Project' : 'Analyze and Modify'}
                </>
              )}
            </Button>
          </Card>

          <Card 
            className={`p-6 bg-white/90 backdrop-blur shadow-lg border-green-100 transition-all duration-300 ${
              isFullscreen 
                ? 'fixed inset-4 z-50 overflow-auto' 
                : 'relative'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-green-800">Results</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            <ScrollArea className="h-[600px] rounded-md border border-green-100 p-4 bg-white/50">
              {loading ? (
                <ResultSkeleton />
              ) : result ? (
                <div className="flex flex-col gap-4">
                  {mode === 'create' && projectStructure ? (
                    <div className="space-y-4">
                      <div className="prose">
                        <p>{result.message}</p>
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={handleShowFullCode}
                        className="w-full"
                      >
                        <Code className="mr-2 h-4 w-4" />
                        {showFullCode ? 'Hide Full Code' : 'See Full Code'}
                      </Button>

                      <ScrollArea className="w-full" orientation="horizontal">
                        <div className="min-w-max">
                          {/* Content inside horizontal scroll */}
                          {showFullCode && (
                            <div className="space-y-4">
                              {projectStructure.files.map((file, index) => (
                                <div key={index} className="border rounded-lg">
                                  <div className="bg-muted p-2 px-4 font-medium border-b">
                                    {file.path}
                                  </div>
                                  <div className="p-4 overflow-x-auto">
                                    <pre className="bg-gray-50 p-4 rounded">
                                      <code 
                                        className={`language-${file.path.split('.').pop()}`}
                                        dangerouslySetInnerHTML={{
                                          __html: highlightCode(
                                            file.content,
                                            file.path.split('.').pop()
                                          )
                                        }}
                                      />
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                      
                      <div className="border rounded p-4">
                        <h3 className="font-medium mb-2">Project Structure:</h3>
                        <pre className="bg-gray-50 p-4 rounded overflow-x-auto">
                          {projectStructure.tree}
                        </pre>
                      </div>

                      <div className="flex gap-4">
                        <Button
                          onClick={() => handleDownloadProject(projectStructure.files)}
                          className="flex-1"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Project
                        </Button>
                        <Button
                          onClick={() => handleSaveToLocation(projectStructure.files)}
                          className="flex-1"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save to Location
                        </Button>
                      </div>

                      <div className="mt-8 space-y-4">
                        <h3 className="text-xl font-semibold">Getting Started</h3>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Follow these steps to initialize and run your project:
                          </p>
                          <div className="bg-muted p-4 rounded-lg space-y-4">
                            <div>
                              <h4 className="font-medium">1. Navigate to project directory:</h4>
                              <pre className="bg-gray-50 p-2 rounded mt-1">
                                cd your-project-name
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-medium">2. Install dependencies:</h4>
                              <pre className="bg-gray-50 p-2 rounded mt-1">
                                npm install
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-medium">3. Run the development server:</h4>
                              <pre className="bg-gray-50 p-2 rounded mt-1">
                                npm run dev
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-medium">4. Open in browser:</h4>
                              <p className="text-sm mt-1">
                                Visit <code className="bg-gray-50 px-1">http://localhost:3000</code> in your browser to see the result.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : mode === 'text' ? (
                    <div className="prose prose-green max-w-none">
                      <div className="bg-white/80 rounded-lg p-6 shadow-sm">
                        {formatTextResponse(result.message)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="prose">
                        <p>{result.message}</p>
                      </div>
                      <ScrollArea className="w-full" orientation="horizontal">
                        <div className="min-w-max">
                          {/* Content inside horizontal scroll */}
                          <div className="space-y-4 w-full">
                            {fileChanges.map((change, index) => (
                              <div key={index} className="border rounded p-4 w-full">
                                <div className="flex justify-start items-center">
                                  <h3 className="font-medium flex items-center gap-2 min-w-0">
                                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                      change.type === 'modified' ? 'bg-yellow-400' : 'bg-gray-400'
                                    }`} />
                                    <span className="truncate">{change.file}</span>
                                  </h3>
                                  {change.type === 'modified' && (
                                    <div className="flex gap-2 flex-shrink-0 ml-4">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-green-600 hover:text-green-700"
                                        onClick={() => handleConfirmChange(change)}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Apply
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleRejectChange(change)}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {change.type === 'modified' && (
                                  <div className="relative w-full mt-2 overflow-x-auto">
                                    <div className="border rounded">
                                      <div className="bg-gray-50 p-2 text-sm font-medium border-b">
                                        Diff Preview
                                      </div>
                                      <pre className="p-2 text-sm">
                                        {diffs[change.file] ? renderDiff(change.file) : (
                                          <code
                                            className={`language-${change.file.split('.').pop()}`}
                                            dangerouslySetInnerHTML={{
                                              __html: highlightCode(
                                                change.content,
                                                change.file.split('.').pop()
                                              )
                                            }}
                                          />
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  {result?.error || 'Results will appear here'}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Add helper function for tree structure
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