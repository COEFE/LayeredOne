'use client';

import { useAuth } from '../../context/AuthContext';
import AuthCheck from '../../components/AuthCheck';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <AuthCheck>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            {user && (
              <div className="space-y-2">
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">Account ID:</span> {user.uid}</p>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            <p className="text-gray-500 dark:text-gray-400">Settings functionality coming soon...</p>
          </div>
        </div>
      </div>
    </AuthCheck>
  );
}