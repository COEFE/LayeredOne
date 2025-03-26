import ClientChatPage from './client-page';
import { notFound } from 'next/navigation';

export default function ChatPage({ params }: { params: { id: string } }) {
  // Basic validation to check if ID looks potentially valid
  if (!params.id || (params.id !== 'new' && params.id.length < 10)) {
    // If ID doesn't look valid, show the not-found page
    notFound();
  }
  
  return <ClientChatPage id={params.id} />;
}

// This ensures that dynamic routes are rendered at build time
// and not just on-demand, preventing 404 errors
export async function generateStaticParams() {
  // Return known static paths
  return [
    { id: 'new' },
    { id: 'example-1' },
    { id: 'example-2' },
    { id: 'example-3' },
    { id: 'chat-test-1' },
    { id: 'chat-test-2' },
  ];
}

// For static export, we must set dynamicParams to false
export const dynamicParams = false;