'use client';

import { useState } from 'react';
import { FiChevronDown, FiCpu } from 'react-icons/fi';

interface ModelSelectorProps {
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  onModelChange?: (model: string) => void;
  compact?: boolean; // Add compact mode option
}

interface Model {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic';
  description: string;
}

const models: Model[] = [
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and intelligence'
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Most capable Claude model'
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Fast and cost-effective Claude model'
  },
  {
    id: 'claude-3.5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Latest Claude model with improved capabilities'
  }
];

export default function ModelSelector({ 
  selectedModel = 'claude-3-sonnet-20240229', 
  onSelectModel, 
  onModelChange,
  compact = false
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use the first model as default if selectedModel is not provided
  const selectedModelInfo = models.find(m => m.id === selectedModel) || models[0];
  
  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className={`inline-flex justify-between items-center ${
          compact 
            ? 'px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200' 
            : 'px-3 py-2 border border-gray-300 shadow-sm bg-white'
        } rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <FiCpu className={`${compact ? 'mr-1 h-3 w-3' : 'mr-2 h-4 w-4'} text-gray-500`} />
          {compact ? (
            <span>Model: <span className="font-medium">{selectedModelInfo.name.replace('Claude ', '').replace('ChatGPT ', '')}</span></span>
          ) : (
            <span>{selectedModelInfo.name}</span>
          )}
        </div>
        <FiChevronDown className={`${compact ? 'ml-1 h-3 w-3' : 'ml-2 h-4 w-4'}`} />
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {models.map((model) => (
              <button
                key={model.id}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex flex-col ${
                  model.id === selectedModel ? 'bg-blue-50' : ''
                }`}
                role="menuitem"
                onClick={() => {
                  // Call whichever callback is provided
                  console.log('Model clicked:', model.id);
                  if (onSelectModel) {
                    console.log('Using onSelectModel callback');
                    onSelectModel(model.id);
                  } else if (onModelChange) {
                    console.log('Using onModelChange callback');
                    onModelChange(model.id);
                  } else {
                    console.log('No callback provided!');
                  }
                  setIsOpen(false);
                }}
              >
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-gray-500">{model.provider} · {model.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}