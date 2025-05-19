import { useEffect, useState, useRef } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import localforage from 'localforage';
import { TbWorldSearch, TbBrowserPlus, TbApi } from "react-icons/tb";
import { BiBrain } from "react-icons/bi";
import { FaWikipediaW, FaGoogle, FaBrave } from "react-icons/fa6";
import { SiDuckduckgo } from "react-icons/si";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/src/background/util";

import { useChatTitle } from './hooks/useChatTitle';
import useSendMessage from './hooks/useSendMessage';
import { useUpdateModels } from './hooks/useUpdateModels';
import { Background } from './Background';
import { ChatHistory, ChatMessage, MessageTurn } from './ChatHistory';
import { useConfig } from './ConfigContext';
import type { Config, ChatMode, ChatStatus } from '../types/config'; // Added ChatMode, ChatStatus
import { Header } from './Header';
import { Input } from './Input';
import { Messages } from './Messages';
import { downloadImage, downloadJson, downloadText } from '../background/messageUtils';
import { Settings } from './Settings';
import storage from '../background/storageUtil';

function bridge() {

    let title = '';
    let textContent = '';
    let htmlContent = '';
    let altTexts = '';
    let tableData = '';
    let metaDescription = '';
    let metaKeywords = '';

    try {
        title = document.title || '';

        // --- Safety Measure 2: Limit the scope for innerText/innerHTML if body is enormous ---
        const MAX_BODY_CHARS_FOR_DIRECT_EXTRACTION = 5_000_000; // Approx 5MB of text
        let bodyElement = document.body;

        if (document.body && document.body.innerHTML.length > MAX_BODY_CHARS_FOR_DIRECT_EXTRACTION) {
            console.warn(`[Cognito Bridge] Document body is very large (${document.body.innerHTML.length} chars). Attempting to use a cloned, simplified version for text extraction to improve performance/stability.`);

            const clonedBody = document.body.cloneNode(true) as HTMLElement;
            clonedBody.querySelectorAll('script, style, noscript, iframe, embed, object').forEach(el => el.remove());
            textContent = (clonedBody.textContent || '').replace(/\s\s+/g, ' ').trim();
            htmlContent = document.body.innerHTML.replace(/\s\s+/g, ' ');

        } else if (document.body) {
            textContent = (document.body.innerText || '').replace(/\s\s+/g, ' ').trim();
            htmlContent = (document.body.innerHTML || '').replace(/\s\s+/g, ' ');
        } else {
            console.warn('[Cognito Bridge] document.body is not available.');
        }

        altTexts = Array.from(document.images)
            .map(img => img.alt)
            .filter(alt => alt && alt.trim().length > 0)
            .join('. ');

        tableData = Array.from(document.querySelectorAll('table'))
            .map(table => (table.innerText || '').replace(/\s\s+/g, ' '))
            .join('\n');

        const descElement = document.querySelector('meta[name="description"]');
        metaDescription = descElement ? descElement.getAttribute('content') || '' : '';

        const keywordsElement = document.querySelector('meta[name="keywords"]');
        metaKeywords = keywordsElement ? keywordsElement.getAttribute('content') || '' : '';

    } catch (error) {
        console.error('[Cognito Bridge] Error during content extraction:', error);
        let errorMessage = 'Unknown extraction error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        return JSON.stringify({
            error: `Extraction failed: ${errorMessage}`,
            title: document.title || 'Error extracting title',
            text: '', html: '', altTexts: '', tableData: '',
            meta: { description: '', keywords: '' }
        });
    }

    const MAX_OUTPUT_STRING_LENGTH = 10_000_000;
    
    let responseCandidate = {
        title,
        text: textContent,
        html: htmlContent,
        altTexts,
        tableData,
        meta: {
            description: metaDescription,
            keywords: metaKeywords
        }
    };

    if (JSON.stringify(responseCandidate).length > MAX_OUTPUT_STRING_LENGTH) {
        console.warn('[Cognito Bridge] Total extracted content is very large. Attempting to truncate.');
        const availableLength = MAX_OUTPUT_STRING_LENGTH - JSON.stringify({ ...responseCandidate, text: "", html: "" }).length;
        let remainingLength = availableLength;

        if (responseCandidate.text.length > remainingLength * 0.6) { 
            responseCandidate.text = responseCandidate.text.substring(0, Math.floor(remainingLength * 0.6)) + "... (truncated)";
        }
        remainingLength = availableLength - responseCandidate.text.length;

        if (responseCandidate.html.length > remainingLength * 0.8) {
             responseCandidate.html = responseCandidate.html.substring(0, Math.floor(remainingLength * 0.8)) + "... (truncated)";
        }
        console.warn('[Cognito Bridge] Content truncated. Final approx length:', JSON.stringify(responseCandidate).length);
    }


    return JSON.stringify(responseCandidate);
}

