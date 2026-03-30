import { useState, useRef, useCallback } from 'react';
import type { Paper } from '../services/types';
import { generateId } from '../utils/idGenerator';
import { searchPapers } from '../services/semanticScholarService';

interface PaperFormProps {
  initialPaper?: Paper;
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

export default function PaperForm({ initialPaper, onSubmit, onCancel }: PaperFormProps) {
  const isEdit = !!initialPaper;
  const [title, setTitle] = useState(initialPaper?.title ?? '');
  const [authors, setAuthors] = useState(initialPaper?.authors.join(', ') ?? '');
  const [year, setYear] = useState(initialPaper?.year ?? new Date().getFullYear());
  const [journal, setJournal] = useState(initialPaper?.journal ?? '');
  const [abstract, setAbstract] = useState(initialPaper?.abstract ?? '');
  const [comment, setComment] = useState(initialPaper?.comment ?? '');
  const [url, setUrl] = useState(initialPaper?.url ?? '');
  const [figures, setFigures] = useState<string[]>(initialPaper?.figureUrls ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [s2Results, setS2Results] = useState<Paper[]>([]);
  const [s2Loading, setS2Loading] = useState(false);
  const [s2Error, setS2Error] = useState<string | null>(null);

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
      id: initialPaper?.id ?? generateId(),
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
      source: initialPaper?.source ?? 'manual',
      createdAt: initialPaper?.createdAt ?? new Date().toISOString(),
      semanticScholarId: initialPaper?.semanticScholarId,
      citationCount: initialPaper?.citationCount,
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
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            required
            autoFocus
          />
          {!isEdit && (
            <button
              type="button"
              disabled={!title.trim() || s2Loading}
              onClick={async () => {
                setS2Loading(true);
                setS2Error(null);
                try {
                  const results = await searchPapers(title.trim(), 5);
                  setS2Results(results);
                } catch (e) {
                  setS2Error((e as Error).message);
                } finally {
                  setS2Loading(false);
                }
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--accent-forward)',
                borderRadius: 4,
                background: 'var(--bg-secondary)',
                cursor: title.trim() && !s2Loading ? 'pointer' : 'default',
                fontSize: '0.7rem',
                color: 'var(--accent-forward)',
                whiteSpace: 'nowrap',
                opacity: title.trim() && !s2Loading ? 1 : 0.5,
              }}
              title="Semantic Scholar에서 검색"
            >
              {s2Loading ? '...' : 'S2 검색'}
            </button>
          )}
        </div>
        {s2Error && (
          <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: 2 }}>{s2Error}</div>
        )}
        {s2Results.length > 0 && (
          <div style={{
            marginTop: 4,
            maxHeight: 160,
            overflowY: 'auto',
            border: '1px solid var(--border-secondary)',
            borderRadius: 4,
            background: 'var(--bg-secondary)',
          }}>
            {s2Results.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setTitle(p.title);
                  setAuthors(p.authors.join(', '));
                  setYear(p.year);
                  if (p.abstract) setAbstract(p.abstract);
                  if (p.url) setUrl(p.url);
                  setS2Results([]);
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-secondary)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  {p.authors.slice(0, 3).join(', ')}{p.authors.length > 3 ? ' ...' : ''} ({p.year})
                  {p.citationCount != null && <span> · {p.citationCount} citations</span>}
                </div>
              </div>
            ))}
          </div>
        )}
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
                    border: '1px solid var(--border-input)',
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
          {isEdit ? 'Save' : 'Add Paper'}
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
  color: 'var(--text-secondary)',
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border-input)',
  borderRadius: 4,
  fontSize: '0.85rem',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--accent-forward)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--btn-secondary-bg)',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
  color: 'var(--text-primary)',
};
