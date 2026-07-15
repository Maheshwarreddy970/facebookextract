'use client';

import { useState } from 'react';
import { processNextPendingRecord } from '@/actions/engine';
import { seedJsonAction } from '@/actions/seed'; // Import your seed action

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function EngineStarter() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // 1. Function to push JSON to Database
  const handleSeed = async () => {
    setIsSeeding(true);
    setLog(prev => [...prev, "Reading test.json and seeding database..."].slice(-6));
    
    try {
      const response = await seedJsonAction();
      setLog(prev => [...prev, response.message].slice(-6));
    } catch (error) {
      setLog(prev => [...prev, "Failed to seed database."].slice(-6));
    } finally {
      setIsSeeding(false);
    }
  };

  // 2. Function to process the Database
  const runEngine = async () => {
    setIsRunning(true);
    
    try {
      const response = await processNextPendingRecord();
      setLog(prev => [...prev, response.message].slice(-6)); 

      if (response.status === 'processing') {
        await sleep(3000); 
        runEngine(); 
      } 
      else if (response.status === 'error') {
        runEngine();
      }
      else if (response.status === 'rate_limit') {
        setLog(prev => [...prev, "Sleeping for 60 seconds... ⏳"].slice(-6));
        await sleep(60000); 
        runEngine();
      } 
      else {
        setLog(prev => [...prev, "🎉 All records processed!"].slice(-6));
        setIsRunning(false);
      }
    } catch (error) {
      setLog(prev => [...prev, "Engine encountered a fatal error."].slice(-6));
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 border rounded-md max-w-md space-y-4">
      <h2 className="text-xl font-bold">Background Processing Engine</h2>
      
      <div className="flex gap-4">
        {/* New Seed Button */}
        <button 
          onClick={handleSeed} 
          disabled={isSeeding || isRunning}
          className="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
        >
          {isSeeding ? 'Seeding...' : '1. Seed Database'}
        </button>

        <button 
          onClick={runEngine} 
          disabled={isRunning || isSeeding}
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 transition-opacity"
        >
          {isRunning ? 'Engine Running...' : '2. Start Engine'}
        </button>
      </div>

      <div className="bg-gray-100 p-2 rounded-md h-48 overflow-y-auto text-sm font-mono text-gray-800 flex flex-col justify-end">
        {!log.length && <div className="text-gray-500 italic">Awaiting start...</div>}
        {log.map((message, i) => (
          <div key={i} className="mb-1 border-b border-gray-200 pb-1 break-all">
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}