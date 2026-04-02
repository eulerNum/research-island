import { useState, useRef, useEffect, useCallback } from 'react';
import type { Paper, Bridge, Road, ResearchGap } from '../services/types';
import { useAIChat } from '../hooks/useAIChat';
import type { ChatMessage, PaperCard } from '../hooks/useAIChat';
import { generateId } from '../utils/idGenerator';

interface AIChatPanelProps {
  entity: Bridge | Road | undefined;
  entityType: 'bridge' | 'road';
  sourceLabel: string;
  targetLabel: string;
  existingPapers: Paper[];
  gaps: ResearchGap[];
  allBridges: { id: string; sourceLabel: string; targetLabel: string; label: string }[];
  allRoads: { id: string; sourceLabel: string; targetLabel: string; label: string }[];
  onAddPaper: (paper: Paper) => string;
  onAddPaperToBridge: (paperId: string, bridgeId: string) => void;
  onAddPaperToRoad: (paperId: string, roadId: string) => void;
  onUpdatePaper: (paper: Paper) => void;
  onShowClaudeSettings: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export default function AIChatPanel({
  entity,
  entityType,
  sourceLabel,
  targetLabel,
  existingPapers,
  gaps,
  allBridges,
  allRoads,
  onAddPaper,
  onAddPaperToBridge,
  onAddPaperToRoad,
  onUpdatePaper,
  onShowClaudeSettings,
  onExpandChange,
}: AIChatPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  }, [expanded, onExpandChange]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chat = useAIChat({
    entity,
    entityType,
    sourceLabel,
    targetLabel,
    existingPapers,
    gaps,
    allBridges,
    allRoads,
    onAddPaper,
    onAddPaperToBridge,
    onAddPaperToRoad,
    onUpdatePaper,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.streamingText, chat.toolStatus]);

