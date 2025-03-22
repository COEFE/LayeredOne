'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ErrorDisplay() {
  const { error } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      return;
    }
    
    // Check if we're online
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
      // If we just came back online and there was an offline message, clear it
      if (navigator.onLine && errorMessage === 'You are currently offline. Some features may not work properly.') {
        setErrorMessage(null);
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Initial check
    if (!navigator.onLine) {
      setIsOffline(true);
      setErrorMessage('You are currently offline. Some features may not work properly.');
    }

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [errorMessage]);

  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      setShowBanner(true);
    } else if (isOffline) {
      setErrorMessage('You are currently offline. Some features may not work properly.');
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [error, isOffline]);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
      <p>
        {errorMessage || 'An error occurred. Please try again.'}
        {isOffline && ' Please check your internet connection.'}
      </p>
      <button 
        onClick={() => setShowBanner(false)}
        className="absolute right-2 top-2 text-white"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}