async function injectBridge() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);

  if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) { // Added about:
    console.debug('[Cognito:] Skipping injection for restricted URL:', tab?.url);
    storage.deleteItem('pagestring');
    storage.deleteItem('pagehtml');
    storage.deleteItem('alttexts');
    storage.deleteItem('tabledata');
    return;
  }

  console.debug(`[Cognito:] Attempting injection into tab ${tab.id} (${tab.url})`);

  storage.deleteItem('pagestring');
  storage.deleteItem('pagehtml');
  storage.deleteItem('alttexts');
  storage.deleteItem('tabledata');
  console.debug('[Cognito:] Cleared previous page content from storage.');

  try {
    console.debug('[Cognito:] Executing bridge function...');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: bridge
    });

    if (!results || !Array.isArray(results) || results.length === 0 || !results[0] || typeof results[0].result !== 'string') {
        console.error('[Cognito:] Bridge function execution returned invalid or unexpected results structure:', results);
        return;
    }

    const rawResult = results[0].result;
    let res: any;
    try {
        res = JSON.parse(rawResult);
    } catch (parseError) {
        console.error('[Cognito:] Failed to parse JSON result from bridge:', parseError, 'Raw result string:', rawResult);
        return;
    }

    if (res.error) {
        console.error('[Cognito:] Bridge function reported an error:', res.error, 'Title:', res.title);
        return;
    }

    console.debug('[Cognito:] Bridge function parsed result:', {
        title: res?.title,
        textLength: res?.text?.length,
        htmlLength: res?.html?.length
    });
    console.log(`[Cognito:] Extracted Content: Text=${res?.text?.length}, HTML=${res?.html?.length}`);

    try {
      storage.setItem('pagestring', res?.text ?? '');
      storage.setItem('pagehtml', res?.html ?? '');
      storage.setItem('alttexts', res?.altTexts ?? '');
      storage.setItem('tabledata', res?.tableData ?? '');
      console.debug('[Cognito:] Stored extracted content.');
    } catch (storageError) {
        console.error('[Cognito:] Storage error after successful extraction:', storageError);
        storage.deleteItem('pagestring');
        storage.deleteItem('pagehtml');
        storage.deleteItem('alttexts');
        storage.deleteItem('tabledata');
    }
  } catch (execError) {
    console.error('[Cognito:] Bridge function execution failed:', execError);
    if (execError instanceof Error && (execError.message.includes('Cannot access contents of url "chrome://') || execError.message.includes('Cannot access a chrome extension URL') || execError.message.includes('Cannot access contents of url "about:'))) {
        console.warn('[Cognito:] Cannot access restricted URL.');
    }
  }
}

const generateChatId = () => `chat_${Math.random().toString(16).slice(2)}`;

const MessageTemplate = ({ children, onClick }: { children: React.ReactNode, onClick: () => void }) => (
  (<div
    className={cn(
      "bg-[var(--active)] border border-[var(--text)] rounded-[16px] text-[var(--text)]",
      "cursor-pointer flex items-center justify-center",
      "text-md font-extrabold p-0.5 place-items-center relative text-center",
      "w-16 flex-shrink-0",
      "transition-colors duration-200 ease-in-out",
      "hover:bg-[rgba(var(--text-rgb),0.1)]"
    )}
    onClick={onClick}
  >
    {children}
  </div>)
);

