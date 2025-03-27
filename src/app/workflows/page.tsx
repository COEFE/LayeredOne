'use client';

import { useAuth } from '../../context/AuthContext';
import AuthCheck from '../../components/AuthCheck';

export default function WorkflowsPage() {
  return (
    <AuthCheck>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Workflows</h1>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Document workflow functionality is currently in development and will be available soon.
            </p>
            <div className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
              Workflows feature coming soon
            </div>
          </div>
        </div>
      </div>
    </AuthCheck>
  );
}