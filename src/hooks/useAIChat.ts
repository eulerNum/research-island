import { useState, useCallback, useRef, useEffect } from 'react';
import type { Paper, Bridge, Road, ResearchGap } from '../services/types';
import {
  streamChatMessage,
  userMessage,
  assistantMessage,
} from '../services/aiChatService';
import type {
  ChatMessage,
  PaperCard,
  ChatContext,
  ToolCallbacks,
  ApiMessage,
} from '../services/aiChatService';

export type { ChatMessage, PaperCard };

interface UseAIChatParams {
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
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  toolStatus: string | null;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  reset: () => void;
  markPaperAdded: (messageId: string, paperIndex: number) => void;
}

export function useAIChat(params: UseAIChatParams): UseAIChatReturn {
  const {
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
  } = params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API messages for conversation continuity
  const apiMessagesRef = useRef<ApiMessage[]>([]);

  // Track entity ID to reset conversation when entity changes
  const entityIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (entity?.id !== entityIdRef.current) {
      entityIdRef.current = entity?.id;
      // Reset conversation when entity changes
      setMessages([]);
      setStreamingText('');
      setToolStatus(null);
      setError(null);
      apiMessagesRef.current = [];
    }
  }, [entity?.id]);

  const sendMessage = useCallback(async (text: string) => {
    if (!entity || !text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingText('');
    setToolStatus(null);
    setError(null);

    // Add to API messages
    apiMessagesRef.current.push(userMessage(text.trim()));

    const context: ChatContext = {
      entityType,
      entityId: entity.id,
      entityLabel: entity.label ?? '',
      sourceLabel,
      targetLabel,
      direction: entity.direction,
      existingPapers,
      gaps,
      allBridges,
      allRoads,
    };

    const callbacks: ToolCallbacks = {
      onAddPaper,
      onAddPaperToBridge,
      onAddPaperToRoad,
      onUpdatePaper,
      onToolStatus: setToolStatus,
      onDeepSearchProgress: (progress) => {
        setToolStatus(`[Phase ${progress.phase}: ${progress.phaseName}] ${progress.status}`);
      },
    };

    let fullText = '';
    let allPaperCards: PaperCard[] = [];

    try {
      const generator = streamChatMessage(
        apiMessagesRef.current,
        context,
        callbacks,
      );

      for await (const chunk of generator) {
        switch (chunk.type) {
          case 'text_delta':
            fullText += chunk.text;
            setStreamingText(fullText);
            break;
          case 'tool_call_start':
            setToolStatus(
              chunk.name === 'search_papers' ? 'Semantic Scholar 검색 중...' :
              chunk.name === 'add_paper' ? '논문 추가 중...' :
              chunk.name === 'summarize_paper' ? '요약 생성 중...' :
              '처리 중...'
            );
            break;
          case 'tool_result':
            setToolStatus(null);
            break;
          case 'done':
            allPaperCards = chunk.paperCards;
            if (chunk.fullText) {
              fullText = chunk.fullText;
            }
            break;
          case 'error':
            setError(chunk.message);
            break;
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }

    // Create assistant message
    if (fullText || allPaperCards.length > 0) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText,
        paperCards: allPaperCards.length > 0 ? allPaperCards : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      apiMessagesRef.current.push(assistantMessage(fullText));
    }

    setIsStreaming(false);
    setStreamingText('');
    setToolStatus(null);
  }, [
    entity, entityType, sourceLabel, targetLabel,
    existingPapers, gaps, allBridges, allRoads,
    onAddPaper, onAddPaperToBridge, onAddPaperToRoad, onUpdatePaper,
    isStreaming,
  ]);

  const reset = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setToolStatus(null);
    setError(null);
    apiMessagesRef.current = [];
  }, []);

  const markPaperAdded = useCallback((messageId: string, paperIndex: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.paperCards) return msg;
        return {
          ...msg,
          paperCards: msg.paperCards.map((pc, i) =>
            i === paperIndex ? { ...pc, added: true } : pc,
          ),
        };
      }),
    );
  }, []);

  return {
    messages,
    isStreaming,
    streamingText,
    toolStatus,
    error,
    sendMessage,
    reset,
    markPaperAdded,
  };
}
