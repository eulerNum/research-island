import { useState, useRef, useCallback } from 'react';
import type { Paper } from '../services/types';
import { generateId } from '../utils/idGenerator';

interface PaperFormProps {
  onSubmit: (paper: Paper) => void;
  onCancel: () => void;
}

/** Read a File/Blob as a base64 data URL */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PaperForm({ onSubmit, onCancel }: PaperFormProps) {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [journal, setJournal] = useState('');
  const [abstract, setAbstract] = useState('');
  const [comment, setComment] = useState('');
  const [url, setUrl] = useState('');
  const [figures, setFigures] = useState<string[]>([]); // base64 data URLs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback(async (files: File[] | Blob[]) => {
    const dataUrls: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      dataUrls.push(await toDataUrl(file));
    }
    if (dataUrls.length > 0) {
      setFigures((prev) => [...prev, ...dataUrls]);
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addImages(files);
    // Reset so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFigure = (index: number) => {
    setFigures((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !year) return;

    const paper: Paper = {
      id: generateId(),
      title: title.trim(),
      authors: authors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      year,
      journal: journal.trim() || undefined,
      abstract: abstract.trim() || undefined,
      comment: comment.trim() || undefined,
      figureUrls: figures.length > 0 ? figures : undefined,
      url: url.trim() || undefined,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    onSubmit(paper);
  };

  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div>
        <label style={labelStyle}>Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
          required
          autoFocus
        />
      </div>
      <div>
        <label style={labelStyle}>Authors (comma separated)</label>
        <input value={authors} onChange={(e) => setAuthors(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Year *</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={inputStyle}
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Journal</label>
        <input value={journal} onChange={(e) => setJournal(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>My Note</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ ...inputStyle, minHeight: 40, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>DOI / URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} />
      </div>

      {/* Figures: file picker + paste zone */}
      <div>
        <label style={labelStyle}>Figures (file or Ctrl+V paste)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ fontSize: '0.8rem' }}
        />
        {/* Thumbnail previews */}
        {figures.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {figures.map((dataUrl, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={dataUrl}
                  alt={`Fig ${i + 1}`}
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeFigure(i)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#e76f51',
                    color: '#fff',
                    fontSize: '0.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button type="submit" style={btnPrimary}>
          Add Paper
        </button>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#666',
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.85rem',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  background: '#2a9d8f',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  background: '#eee',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
};
