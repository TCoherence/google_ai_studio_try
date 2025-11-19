
import React, { useState } from 'react';
import { ResearchPlan, ResearchStep } from '../types';
import { CheckIcon, PlusIcon, TrashIcon } from './Icons';

interface Props {
  plan: ResearchPlan;
  onApprove: (approvedPlan: ResearchPlan) => void;
}

export default function PlanReview({ plan, onApprove }: Props) {
  const [steps, setSteps] = useState<ResearchStep[]>(plan.steps);
  const [newStepText, setNewStepText] = useState('');

  const handleAdd = () => {
    if (!newStepText.trim()) return;
    const newStep: ResearchStep = {
      id: `new-${Date.now()}`,
      query: newStepText,
      status: 'pending'
    };
    setSteps([...steps, newStep]);
    setNewStepText('');
  };

  const handleRemove = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleEdit = (id: string, text: string) => {
    setSteps(steps.map(s => s.id === id ? { ...s, query: text } : s));
  };

  return (
    <div className="mt-4 bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Review Research Plan</h3>
        <span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
          Human in the Loop
        </span>
      </div>
      
      <div className="p-4 space-y-3">
        <p className="text-xs text-zinc-400 mb-2">
          I've drafted a plan to research "{plan.topic}". Please review, edit, or add steps before I begin.
        </p>

        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 group">
            <div className="flex-1 bg-black/40 border border-zinc-800/50 rounded-md px-3 py-2 flex items-center">
              <input 
                className="bg-transparent w-full text-sm text-zinc-300 focus:outline-none"
                value={step.query}
                onChange={(e) => handleEdit(step.id, e.target.value)}
              />
            </div>
            <button 
              onClick={() => handleRemove(step.id)}
              className="p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add New */}
        <div className="flex items-center gap-2 pt-2">
           <div className="flex-1 bg-black/20 border border-dashed border-zinc-700 rounded-md px-3 py-2 flex items-center focus-within:border-blue-500/50 transition-colors">
              <input 
                className="bg-transparent w-full text-sm text-zinc-400 focus:outline-none placeholder:text-zinc-700"
                placeholder="Add a custom research step..."
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
           </div>
           <button 
             onClick={handleAdd}
             disabled={!newStepText.trim()}
             className="p-2 text-zinc-500 hover:text-blue-400 disabled:opacity-50"
           >
             <PlusIcon className="w-4 h-4" />
           </button>
        </div>
      </div>

      <div className="bg-zinc-900/50 p-4 border-t border-zinc-800 flex justify-end">
        <button 
          onClick={() => onApprove({ ...plan, steps })}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <CheckIcon className="w-4 h-4" />
          <span>Approve & Start Research</span>
        </button>
      </div>
    </div>
  );
}