  const handleSend = useCallback(() => {
    if (!input.trim() || chat.isStreaming) return;
    const text = input;
    setInput('');
    chat.sendMessage(text);
  }, [input, chat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleAddPaper = useCallback((messageId: string, paperIndex: number, card: PaperCard) => {
    if (card.added) return;
    const paper: Paper = {
      ...card.paper,
      id: card.paper.id || generateId(),
      source: card.paper.semanticScholarId ? 'semantic_scholar' : 'manual',
      createdAt: card.paper.createdAt || new Date().toISOString(),
    };
    const actualId = onAddPaper(paper);
    if (entityType === 'bridge' && entity) {
      onAddPaperToBridge(actualId, entity.id);
    } else if (entityType === 'road' && entity) {
      onAddPaperToRoad(actualId, entity.id);
    }
    chat.markPaperAdded(messageId, paperIndex);
  }, [entity, entityType, onAddPaper, onAddPaperToBridge, onAddPaperToRoad, chat]);

  if (!entity) return null;

  return (
    <div style={{
      borderBottom: expanded ? 'none' : '1px solid var(--border-primary)',
      display: 'flex',
      flexDirection: 'column',
      flex: expanded ? 1 : 'none',
      minHeight: expanded ? 0 : 'auto',
      overflow: 'hidden',
    }}>
      {/* Header toggle */}
      <button
        onClick={toggleExpanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'var(--bg-ai)',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--border-ai)' : 'none',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-ai)',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>
          ▶
        </span>
        AI Chat
        {chat.messages.length > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
            ({chat.messages.length})
          </span>
        )}
      </button>

      {expanded && (
        <>
          {/* Messages area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
          }}>
            {chat.messages.length === 0 && !chat.isStreaming && (
              <div style={{
                color: 'var(--text-tertiary)',
                fontSize: '0.75rem',
                textAlign: 'center',
                padding: '20px 10px',
                lineHeight: 1.6,
              }}>
                이 {entityType === 'bridge' ? '다리' : '도로'}에 대해 질문하세요.<br />
                예: "관련 논문 찾아줘", "최근 연구 트렌드는?"
              </div>
            )}

            {chat.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onAddPaper={(idx, card) => handleAddPaper(msg.id, idx, card)}
              />
            ))}

            {/* Streaming indicator */}
            {chat.isStreaming && (
              <div style={{
                alignSelf: 'flex-start',
                maxWidth: '90%',
              }}>
                {chat.toolStatus && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-ai)',
                    padding: '4px 8px',
                    background: 'var(--bg-ai)',
                    borderRadius: 8,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    {chat.toolStatus}
                  </div>
                )}
                {chat.streamingText && (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '8px 12px',
                    borderRadius: '12px 12px 12px 4px',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {chat.streamingText}
                    <span style={{ animation: 'blink 1s step-end infinite', opacity: 0.6 }}>▌</span>
                  </div>
                )}
                {!chat.streamingText && !chat.toolStatus && (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '8px 12px',
                    borderRadius: '12px 12px 12px 4px',
                    fontSize: '0.8rem',
                    color: 'var(--text-tertiary)',
                  }}>
                    <span style={{ animation: 'blink 1s step-end infinite' }}>...</span>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {chat.error && (
              <div style={{
                padding: '8px 10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                fontSize: '0.75rem',
                color: '#dc2626',
              }}>
                {chat.error}
                <button
                  onClick={onShowClaudeSettings}
                  style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    color: 'var(--text-ai)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  API 설정
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '8px 10px',
            borderTop: '1px solid var(--border-primary)',
            background: 'var(--bg-primary)',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              disabled={chat.isStreaming}
              rows={1}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid var(--border-input)',
                borderRadius: 8,
                fontSize: '0.8rem',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                maxHeight: 80,
                overflowY: 'auto',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chat.isStreaming}
              style={{
                padding: '6px 12px',
                background: input.trim() && !chat.isStreaming ? 'var(--text-heading)' : 'var(--btn-secondary-bg)',
                color: input.trim() && !chat.isStreaming ? '#fff' : 'var(--text-tertiary)',
                border: 'none',
                borderRadius: 8,
                cursor: input.trim() && !chat.isStreaming ? 'pointer' : 'default',
                fontSize: '0.8rem',
                fontWeight: 600,
                alignSelf: 'flex-end',
              }}
            >
              전송
            </button>
          </div>

          {/* CSS animations */}
          <style>{`
            @keyframes blink { 50% { opacity: 0; } }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}
    </div>
  );
}

// ─── Message bubble component ──────────────────────────────

function MessageBubble({
  message,
  onAddPaper,
}: {
  message: ChatMessage;
  onAddPaper: (index: number, card: PaperCard) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '90%',
    }}>
      <div style={{
        background: isUser ? 'var(--text-heading)' : 'var(--bg-secondary)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        padding: '8px 12px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        fontSize: '0.8rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
      }}>
        <SimpleMarkdown text={message.content} />
      </div>

      {/* Paper cards */}
      {message.paperCards && message.paperCards.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.paperCards.map((card, idx) => (
            <PaperCardView
              key={idx}
              card={card}
              onAdd={() => onAddPaper(idx, card)}
            />
          ))}
        </div>
      )}

      {/* Classification results */}
      {message.classifiedBridges && message.classifiedBridges.length > 0 && (
        <div style={{
          marginTop: 4,
          fontSize: '0.7rem',
          color: 'var(--text-ai)',
          padding: '4px 8px',
          background: 'var(--bg-ai)',
          borderRadius: 6,
        }}>
          자동 분류됨: {message.classifiedBridges.map((b) => b.label).join(', ')}
        </div>
      )}
    </div>
  );
}

// ─── Paper card component ──────────────────────────────────

function PaperCardView({
  card,
  onAdd,
}: {
  card: PaperCard;
  onAdd: () => void;
}) {
  const { paper, added } = card;

  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--bg-ai)',
      borderRadius: 6,
      border: '1px solid var(--border-ai)',
      fontSize: '0.78rem',
    }}>
      <div style={{ fontWeight: 'bold', lineHeight: 1.3 }}>
        {paper.title}
        <span style={{ fontWeight: 'normal', color: 'var(--text-tertiary)', marginLeft: 4 }}>
          ({paper.year})
        </span>
      </div>
      {paper.authors.length > 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: 2 }}>
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 && ' et al.'}
        </div>
      )}
      {paper.journal && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', fontStyle: 'italic', marginTop: 1 }}>
          {paper.journal}
        </div>
      )}
      {card.relevance && (
        <div style={{ color: 'var(--text-ai)', fontSize: '0.7rem', marginTop: 3 }}>
          {card.relevance}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
        {added ? (
          <span style={{
            padding: '2px 8px',
            fontSize: '0.7rem',
            color: 'var(--accent-forward)',
            fontWeight: 600,
          }}>
            추가됨 ✓
          </span>
        ) : (
          <button
            onClick={onAdd}
            style={{
              padding: '3px 10px',
              background: 'var(--accent-forward)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.7rem',
            }}
          >
            추가
          </button>
        )}
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', color: 'var(--accent-forward)' }}
          >
            링크
          </a>
        )}
        {paper.citationCount != null && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
            인용 {paper.citationCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Simple markdown renderer ──────────────────────────────

function SimpleMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Bold
    line = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // Italic
    line = line.replace(/\*(.+?)\*/g, '<i>$1</i>');
    // Bullet list
    if (line.match(/^[-•]\s/)) {
      line = '  · ' + line.slice(2);
    }
    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      line = '  ' + line;
    }

    elements.push(
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: line }} />
        {i < lines.length - 1 && <br />}
      </span>,
    );
  }

  return <>{elements}</>;
}
