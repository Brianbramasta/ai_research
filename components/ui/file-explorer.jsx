"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, File, Code } from "lucide-react";
import { cn } from "../../lib/utils";

const FileTree = ({ files, level = 0 }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const groupByFolder = (files) => {
    const tree = {};
    files.forEach((file) => {
      const parts = file.path.split("/");
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          if (!current.files) current.files = [];
          current.files.push(file);
        } else {
          current.folders = current.folders || {};
          current.folders[part] = current.folders[part] || {};
          current = current.folders[part];
        }
      });
    });
    return tree;
  };

  const renderTree = (tree, path = "", level = 0) => {
    const folders = tree.folders ? Object.entries(tree.folders) : [];
    const files = tree.files || [];

    return (
      <div style={{ paddingLeft: level ? "1.5rem" : "0.5rem" }}>
        {folders.map(([name, content]) => {
          const fullPath = path ? `${path}/${name}` : name;
          const isExpanded = expandedFolders.has(fullPath);

          return (
            <div key={fullPath}>
              <button
                onClick={() => toggleFolder(fullPath)}
                className={cn(
                  "flex items-center gap-1 w-full p-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded",
                  "transition-colors duration-150",
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4 text-blue-500" />
                <span>{name}</span>
              </button>
              {isExpanded && renderTree(content, fullPath, level + 1)}
            </div>
          );
        })}
        {files.map((file) => (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-1 w-full p-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded",
              "cursor-pointer transition-colors duration-150",
            )}
          >
            <span className="w-4" />
            <File className="h-4 w-4 text-gray-500" />
            <span>{file.path.split("/").pop()}</span>
          </div>
        ))}
      </div>
    );
  };

  const tree = groupByFolder(files);
  return renderTree(tree);
};

export function FileExplorer({ files }) {
  return (
    <div className="h-full w-64 border-r bg-white dark:bg-gray-900 dark:border-gray-800">
      <div className="p-3 border-b dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <span className="font-medium">Explorer</span>
        </div>
      </div>
      <div className="overflow-auto h-[calc(100%-3rem)]">
        <FileTree files={files} />
      </div>
    </div>
  );
}