const WEB_SEARCH_MODES = [
  { id: 'Google', icon: FaGoogle, label: 'Google Search' },
  { id: 'Duckduckgo', icon: SiDuckduckgo, label: 'DuckDuckGo Search' },
  { id: 'Brave', icon: FaBrave, label: 'Brave Search' },
  { id: 'Wikipedia', icon: FaWikipediaW, label: 'Wikipedia Search' },
  { id: 'GoogleCustomSearch', icon: TbApi, label: 'Google API Search' },
] as const;

const WebSearchIconButton = ({ children, onClick, isActive, title }: { children: React.ReactNode, onClick: () => void, isActive?: boolean, title: string }) => (
  <Tooltip>
    <TooltipTrigger>
      <div
        className={cn(
          "border rounded-lg text-[var(--text)]",
          "cursor-pointer flex items-center justify-center",
          "p-2 place-items-center relative",
          "w-10 h-10 flex-shrink-0",
          "transition-colors duration-200 ease-in-out",
          isActive 
            ? "bg-[var(--active)] text-[var(--bg)] border-[var(--active)] hover:brightness-95" 
            : "bg-transparent border-[var(--text)]/50 hover:bg-[rgba(var(--text-rgb),0.1)]",
        )}
        onClick={onClick}
        aria-label={title}
      >
        {children}
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" className="bg-[var(--active)]/80 text-[var(--text)] border-[var(--text)]/50">
      <p>{title}</p>
    </TooltipContent>
  </Tooltip>
);

