"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Analyze Documents
        </h1>

        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Your personal assistant with document analysis capabilities. Upload
          documents and save your conversations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-semibold mb-2">Chat with Customers</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Choose from multiple models including to find the perfect
              assistant for your needs.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-xl font-semibold mb-2">Analyze Documents</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Upload PDFs, Word docs, and text files for analysis. Get
              summaries, insights, and answers to your questions.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">💾</div>
            <h3 className="text-xl font-semibold mb-2">Save & Retrieve</h3>
            <p className="text-gray-600 dark:text-gray-300">
              All your and documents are saved securely. Easily access them
              anytime from any device.
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex flex-col md:flex-row gap-4">
            <Link
              href="/chat/new"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start a new chat
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 dark:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Upload documents
            </Link>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign up for free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 dark:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Log in
            </Link>
          </div>
        )}
      </div>

      <div className="mt-20 border-t border-gray-200 dark:border-gray-700 pt-10">
        <h2 className="text-2xl font-bold text-center mb-8">
          Supported LLM Models
        </h2>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex flex-col items-center">
            <div className="text-3xl mb-2">💬</div>
            <div className="font-medium">ChatGPT 4o</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-3xl mb-2">🤖</div>
            <div className="font-medium">Claude Sonnet 3.5</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-3xl mb-2">💬</div>
            <div className="font-medium">ChatGPT 03 Mini</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-3xl mb-2">🤖</div>
            <div className="font-medium">Claude Sonnet 3.7</div>
          </div>
        </div>
      </div>
    </div>
  );
}
