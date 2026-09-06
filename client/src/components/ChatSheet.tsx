import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AnonymousUser } from '../../../shared/types';
import { Avatar } from './Avatar';
import { 
  Send, 
  Smile, 
  CornerDownRight, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Flag, 
  UserX, 
  Sparkles, 
  X, 
  Check 
} from 'lucide-react';

interface ChatSheetProps {
  messages: ChatMessage[];
  currentUser: AnonymousUser;
  onSendMessage: (content: string, replyToId?: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReportMessage: (msg: ChatMessage) => void;
  onBlockUser: (targetPublicId: string) => void;
  conversationStarters: string[];
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  messages,
  currentUser,
  onSendMessage,
  onDeleteMessage,
  onReportMessage,
  onBlockUser,
  conversationStarters,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const QUICK_EMOJIS = ['✨', '🔥', '🎧', '🎮', '🍙', '👾', '🚀', '💀', '💬', '☕'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), replyingTo?.id);
    setInputText('');
    setReplyingTo(null);
    setShowEmojis(false);
  };

  const handleCopy = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
    setActiveMenuMsgId(null);
  };

  return (
    <div className="flex flex-col h-full bg-surface-300/90 backdrop-blur-xl border-t sm:border border-white/10 sm:rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-surface-200/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Room Chat
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            ({messages.length})
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          End-to-End Anonymous
        </div>
      </div>

      {/* Conversation Starters (Dismissible) */}
      {showStarters && messages.length < 5 && (
        <div className="p-3 mx-3 my-2 bg-surface-100/60 border border-white/10 rounded-2xl shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-accent-cyan text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Need a conversation starter?</span>
            </div>
            <button
              onClick={() => setShowStarters(false)}
              className="text-slate-500 hover:text-slate-300 p-1"
              aria-label="Dismiss suggestions"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {conversationStarters.slice(0, 4).map((starter, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputText(starter);
                  setShowStarters(false);
                }}
                className="whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-surface-200 hover:bg-surface-50 border border-white/10 text-[11px] text-slate-300 hover:text-white transition-all text-left shrink-0"
              >
                "{starter}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
              💬
            </div>
            <p className="text-xs font-medium text-slate-400">No messages yet.</p>
            <p className="text-[11px] text-slate-600 max-w-xs">
              Say hello or drop a question. Only your anonymous character name is visible.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderPublicId === currentUser.publicId;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start group relative ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar style={msg.senderAvatarStyle} size="sm" />

                <div className={`flex flex-col max-w-[78%] ${isSelf ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name & Tag */}
                  <div className="flex items-center gap-1.5 px-1 mb-0.5">
                    <span className="text-[11px] font-medium text-slate-300">
                      {msg.senderCharacterName}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Reply Snippet */}
                  {msg.replyTo && (
                    <div className="text-[10px] bg-white/5 border-l-2 border-accent-cyan px-2 py-1 rounded mb-1 text-slate-400 max-w-full truncate">
                      <span className="font-semibold text-accent-cyan mr-1">
                        @{msg.replyTo.senderCharacterName}:
                      </span>
                      {msg.replyTo.contentSnippet}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative px-3.5 py-2 rounded-2xl text-xs break-words shadow-sm transition-all ${
                      isSelf
                        ? 'bg-gradient-to-r from-accent-purple to-accent-blue text-white rounded-tr-none'
                        : 'bg-surface-100/90 text-slate-200 border border-white/10 rounded-tl-none'
                    }`}
                  >
                    {msg.content}

                    {/* Quick message options trigger */}
                    <button
                      onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-white/60 hover:text-white inline-block align-middle"
                      aria-label="Message options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Message Action Menu */}
                  {activeMenuMsgId === msg.id && (
                    <div className="z-20 mt-1 glass-panel rounded-xl p-1 shadow-2xl border border-white/10 flex items-center gap-1 text-xs">
                      <button
                        onClick={() => {
                          setReplyingTo(msg);
                          setActiveMenuMsgId(null);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
                        title="Reply"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {isSelf ? (
                        <button
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setActiveMenuMsgId(null);
                          }}
                          className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onReportMessage(msg);
                              setActiveMenuMsgId(null);
                            }}
                            className="p-1.5 hover:bg-amber-500/20 text-amber-400 rounded-lg"
                            title="Report message"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onBlockUser(msg.senderPublicId);
                              setActiveMenuMsgId(null);
                            }}
                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg"
                            title="Block user"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-surface-200/80 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <CornerDownRight className="w-3.5 h-3.5 text-accent-cyan shrink-0" />
            <span className="truncate">
              Replying to <b className="text-white">@{replyingTo.senderCharacterName}</b>:{' '}
              <span className="text-slate-400 font-mono">"{replyingTo.content.slice(0, 40)}"</span>
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-white"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Strip */}
      {showEmojis && (
        <div className="p-2 border-t border-white/10 bg-surface-200/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setInputText((prev) => prev + emoji)}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-sm transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Input Field */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-surface-300/90 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowEmojis(!showEmojis)}
          className={`p-2.5 rounded-xl border transition-colors ${
            showEmojis ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan' : 'bg-surface-200 border-white/10 text-slate-400 hover:text-white'
          }`}
          aria-label="Toggle emoji picker"
        >
          <Smile className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message room anonymously..."
          maxLength={1000}
          className="flex-1 glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-md shadow-accent-cyan/20"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
