
import React, { useState, useEffect, useCallback } from 'react';
import { Message } from './types';
import { answerFromSOP } from './services/geminiService';
import Header from './components/Header';
import Login from './components/Login';
import ChatView from './components/ChatView';
import SOPViewer from './components/SOPViewer';
import { SOP_CONTEXT } from './constants';

type Theme = 'light' | 'dark';

const INITIAL_MESSAGE: Message = {
  role: 'model',
  content: "Welcome to the Navy Anchorage School and College SOP Assistant. How can I help you today? Please ask any question regarding the Standard Operating Procedures.",
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState<'chat' | 'search'>('chat');
  
  // Initialize theme from localStorage, default to 'dark'
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
    }
    return 'dark';
  });
  
  // Chat State - Initialized directly without localStorage to prevent history persistence across sessions
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search State
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (isLoading || !content.trim()) return;

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Add placeholder for model response
    setMessages((prev) => [...prev, { role: 'model', content: '' }]);

    let fullContent = '';

    try {
      const stream = answerFromSOP(content);

      for await (const chunk of stream) {
        fullContent += chunk;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = { role: 'model', content: fullContent };
          return newMessages;
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to get response: ${errorMessage}`);
      // Remove the empty placeholder and add error message
      setMessages((prev) => {
        const newMessages = prev.slice(0, -1); // remove placeholder
        return [...newMessages, {
          role: 'model',
          content: `Sorry, I encountered an error. Please check your API key or network connection and try again. Error: ${errorMessage}`,
        }];
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleGenerateSummary = useCallback(async () => {
    if (isLoading) return;

    const summaryPrompt = "Please generate a summary of the SOP document.";
    await handleSendMessage(summaryPrompt);
  }, [isLoading, handleSendMessage]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => {
        console.warn(`Could not enter fullscreen mode: ${err.message}`);
      });
    }
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleToggleSearch = () => {
    setIsSearchVisible(prev => !prev);
    if (isSearchVisible) { // If we are closing it
      handleCloseSearch();
    }
  };

  const handleCloseSearch = () => {
    setIsSearchVisible(false);
    setView('chat');
    setSearchQuery('');
    setSearchResultCount(0);
    setCurrentResultIndex(0);
  };
  
  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setView('chat');
      setSearchResultCount(0);
      return;
    }
    const regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const matches = SOP_CONTEXT.match(regex);
    const count = matches ? matches.length : 0;
    
    setSearchQuery(query);
    setSearchResultCount(count);
    setCurrentResultIndex(0);
    setView('search');
    setIsSearchVisible(true); // Ensure search bar is visible when searching
  };

  const handleNextResult = () => {
    setCurrentResultIndex(prev => (prev + 1) % searchResultCount);
  };

  const handlePrevResult = () => {
    setCurrentResultIndex(prev => (prev - 1 + searchResultCount) % searchResultCount);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col h-screen font-sans antialiased text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-navy-dark print:h-auto print:overflow-visible">
      <Header 
        isSearchVisible={isSearchVisible}
        onToggleSearch={handleToggleSearch}
        onSearch={handleSearch}
        onNextResult={handleNextResult}
        onPrevResult={handlePrevResult}
        onCloseSearch={handleCloseSearch}
        searchResultCount={searchResultCount}
        currentResultIndex={currentResultIndex}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      
      {view === 'chat' ? (
        <ChatView
          messages={messages}
          isLoading={isLoading}
          error={error}
          onSendMessage={handleSendMessage}
          onGenerateSummary={handleGenerateSummary}
        />
      ) : (
        <SOPViewer 
          sopText={SOP_CONTEXT}
          searchQuery={searchQuery}
          currentResultIndex={currentResultIndex}
        />
      )}
    </div>
  );
};

export default App;
