// This is a server component
import DocumentClientPage from './client';

// Generate static paths for known document IDs
export function generateStaticParams() {
  return [
    { id: 'example-doc-1' },
    { id: 'example-doc-2' },
    { id: 'sample-document' },
  ];
}

export default function DocumentViewPage({ params }: { params: { id: string } }) {
  return <DocumentClientPage id={params.id} />;
}