const Cognito = () => {
  const [turns, setTurns] = useState<MessageTurn[]>([]);
  const [message, setMessage] = useState('');
  const [chatId, setChatId] = useState(generateChatId());
  const [webContent, setWebContent] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [settingsMode, setSettingsMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const { config, updateConfig } = useConfig();
  const [currentTabInfo, setCurrentTabInfo] = useState<{ id: number | null, url: string }>({ id: null, url: '' });

  const containerRef = useRef<HTMLDivElement>(null);
  const lastInjectedRef = useRef<{ id: number | null, url: string }>({ id: null, url: '' });

  const [isPageActionsHovering, setIsPageActionsHovering] = useState(false);
  const [isWebSearchHovering, setIsWebSearchHovering] = useState(false);
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        containerRef.current.style.minHeight = '100dvh';
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.minHeight = '';
          }
        });
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (config?.chatMode !== 'page') return;

    const checkAndInject = async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id || !tab.url) return;

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
          console.log(`[Cognito ] Active tab is restricted (${tab.url}). Skipping injection.`);
          if (lastInjectedRef.current.id !== tab.id || lastInjectedRef.current.url !== tab.url) {
              storage.deleteItem('pagestring');
              storage.deleteItem('pagehtml');
              storage.deleteItem('alttexts');
              storage.deleteItem('tabledata');
              console.log("[Cognito ] Cleared storage due to restricted tab activation/update.");
          }
          lastInjectedRef.current = { id: tab.id, url: tab.url };
          setCurrentTabInfo({ id: tab.id, url: tab.url });
          return;
      }

      if (tab.id !== lastInjectedRef.current.id || tab.url !== lastInjectedRef.current.url) {
        console.log(`[Cognito ] Tab changed or updated. Old: ${lastInjectedRef.current.id}/${lastInjectedRef.current.url}, New: ${tab.id}/${tab.url}. Re-injecting bridge.`);
        lastInjectedRef.current = { id: tab.id, url: tab.url };
        setCurrentTabInfo({ id: tab.id, url: tab.url });
        await injectBridge();
      } else {
        console.log(`[Cognito ] Tab activated/updated, but ID and URL match last injection. Skipping bridge injection.`);
      }
    };

    checkAndInject();

    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      console.log(`[Cognito ] Tab activated: tabId ${activeInfo.tabId}`);
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn(`[Cognito ] Error getting tab info on activation: ${chrome.runtime.lastError.message}`);
          return;
        }
        checkAndInject();
      });
    };

    const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && (changeInfo.status === 'complete' || (changeInfo.url && tab.status === 'complete'))) {
         console.log(`[Cognito ] Active tab updated: tabId ${tabId}, status: ${changeInfo.status}, url changed: ${!!changeInfo.url}`);
         checkAndInject();
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      console.log("[Cognito ] Cleaning up tab listeners for 'page' mode.");
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      lastInjectedRef.current = { id: null, url: '' };
    };
  }, [config?.chatMode]);

  const { chatTitle, setChatTitle } = useChatTitle(isLoading, turns, message);
  const onSend = useSendMessage(
    isLoading,
    message,
    turns,
    webContent,
    config,
    setTurns,
    setMessage,
    setWebContent,
    setPageContent,
    setLoading,
    setChatStatus // Pass the setter for dynamic status
  );
  useUpdateModels();

  const reset = () => {
    console.log("[Cognito ] Resetting chat state.");
    setTurns([]);
    setPageContent('');
    setWebContent('');
    setLoading(false);
    updateConfig({ chatMode: undefined, computeLevel: 'low' });
    setChatStatus('idle');    
    setMessage('');
    setChatTitle('');
    setChatId(generateChatId());
    setHistoryMode(false);
    setSettingsMode(false);
  };

  const onReload = () => {
    setTurns(prevTurns => {
      if (prevTurns.length < 2) return prevTurns;
      const last = prevTurns[prevTurns.length - 1];
      const secondLast = prevTurns[prevTurns.length - 2];
      if (last.role === 'assistant' && secondLast.role === 'user') {
        console.log("[Cognito ] Reloading last user message.");
        setMessage(secondLast.rawContent);
        return prevTurns.slice(0, -2);
      }
      console.log("[Cognito ] Cannot reload, conditions not met.");
      return prevTurns;
    });
    setLoading(false);
    setChatStatus('idle');
  };

  const loadChat = (chat: ChatMessage) => {
    console.log(`[Cognito ] Loading chat ${chat.id}`);
    setChatTitle(chat.title || '');
    setTurns(chat.turns);
    setChatId(chat.id);
    setHistoryMode(false);
    setChatStatus('idle');
    setSettingsMode(false);

    const loadedConfigUpdate: Partial<Config> = {
      // chatMode: chat.chatMode || undefined, // Do not restore chatMode from history
      // webMode: chat.webMode || config?.webMode, // Do not restore webMode from history
    };

    if (chat.useNoteActive && chat.noteContentUsed !== undefined) {
      loadedConfigUpdate.useNote = true;
      loadedConfigUpdate.noteContent = chat.noteContentUsed; 
    } else {
      loadedConfigUpdate.useNote = false;
      loadedConfigUpdate.noteContent = ''; 
    }
    updateConfig(loadedConfigUpdate);

    if (loadedConfigUpdate.chatMode !== 'page') {
      storage.deleteItem('pagestring');
      storage.deleteItem('pagehtml');
      storage.deleteItem('alttexts');
      storage.deleteItem('tabledata');
      lastInjectedRef.current = { id: null, url: '' };
    }
  }

  const deleteAll = async () => {
    console.log("[Cognito ] Deleting all chat history from localforage.");
    try {
        const keys = await localforage.keys();
        const chatKeys = keys.filter(key => key.startsWith('chat_'));
        if (chatKeys.length === 0 && turns.length === 0) return; // Avoid toast if nothing to delete
        await Promise.all(chatKeys.map(key => localforage.removeItem(key)));
        toast.success("Deleted all chats");
        reset();
    } catch (error) {
        console.error("[Cognito] Error deleting all chats:", error);
        toast.error("Failed to delete chats");
    }
  };

  useEffect(() => {
    if (turns.length > 0 && !historyMode && !settingsMode) { // Save even if loading to capture user input immediately
      const savedChat: ChatMessage = {
        id: chatId,
        title: chatTitle || `Chat ${new Date(Date.now()).toLocaleString()}`,
        turns,
        last_updated: Date.now(),
        model: config?.selectedModel,
        chatMode: config?.chatMode, 
        webMode: config?.chatMode === 'web' ? config.webMode : undefined,
        useNoteActive: config?.useNote,
        noteContentUsed: config?.useNote ? config.noteContent : undefined,
      };
      console.log(`[Cognito ] Saving chat ${chatId} (Turns: ${turns.length})`);
      localforage.setItem(chatId, savedChat).catch(err => {
        console.error(`[Cognito ] Error saving chat ${chatId}:`, err);
      });
    }
  }, [chatId, turns, chatTitle, config?.selectedModel, config?.chatMode, config?.webMode, config?.useNote, config?.noteContent, historyMode, settingsMode]);

  // Effect to transition from 'done' to 'idle' for chatStatus
  useEffect(() => {
    if (chatStatus === 'done') {
      const timer = setTimeout(() => {
        setChatStatus('idle');
      }, 1500); // Show "Online" (from 'done' status) for 1.5 seconds then truly idle
      return () => clearTimeout(timer);
    }
  }, [chatStatus]);

  useEffect(() => {
    let cancelled = false;

    const handlePanelOpen = async () => {
      if (cancelled) return;
      console.log("[Cognito - Revised] Panel opened. Resetting state.");
      reset();

      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!cancelled && tab?.id && tab.url) {
            setCurrentTabInfo({ id: tab.id, url: tab.url });

            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
                console.log("[Cognito - Revised] Panel opened on restricted tab. Clearing storage.");
                storage.deleteItem('pagestring');
                storage.deleteItem('pagehtml');
                storage.deleteItem('alttexts');
                storage.deleteItem('tabledata');
                lastInjectedRef.current = { id: null, url: '' };
            } else {
                console.log("[Cognito - Revised] Panel opened on valid tab. Injection will occur if mode switched to 'page'. lastInjectedRef is currently:", lastInjectedRef.current);
            }
        } else if (!cancelled) {
            console.log("[Cognito - Revised] Panel opened, but no active tab found or tab has no URL.");
            lastInjectedRef.current = { id: null, url: '' };
            setCurrentTabInfo({ id: null, url: '' });
            storage.deleteItem('pagestring');
            storage.deleteItem('pagehtml');
            storage.deleteItem('alttexts');
            storage.deleteItem('tabledata');
        }
      } catch (error) {
        if (!cancelled) {
        console.error("[Cognito - Revised] Error during panel open tab check:", error);
          lastInjectedRef.current = { id: null, url: '' };
          setCurrentTabInfo({ id: null, url: '' });
          storage.deleteItem('pagestring');
          storage.deleteItem('pagehtml');
          storage.deleteItem('alttexts');
          storage.deleteItem('tabledata');
      }
    }
  }

    handlePanelOpen();

    return () => {
      cancelled = true;
      console.log("[Cognito - Revised] Panel closing (component unmount). Clearing cached content and resetting state.");
      storage.deleteItem('pagestring');
      storage.deleteItem('pagehtml');
      storage.deleteItem('alttexts');
      storage.deleteItem('tabledata');
      reset();
      lastInjectedRef.current = { id: null, url: '' };
    };
  }, []);

  const handleEditTurn = (index: number, newContent: string) => {
    setTurns(prevTurns => {
      const updatedTurns = [...prevTurns];
      if (updatedTurns[index]) {
        updatedTurns[index] = { ...updatedTurns[index], rawContent: newContent };
      }
      return updatedTurns;
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        className={cn( // Ensure this container is exactly viewport height and handles its own overflow.
          "w-full h-dvh p-0 relative overflow-hidden", // Changed min-h-dvh to h-dvh
          "flex flex-col bg-[var(--bg)]" // Main flex container
        )}
      >
          <Header
            chatTitle={chatTitle}
            deleteAll={deleteAll}
            downloadImage={() => downloadImage(turns)}
            downloadJson={() => downloadJson(turns)}
            downloadText={() => downloadText(turns)}
            historyMode={historyMode}
            reset={reset}
            setHistoryMode={setHistoryMode}
            setSettingsMode={setSettingsMode}
            settingsMode={settingsMode}
            chatMode={(config?.chatMode as ChatMode) || 'chat'} // Pass current chat mode
            chatStatus={chatStatus} // Pass current chat status
          />
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {settingsMode && (
            <Settings />
          )}

          {!settingsMode && historyMode && (
            // ChatHistory component handles its own internal scrolling
            <ChatHistory
              className="flex-1 w-full min-h-0" // Ensures it fills the parent if possible
              loadChat={loadChat}
              onDeleteAll={deleteAll}
            />
          )}

          {/* Container for Messages and conditional action buttons when not in settings/history mode */}
          {!settingsMode && !historyMode && (
            // This div allows Messages to take up space and scroll internally.
            // The absolute/fixed positioned buttons float on top.
            // flex-1 and min-h-0 ensure this container and Messages within it behave correctly in flex layout.
            <div className="flex flex-col flex-1 min-h-0 relative"> {/* Added relative for positioning context of fixed/absolute children if needed */}
            {!settingsMode && !historyMode && turns.length > 0 && (
                  <Messages
                    isLoading={isLoading}
                    turns={turns}
                    settingsMode={settingsMode}
                    onReload={onReload}
                    onEditTurn={handleEditTurn}
                  />
                )}
            {turns.length === 0 && !config?.chatMode && (
              (<div className="fixed bottom-20 left-8 flex flex-col gap-2 z-[5]"> { /* bottom-20 (80px) should be above input bar */ }
                <Tooltip> {/* Compute Level Button */}
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Cycle compute level"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const currentLevel = config.computeLevel;
                        const nextLevel = currentLevel === 'low' ? 'medium' : currentLevel === 'medium' ? 'high' : 'low';
                        updateConfig({ computeLevel: nextLevel });
                      }}
                      className={cn(
                        "hover:bg-secondary/70",
                        config.computeLevel === 'high' ? 'text-red-600' :
                        config.computeLevel === 'medium' ? 'text-orange-300' :
                        'text-[var(--text)]'
                      )}
                    >
                      <BiBrain />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[var(--active)]/50 text-[var(--text)] border-[var(--text)] max-w-80">
                    <p>{`Compute Level: ${config.computeLevel?.toUpperCase()}. Click to change. [Warning]: beta feature and resource costly.`}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Add Web Search Results to LLM Context"
                      variant="ghost"
                      size="icon"
                      onClick={() => { 
                        updateConfig({ 
                          chatMode: 'web',
                          webMode: config.webMode || (WEB_SEARCH_MODES[0].id as Config['webMode'])
                        }); 
                      }}
                      className="text-[var(--text)] hover:bg-secondary/70"
                    >
                      <TbWorldSearch />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[var(--active)]/50 text-[var(--text)] border-[var(--text)]">
                    <p>Add Web Search Results to LLM Context</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Add Current Web Page to LLM Context"
                      variant="ghost"
                      size="icon"
                      onClick={() => { updateConfig({ chatMode: 'page' }); }}
                      className="text-[var(--text)] hover:bg-secondary/70"
                    >
                      <TbBrowserPlus />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[var(--active)]/50 text-[var(--text)] border-[var(--text)]">
                    <p>Add Current Web Page to LLM Context</p>
                  </TooltipContent>
                </Tooltip>
              </div>)
                )}
            {config?.chatMode === "page" && (
                   (<div
                      className={cn(
                        "fixed bottom-14 left-0 right-0",
                        "flex flex-row justify-center",
                        "w-full h-12 z-[2]",
                        "transition-all duration-200 ease-in-out",
                        isPageActionsHovering ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2.5",
                        "bg-transparent px-0 py-0"
                      )}
                      style={{ backdropFilter: 'blur(10px)' }}
                      onMouseEnter={() => setIsPageActionsHovering(true)}
                      onMouseLeave={() => setIsPageActionsHovering(false)}
                   >
                     <div className="flex items-center space-x-6 max-w-full overflow-x-auto px-4">
                        <Tooltip>
                          <TooltipTrigger>
                            <MessageTemplate onClick={() => onSend('Provide your summary.')}>
                              TLDR
                            </MessageTemplate>
                          </TooltipTrigger>
                          <TooltipContent side="top" className=" text-[var(--text)] border-[var(--text)]/50">
                            <p>Quick Summary</p>
                          </TooltipContent>
                        </Tooltip>
                       <Tooltip>
                          <TooltipTrigger>
                            <MessageTemplate onClick={() => onSend('Extract all key figures, names, locations, and dates mentioned on this page and list them.')}>
                              Facts
                            </MessageTemplate>
                          </TooltipTrigger>
                          <TooltipContent side="top" className=" text-[var(--text)] border-[var(--text)]/50">
                            <p>Numbers, events, names</p>
                          </TooltipContent>
                        </Tooltip>
                       <Tooltip>
                          <TooltipTrigger>
                            <MessageTemplate onClick={() => onSend('Find positive developments, achievements, or opportunities mentioned on this page.')}>
                              Yay!
                            </MessageTemplate>
                          </TooltipTrigger>
                          <TooltipContent side="top" className=" text-[var(--text)] border-[var(--text)]/50">
                            <p>Good news</p>
                          </TooltipContent>
                        </Tooltip>
                       <Tooltip>
                          <TooltipTrigger>
                            <MessageTemplate onClick={() => onSend('Find concerning issues, risks, or criticisms mentioned on this page.')}>
                              Oops
                            </MessageTemplate>
                          </TooltipTrigger>
                          <TooltipContent side="top" className=" text-[var(--text)] border-[var(--text)]/50">
                            <p>Bad news</p>
                          </TooltipContent>
                        </Tooltip>
                     </div>
                   </div>)
            )}
            {config?.chatMode === "web" && (
              <div
                className={cn(
                  "fixed bottom-14 left-0 right-0",
                  "flex flex-row justify-center",
                  "w-full h-12 z-[2]",
                  "transition-all duration-200 ease-in-out",
                  isWebSearchHovering ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2.5",
                  "bg-transparent px-0 py-0"
                )}
                style={{ backdropFilter: 'blur(10px)' }}
                onMouseEnter={() => setIsWebSearchHovering(true)}
                onMouseLeave={() => setIsWebSearchHovering(false)}
              >
                <div className="flex items-center space-x-3 max-w-full overflow-x-auto px-4 py-1">
                  {WEB_SEARCH_MODES.map((mode) => (
                    <WebSearchIconButton
                      key={mode.id}
                      onClick={() => {
                        updateConfig({ webMode: mode.id as Config['webMode'], chatMode: 'web' }); 
                      }}
                      isActive={config.webMode === mode.id}
                      title={mode.label}
                    >
                      <mode.icon size={18} />
                    </WebSearchIconButton>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
        </div>
        {!settingsMode && !historyMode && (
          <div className="p-2 relative z-[10]"> {/* Wrapper for padding */}
            <Input
              isLoading={isLoading}
              message={message}
              setMessage={setMessage}
              onSend={() => onSend(message)}
            />
          </div>
        )}

        {config?.backgroundImage ? <Background /> : null}
        <Toaster
          containerStyle={{
            borderRadius: 16,
            bottom: '60px',
          }}
          toastOptions={{
            duration: 2000,
            position: "bottom-center",
            style: {
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: "1rem",
              border: '1px solid var(--text)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
            success: {
              duration: 2000,
              style: {
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: "1.25rem"
              }
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
};


export default Cognito;