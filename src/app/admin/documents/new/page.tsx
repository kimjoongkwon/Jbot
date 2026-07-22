import { DocumentUploadForm } from '@/components/admin/DocumentUploadForm'

export default function NewDocumentPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold text-navy-800">문서 등록</h1>
      <DocumentUploadForm />
    </div>
  )
}
