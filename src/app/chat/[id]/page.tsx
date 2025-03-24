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
    // Add any known chat IDs here if applicable
  ];
}

// This tells Next.js to render dynamic paths not returned by generateStaticParams on-demand
export const dynamicParams = true;