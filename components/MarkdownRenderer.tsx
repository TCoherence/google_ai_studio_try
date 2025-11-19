import React from 'react';

interface Props {
  content: string;
  isStreaming?: boolean;
}

// A very simple parser to avoid heavy dependencies in this specific setup
// It handles Headers, Bold, Lists, and Paragraphs to a reasonable degree for a demo.
const SimpleMarkdown: React.FC<Props> = ({ content, isStreaming }) => {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-4 font-light leading-relaxed text-gray-300">
      {lines.map((line, index) => {
        // Header 1
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-3xl font-semibold text-white mt-8 mb-4 tracking-tight border-b border-zinc-800 pb-2">{line.replace('# ', '')}</h1>;
        }
        // Header 2
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-medium text-white mt-6 mb-3 tracking-tight">{line.replace('## ', '')}</h2>;
        }
        // Header 3
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium text-zinc-200 mt-4 mb-2">{line.replace('### ', '')}</h3>;
        }
        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const cleanLine = line.replace(/^(\s*)([-*])\s+/, '');
          // Simple bold parser within list
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          return (
            <li key={index} className="ml-4 list-disc marker:text-zinc-600 pl-1 my-1">
              {parts.map((part, i) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={i} className="font-semibold text-zinc-200">{part.slice(2, -2)}</strong> 
                  : part
              )}
            </li>
          );
        }
        
        // Empty lines
        if (line.trim() === '') return <div key={index} className="h-2"></div>;

        // Paragraphs with Bold support
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={index} className="min-h-[1.5em]">
              {parts.map((part, i) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={i} className="font-semibold text-zinc-200">{part.slice(2, -2)}</strong> 
                  : part
              )}
            </p>
        );
      })}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse align-middle"></span>
      )}
    </div>
  );
};

export default SimpleMarkdown;
