// This is a server component
import ChatTestClient from './client';

// This function is required for static site generation with dynamic routes
// It runs at build time to generate the static paths
export function generateStaticParams() {
  // Generate a few example chat test IDs for static pages
  return [
    { id: 'test-1' },
    { id: 'test-2' },
    { id: 'example' },
  ];
}

export default function ChatTestPage({ params }: { params: { id: string } }) {
  return <ChatTestClient id={params.id} />;
}