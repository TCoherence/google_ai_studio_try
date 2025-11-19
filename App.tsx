
import React, { useState, useRef, useEffect } from 'react';
import { Message, ArtifactState, ResearchPlan, ResearchStep } from './types';
import { SendIcon, SparklesIcon, FileTextIcon, GlobeIcon, CheckIcon, ClockIcon } from './components/Icons';
import SimpleMarkdown from './components/MarkdownRenderer';
import PlanReview from './components/PlanReview';
import { createResearchPlan, executeResearchStep, generateFinalReportStream } from './services/gemini';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: "Welcome to DeepDive. I am your AI Research Agent. I will coordinate a Planner, Researcher, and Reporter to investigate any topic for you.",
      timestamp: Date.now()
    }
  ]);
  
  const [artifact, setArtifact] = useState<ArtifactState>({
    title: 'Research Hub',
    content: '',
    phase: 'idle',
    sources: []
  });

  // Coordinator State
  const [currentPlan, setCurrentPlan] = useState<ResearchPlan | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Only scroll if we aren't reviewing a plan (so it doesn't jump away)
    if (artifact.phase !== 'reviewing') {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, artifact.phase]);

  // --- PHASE 1: PLAN ---
  const handleInitialRequest = async () => {
    if (!input.trim()) return;
    const topic = input;
    setInput('');

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: topic,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);

    // 2. Set Phase to Planning
    setArtifact({
        title: topic,
        content: '',
        phase: 'planning',
        sources: []
    });

    const thinkingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'model',
      content: `Coordinator: Activating Planner agent for "${topic}"...`,
      timestamp: Date.now(),
      isThinking: true
    }]);

    try {
       const plan = await createResearchPlan(topic);
       setCurrentPlan(plan);
       
       // Update Message to show Plan Review UI
       setMessages(prev => prev.map(m => 
         m.id === thinkingId 
           ? { 
               ...m, 
               isThinking: false, 
               content: `Planner: I've outlined a strategy. Please review it below.`, 
               plan: plan // Triggers PlanReview component in render
             }
           : m
       ));
       setArtifact(prev => ({ ...prev, phase: 'reviewing' }));

    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            content: "Planner failed to generate a plan. Please try again.",
            timestamp: Date.now()
        }]);
        setArtifact(prev => ({ ...prev, phase: 'idle' }));
    }
  };

  // --- PHASE 2: EXECUTE RESEARCH (Loop) ---
  const handlePlanApproval = async (approvedPlan: ResearchPlan) => {
      setCurrentPlan(approvedPlan);
      
      // Notify user
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: "Plan approved. Deploying Researcher agent now. Check the sidebar for live progress.",
          timestamp: Date.now()
      }]);

      setArtifact(prev => ({ ...prev, phase: 'researching' }));

      // Execute Steps Sequentially
      const completedSteps: ResearchStep[] = [];
      
      for (const step of approvedPlan.steps) {
          // Highlight current step in Artifact UI
          setArtifact(prev => ({ ...prev, currentStepId: step.id }));

          // Call Researcher Agent
          const result = await executeResearchStep(step);
          
          // Update step with result
          const completedStep = { ...step, status: 'completed' as const, ...result };
          completedSteps.push(completedStep);

          // Update Artifact State (Accumulate Sources)
          setArtifact(prev => {
             const existingUrls = new Set(prev.sources.map(s => s.uri));
             const uniqueNew = (result.sources || []).filter(s => !existingUrls.has(s.uri));
             return {
                 ...prev,
                 sources: [...prev.sources, ...uniqueNew]
             };
          });

          // Small delay for UX pace
          await new Promise(r => setTimeout(r, 500));
      }

      // --- PHASE 3: REPORT ---
      setArtifact(prev => ({ ...prev, phase: 'reporting', currentStepId: undefined }));
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "Research complete. Reporter agent is compiling the final artifact...",
        timestamp: Date.now()
    }]);

      await generateFinalReportStream(
          approvedPlan.topic,
          completedSteps,
          (chunk) => {
              setArtifact(prev => ({
                  ...prev,
                  content: prev.content + chunk
              }));
          }
      );

      setArtifact(prev => ({ ...prev, phase: 'completed' }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (artifact.phase === 'idle' || artifact.phase === 'completed') {
          handleInitialRequest();
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      
      {/* Left Panel: Chat Interface */}
      <motion.div 
        initial={{ width: '100%' }}
        animate={{ width: artifact.phase !== 'idle' ? '40%' : '100%' }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className={`flex flex-col h-full border-r border-border relative z-10 ${artifact.phase !== 'idle' ? 'hidden md:flex' : 'w-full'}`}
      >
        <header className="h-14 flex items-center px-6 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
           <SparklesIcon className="w-5 h-5 text-indigo-500 mr-2" />
           <h1 className="font-semibold text-sm tracking-wide">DEEP DIVE AGENT</h1>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id}>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[90%] ${msg.role === 'user' ? 'ml-12' : 'mr-4 w-full'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-zinc-800 text-white px-4 py-2 rounded-2xl rounded-tr-sm text-sm inline-block float-right">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 mb-1">
                             <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                {msg.content.startsWith('Coordinator') ? 'Coordinator' : 
                                 msg.content.startsWith('Planner') ? 'Planner' : 'Agent'}
                             </span>
                        </div>
                        {msg.isThinking && (
                          <div className="flex items-center space-x-2 text-xs text-indigo-400 animate-pulse">
                             <ClockIcon className="w-3 h-3" />
                             <span>Processing...</span>
                          </div>
                        )}
                        <div className="text-zinc-300 text-sm leading-relaxed">
                          {msg.content.replace(/^(Coordinator|Planner): /, '')}
                        </div>
                        
                        {/* PLAN REVIEW UI */}
                        {msg.plan && (
                            <PlanReview plan={msg.plan} onApprove={handlePlanApproval} />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border">
          <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition duration-300 blur"></div>
             <div className="relative flex items-center bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={artifact.phase === 'idle' || artifact.phase === 'completed' ? "Enter a research topic..." : "Research in progress..."}
                disabled={artifact.phase !== 'idle' && artifact.phase !== 'completed'}
                className="flex-1 bg-transparent border-none px-4 py-3.5 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-600 disabled:opacity-50"
              />
              <button 
                onClick={handleInitialRequest}
                disabled={!input.trim() || (artifact.phase !== 'idle' && artifact.phase !== 'completed')}
                className="p-2 mr-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right Panel: Artifact / Research Progress */}
      <AnimatePresence>
        {artifact.phase !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 bg-[#0c0c0e] flex flex-col h-full overflow-hidden border-l border-zinc-800 shadow-2xl"
          >
            {/* Header */}
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur sticky top-0 z-20">
              <div className="flex items-center space-x-2 overflow-hidden">
                 <div className={`p-1.5 rounded bg-zinc-900 border border-zinc-800 ${['researching', 'reporting'].includes(artifact.phase) ? 'animate-pulse' : ''}`}>
                    <FileTextIcon className="w-4 h-4 text-zinc-400" />
                 </div>
                 <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">{artifact.title}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                  <span className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider border ${
                      artifact.phase === 'completed' 
                        ? 'border-green-900 bg-green-900/20 text-green-400' 
                        : 'border-indigo-900 bg-indigo-900/20 text-indigo-400'
                  }`}>
                      {artifact.phase}
                  </span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 md:px-12 lg:px-16 custom-scrollbar">
               <div className="max-w-3xl mx-auto">
                   
                   {/* VIEW 1: RESEARCH LOG (Visible during researching) */}
                   {(artifact.phase === 'researching' || artifact.phase === 'reviewing') && currentPlan && (
                       <div className="space-y-6 animate-in fade-in duration-500">
                           <h2 className="text-xl font-semibold text-zinc-200 mb-6">Research Protocol</h2>
                           <div className="space-y-4">
                               {currentPlan.steps.map((step, idx) => {
                                   const isCurrent = step.id === artifact.currentStepId;
                                   const isDone = step.status === 'completed'; // In real app, we need to update status in plan state too, simplified here
                                   // We can infer status from artifact.currentStepId or local state if we synced them perfectly.
                                   // For visual simplicity in this specific render cycle:
                                   const status = artifact.currentStepId === step.id ? 'active' : (artifact.sources.length > idx * 2 ? 'done' : 'pending'); 
                                   
                                   return (
                                       <div key={step.id} className={`p-4 rounded-lg border transition-all duration-300 ${
                                           isCurrent ? 'bg-indigo-950/30 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 
                                           status === 'done' ? 'bg-zinc-900/30 border-zinc-800 opacity-60' :
                                           'bg-zinc-900/10 border-zinc-800/50 opacity-40'
                                       }`}>
                                           <div className="flex items-start gap-3">
                                               <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                                                   isCurrent ? 'border-indigo-400 text-indigo-400' : 
                                                   status === 'done' ? 'bg-green-900 border-green-700 text-green-400' :
                                                   'border-zinc-700 text-zinc-600'
                                               }`}>
                                                   {status === 'done' ? <CheckIcon className="w-3 h-3" /> : (idx + 1)}
                                               </div>
                                               <div>
                                                   <p className={`text-sm font-medium ${isCurrent ? 'text-indigo-200' : 'text-zinc-300'}`}>
                                                       {step.query}
                                                   </p>
                                                   {isCurrent && (
                                                       <div className="flex items-center gap-2 mt-2 text-xs text-indigo-400">
                                                           <GlobeIcon className="w-3 h-3 animate-spin" />
                                                           <span>Browsing sources...</span>
                                                       </div>
                                                   )}
                                               </div>
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {/* VIEW 2: FINAL REPORT (Visible during reporting/completed) */}
                   {(artifact.phase === 'reporting' || artifact.phase === 'completed') && (
                       <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <SimpleMarkdown 
                                content={artifact.content} 
                                isStreaming={artifact.phase === 'reporting'}
                            />
                       </div>
                   )}
                   
                   {/* Sources Footer */}
                   {artifact.sources.length > 0 && (artifact.phase === 'reporting' || artifact.phase === 'completed') && (
                       <motion.div 
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         className="mt-12 pt-8 border-t border-zinc-800"
                       >
                           <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">References</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {artifact.sources.map((source, idx) => (
                                   <a 
                                     key={idx} 
                                     href={source.uri} 
                                     target="_blank" 
                                     rel="noreferrer"
                                     className="block p-3 rounded border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 transition text-xs text-zinc-400 hover:text-indigo-400 truncate group"
                                   >
                                       <div className="font-medium truncate text-zinc-300 group-hover:text-indigo-300">{source.title}</div>
                                       <div className="text-[10px] text-zinc-600 mt-1 truncate">{source.uri}</div>
                                   </a>
                               ))}
                           </div>
                       </motion.div>
                   )}
                   
                   <div className="h-20" /> 
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
