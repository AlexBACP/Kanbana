import { useRef, useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import api from '../services/api';

interface EvidenceUploaderProps {
  ticketId: number;
  onUploaded?: () => void;
}

interface UploadedFile {
  name: string;
  status: 'uploading' | 'success' | 'error';
}

export const EvidenceUploader = ({ ticketId, onUploaded }: EvidenceUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const file = selected[0];
    const newFile: UploadedFile = { name: file.name, status: 'uploading' };
    setFiles((prev) => [...prev, newFile]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/tickets/${ticketId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, status: 'success' } : f,
        ),
      );
      onUploaded?.();
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, status: 'error' } : f,
        ),
      );
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
      />

      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={16} />
        Subir evidencia
      </Button>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <File size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">
                {file.name}
              </span>
              {file.status === 'uploading' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
              )}
              {file.status === 'success' && (
                <CheckCircle size={16} className="text-green-500" />
              )}
              {file.status === 'error' && (
                <X size={16} className="text-red-500" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};