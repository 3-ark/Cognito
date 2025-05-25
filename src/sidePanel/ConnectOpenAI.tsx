import { useState } from 'react';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash, FaCheck } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfig } from './ConfigContext';
import { OPENAI_URL } from './constants';
import { cn } from "@/src/background/util";

export const ConnectOpenAI = () => {
  const { config, updateConfig } = useConfig();
  const [apiKey, setApiKey] = useState(config?.openAiApiKey || '');
  const [visibleApiKey, setVisibleApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const buttonHeightClass = 'h-8';

  const onConnect = () => {
    if (!apiKey) {
      toast.error("API key is required for OpenAI.");
      return;
    }
    setIsLoading(true);
    toast.dismiss();
    toast.loading('Connecting to OpenAI...');

    fetch(OPENAI_URL, { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            const errorMsg = errData?.error?.message || `Connection failed: ${res.status} ${res.statusText}`;
            throw new Error(errorMsg);
          }).catch(() => {
            throw new Error(`Connection failed: ${res.status} ${res.statusText}`);
          });
        }
        return res.json();
      })
      .then(data => {
        if (data?.error) {
          toast.error(`${data?.error?.message}`)

          updateConfig({ openAiError: data?.error?.message, openAiConnected: false });
        } else {
          toast.success('connected to OpenAI');

          updateConfig({
            openAiApiKey: apiKey,
            openAiConnected: true,
            openAiError: undefined,
            models: [
              ...(config?.models || []),
              { id: 'openai', host: 'openai', active: true }
            ],
            selectedModel: 'openai'
          });
        }
      })
      .catch(err => {
        toast.dismiss();
        toast.error(err.message || "Failed to connect to OpenAI");
        updateConfig({ openAiError: err.message, openAiConnected: false });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const connectButtonDisabled = !apiKey || isLoading;
  const isConnected = config?.openAiConnected;

  return (
    <div className="flex items-center space-x-3">
      <div className="relative flex-grow">
        <Input
          id="openai-api-key"
          autoComplete="off"
          placeholder="OPENAI_API_KEY"
          type={visibleApiKey ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className={cn( 
            {"pr-8": true}
          )}
          disabled={isLoading}
        />
        <Button
            variant="ghost" size="sm"
            className={cn("absolute inset-y-0 right-0 flex items-center justify-center", buttonHeightClass, "w-8 text-[var(--text)]/70 hover:text-[var(--text)]")}
            onClick={() => setVisibleApiKey(!visibleApiKey)}
            aria-label={visibleApiKey ? "Hide API key" : "Show API key"}
            disabled={isLoading}
        >
            {visibleApiKey ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
        </Button>
      </div>

      {!isConnected && (
        <Button
          onClick={onConnect}
          className={cn(
            buttonHeightClass, "text-sm font-medium whitespace-nowrap",
            "bg-[rgba(255,250,240,0.4)] dark:bg-[rgba(255,255,255,0.1)]  text-[var(--text)] hover:bg-[var(--active)]/90 rounded-md shadow-sm",
            "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]"
          )}
          disabled={connectButtonDisabled}
        >
          {isLoading ? "..." : "Save"}
        </Button>
      )}
      {isConnected && (
        <Button
          variant="ghost" size="sm" aria-label="Connected to OpenAI"
          className={cn(buttonHeightClass, "w-8 rounded-md text-[var(--success)]")}
          onClick={onConnect}
          disabled={isLoading}
        >
          <FaCheck className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};