import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Send, Mic, MicOff, Image as ImageIcon, Video as VideoIcon, 
  Paperclip, FileText, Check, AlertTriangle, Lightbulb, MapPin, Star, 
  ExternalLink, RefreshCw, MessageSquare 
} from 'lucide-react';
import { TaskItem, AIChatMessage, AITaskProposal, AIMapPlace, Attachment } from '../types';
import { Storage } from '../utils/storage';
import { NotificationEngine } from '../utils/notifications';

// Global reference to prevent garbage collection of speaking utterances in Chrome
let activeUtterances: SpeechSynthesisUtterance[] = [];

interface AIAssistantProps {
  tasks: Record<'professional' | 'personal' | 'events' | 'wishlist', TaskItem[]>;
  onAcceptTasks: (proposals: AITaskProposal[]) => void;
  onDeleteTask: (tab: 'professional' | 'personal' | 'events' | 'wishlist', id: string) => void;
  onUpdateTask: (tab: 'professional' | 'personal' | 'events' | 'wishlist', id: string, updates: Partial<TaskItem>) => void;
}

const THINKING_STATES = [
  'Analyzing your schedule...',
  'Checking for conflicts...',
  'Thinking of the best plan...',
  'Searching nearby options...',
  'Reading your document...'
];

export const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, onAcceptTasks, onDeleteTask, onUpdateTask }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<AIChatMessage & { mediaUrl?: string; mediaType?: 'image' | 'video'; attachmentName?: string }>>([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: "Hello! I am Jarvis ✨, here to help. I can help you manage your tasks, analyze documents, detect schedule conflicts, and find nearby places. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mediaFile, setMediaFile] = useState<{ name: string; dataUrl: string; type: 'image' | 'video' | 'doc'; mimeType: string; textContent?: string } | null>(null);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [acceptedPropMsgIds, setAcceptedPropMsgIds] = useState<Record<string, boolean>>({});
  const [rejectedPropMsgIds, setRejectedPropMsgIds] = useState<Record<string, boolean>>({});

  // 6 changes states
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const [isBackgroundListening, setIsBackgroundListening] = useState(false);
  const [showPulsingDot, setShowPulsingDot] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);

  const backgroundRecognitionRef = useRef<any>(null);
  const utteranceRef = useRef<any>(null);
  const activeSpeechSessionRef = useRef<string | null>(null);
  const isListeningRef = useRef(isListening);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const [isTalkModeActive, setIsTalkModeActive] = useState(false);
  const isTalkModeActiveRef = useRef(isTalkModeActive);

  useEffect(() => {
    isTalkModeActiveRef.current = isTalkModeActive;
  }, [isTalkModeActive]);

  const [showVoiceToast, setShowVoiceToast] = useState(false);
  const silenceTimeoutRef = useRef<any>(null);

  const resetSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    silenceTimeoutRef.current = setTimeout(() => {
      if (isTalkModeActiveRef.current) {
        console.log('Silence timeout reached. Exiting Talking Mode...');
        setIsTalkModeActive(false);
        speakText("I'll be listening in the background if you need me.");
      }
    }, 15000); // 15 seconds of silence
  };

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  const activeTalkRecognitionRef = useRef<any>(null);
  const isProcessingSpeechRef = useRef<boolean>(false);

  // Speech Synthesis (Voice output) with support for onEnd callback
  const speakText = (text: string, onEndCallback?: () => void) => {
    console.log('Jarvis TTS Lifecycle: speakText called with text:', text);
    if (!('speechSynthesis' in window)) {
      console.log('Jarvis: speechSynthesis not supported');
      if (onEndCallback) onEndCallback();
      return;
    }

    // Generate a unique speech session ID for this speak request
    const sessionId = Date.now().toString() + '-' + Math.random().toString();
    activeSpeechSessionRef.current = sessionId;

    // Set speaking states immediately to prevent race conditions
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // Temporarily pause SpeechRecognition during speech synthesis
    if (activeTalkRecognitionRef.current) {
      console.log('Jarvis TTS: Pausing activeTalkRecognition because speech started');
      try {
        activeTalkRecognitionRef.current.onend = null;
        activeTalkRecognitionRef.current.onerror = null;
        activeTalkRecognitionRef.current.stop();
      } catch (e) {
        console.warn('Jarvis TTS: Error stopping activeTalkRecognition', e);
      }
      activeTalkRecognitionRef.current = null;
    }

    if (backgroundRecognitionRef.current) {
      console.log('Jarvis TTS: Pausing backgroundRecognition because speech started');
      try {
        backgroundRecognitionRef.current.onend = null;
        backgroundRecognitionRef.current.onerror = null;
        backgroundRecognitionRef.current.stop();
      } catch (e) {
        console.warn('Jarvis TTS: Error stopping backgroundRecognition', e);
      }
      backgroundRecognitionRef.current = null;
    }

    setIsListening(false);

    // Detach listeners from any previously active utterance so they don't fire stale events
    if (utteranceRef.current) {
      console.log('Jarvis TTS: Detaching event listeners from previous utterance');
      try {
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      } catch (e) {}
      utteranceRef.current = null;
    }

    // Only cancel if there is active or pending speech to avoid corrupting speech engine state
    const isCurrentlySpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    if (isCurrentlySpeaking) {
      console.log('Jarvis TTS: Speech is active or pending, cancelling previous speech safely');
      window.speechSynthesis.cancel();
    } else {
      console.log('Jarvis TTS: No active/pending speech. Skipping cancel call to prevent engine freeze.');
    }

    // Unstuck browser TTS engine if it got paused
    try {
      window.speechSynthesis.resume();
    } catch (e) {
      console.warn('Jarvis TTS: Error resuming speechSynthesis', e);
    }

    // Clean markdown
    const plainText = text
      .replace(/[*#_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Split plainText into chunks of maximum ~140 characters, trying to split at sentence/clause boundaries if possible.
    const getChunks = (txt: string, maxLen = 140): string[] => {
      const rawSentences = txt.split(/([.!?]+(?:\s+|$))/g);
      const res: string[] = [];
      let currentChunk = '';

      for (let i = 0; i < rawSentences.length; i++) {
        const segment = rawSentences[i];
        if (!segment) continue;

        if ((currentChunk + segment).length > maxLen) {
          if (currentChunk.trim()) {
            res.push(currentChunk.trim());
          }
          currentChunk = segment;
        } else {
          currentChunk += segment;
        }
      }
      if (currentChunk.trim()) {
        res.push(currentChunk.trim());
      }

      // If any single chunk is still too long (e.g. no punctuation), split it by words
      const finalChunks: string[] = [];
      for (const chunk of res) {
        if (chunk.length > maxLen) {
          const words = chunk.split(/\s+/);
          let subChunk = '';
          for (const w of words) {
            if ((subChunk + ' ' + w).length > maxLen) {
              if (subChunk.trim()) finalChunks.push(subChunk.trim());
              subChunk = w;
            } else {
              subChunk = subChunk ? subChunk + ' ' + w : w;
            }
          }
          if (subChunk.trim()) finalChunks.push(subChunk.trim());
        } else {
          finalChunks.push(chunk);
        }
      }

      return finalChunks.filter(Boolean);
    };

    const chunks = getChunks(plainText);
    console.log('Jarvis TTS: Text split into', chunks.length, 'chunks:', chunks);

    if (chunks.length === 0) {
      console.log('Jarvis TTS: Empty text, firing end callback immediately');
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      else if (isTalkModeActiveRef.current) startActiveTalkListening();
      else startWakeWordListener();
      return;
    }

    let currentChunkIndex = 0;

    const speakNextChunk = () => {
      if (activeSpeechSessionRef.current !== sessionId) {
        console.log('Jarvis TTS: Aborting next chunk because session changed');
        return;
      }

      if (currentChunkIndex >= chunks.length) {
        console.log('Jarvis TTS: All chunks played successfully');
        // Clean up from global activeUtterances array
        activeUtterances = activeUtterances.filter(u => u !== utteranceRef.current);
        utteranceRef.current = null;

        setIsSpeaking(false);
        isSpeakingRef.current = false;

        if (onEndCallback) {
          console.log('Jarvis TTS: Triggering custom onEndCallback');
          onEndCallback();
        } else {
          console.log('Jarvis TTS: No custom callback. Resuming appropriate listener');
          if (isTalkModeActiveRef.current) {
            startActiveTalkListening();
          } else {
            startWakeWordListener();
          }
        }
        return;
      }

      const chunkText = chunks[currentChunkIndex];
      console.log(`Jarvis TTS: Playing chunk ${currentChunkIndex + 1}/${chunks.length}: "${chunkText}"`);

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utteranceRef.current = utterance;

      // Prevent garbage collection
      activeUtterances.push(utterance);

      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      let hasAssigned = false;
      const assignVoiceAndSpeak = () => {
        if (hasAssigned) return;
        hasAssigned = true;

        const voices = window.speechSynthesis.getVoices();
        const maleKeywords = ['male', 'david', 'daniel', 'alex', 'george', 'fred', 'james', 'richard'];
        
        // Filter English voices
        const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
        
        // Prioritize local service voices (offline-capable) to avoid iframe network blockages in Chrome sandbox
        const localEnglishVoices = englishVoices.filter(v => v.localService === true || v.localService === undefined);
        
        let preferredVoice: SpeechSynthesisVoice | undefined;
        
        if (localEnglishVoices.length > 0) {
          // Find local male voice if possible
          preferredVoice = localEnglishVoices.find(v => {
            const nameLower = v.name.toLowerCase();
            return maleKeywords.some(keyword => nameLower.includes(keyword));
          });
          // Fall back to any local English voice
          if (!preferredVoice) {
            preferredVoice = localEnglishVoices[0];
          }
        }
        
        // Fall back to general English voices (network ones) if no local English voices exist
        if (!preferredVoice && englishVoices.length > 0) {
          preferredVoice = englishVoices.find(v => {
            const nameLower = v.name.toLowerCase();
            return maleKeywords.some(keyword => nameLower.includes(keyword));
          });
          if (!preferredVoice) {
            preferredVoice = englishVoices[0];
          }
        }
        
        // Ultimate fallback
        if (!preferredVoice && voices.length > 0) {
          preferredVoice = voices[0];
        }

        if (preferredVoice) {
          console.log(`Jarvis TTS: Selected voice "${preferredVoice.name}" (Lang: ${preferredVoice.lang}, LocalService: ${preferredVoice.localService})`);
          utterance.voice = preferredVoice;
        }

        let hasFiredEnd = false;
        const fireEndCallback = () => {
          if (activeSpeechSessionRef.current !== sessionId) {
            return;
          }
          // Remove from global activeUtterances array
          activeUtterances = activeUtterances.filter(u => u !== utterance);

          if (!hasFiredEnd) {
            hasFiredEnd = true;
            console.log(`Jarvis TTS: Chunk ${currentChunkIndex + 1} finished.`);
            currentChunkIndex++;
            speakNextChunk();
          }
        };

        utterance.onstart = () => {
          if (activeSpeechSessionRef.current !== sessionId) return;
          setIsSpeaking(true);
          isSpeakingRef.current = true;
        };

        utterance.onend = () => {
          fireEndCallback();
        };

        utterance.onerror = (e) => {
          console.warn(`Jarvis TTS: Chunk error [Code: ${e.error}]`, e);
          fireEndCallback();
        };

        // Small delay between chunks to let Chrome settle its internal state machine
        setTimeout(() => {
          if (activeSpeechSessionRef.current !== sessionId) return;
          window.speechSynthesis.speak(utterance);
        }, 50);

        // Safety fallback per chunk: wait a reasonable amount of time based on chunk length
        const estimatedTimeMs = Math.max(2500, chunkText.length * 150);
        setTimeout(() => {
          if (activeSpeechSessionRef.current === sessionId && !hasFiredEnd) {
            console.warn('Jarvis TTS: Chunk onend never fired. Falling back to next chunk.');
            fireEndCallback();
          }
        }, estimatedTimeMs);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        const handleVoicesChanged = () => {
          if (activeSpeechSessionRef.current === sessionId) {
            assignVoiceAndSpeak();
          }
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        setTimeout(() => {
          if (activeSpeechSessionRef.current === sessionId && !hasAssigned) {
            assignVoiceAndSpeak();
          }
        }, 500);
      } else {
        assignVoiceAndSpeak();
      }
    };

    // Start speaking first chunk with a delay if we had to cancel active speech, giving Chrome time to settle
    if (isCurrentlySpeaking) {
      console.log('Jarvis TTS: Waiting 300ms for cancel to settle before playing first chunk');
      setTimeout(() => {
        if (activeSpeechSessionRef.current === sessionId) {
          speakNextChunk();
        }
      }, 300);
    } else {
      speakNextChunk();
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      console.log('Jarvis TTS: stopSpeaking called, cancelling active speech synthesis');
      activeSpeechSessionRef.current = null;
      if (utteranceRef.current) {
        try {
          utteranceRef.current.onstart = null;
          utteranceRef.current.onend = null;
          utteranceRef.current.onerror = null;
        } catch (e) {}
        // Remove from global activeUtterances
        activeUtterances = activeUtterances.filter(u => u !== utteranceRef.current);
        utteranceRef.current = null;
      }
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch (e) {}
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isOpen && !isTalkModeActive) {
      stopSpeaking();
    }
  }, [isOpen, isTalkModeActive]);

  // Hands-free continuous dialogue session
  const startActiveTalkListening = () => {
    if (!isTalkModeActiveRef.current) return;
    if (isProcessingSpeechRef.current) return;
    if (isSpeakingRef.current) {
      console.log('Jarvis TTS: startActiveTalkListening blocked because speech is active');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (backgroundRecognitionRef.current) {
      try {
        backgroundRecognitionRef.current.onend = null;
        backgroundRecognitionRef.current.onerror = null;
        backgroundRecognitionRef.current.stop();
      } catch (e) {}
      backgroundRecognitionRef.current = null;
    }
    if (activeTalkRecognitionRef.current) {
      try {
        activeTalkRecognitionRef.current.onend = null;
        activeTalkRecognitionRef.current.onerror = null;
        activeTalkRecognitionRef.current.stop();
      } catch (e) {}
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      let hasProcessedResult = false;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          console.log('Talk Mode transcription:', transcript);
          hasProcessedResult = true;
          isProcessingSpeechRef.current = true;
          
          // Stop current listener immediately so we don't listen while processing/speaking
          try {
            rec.onend = null;
            rec.onerror = null;
            rec.stop();
          } catch (e) {}

          const lower = transcript.toLowerCase();
          // Recognize stop commands to exit Talking Mode
          if (
            lower.includes('stop listening') || 
            lower.includes('jarvis stop') || 
            lower.includes('stop jarvis') || 
            lower.includes('goodbye') || 
            lower.includes('exit talk mode') || 
            lower.includes('bye jarvis') || 
            lower.includes('bye-bye')
          ) {
            clearSilenceTimeout();
            setIsTalkModeActive(false);
            stopSpeaking();
            setIsListening(false);
            isProcessingSpeechRef.current = false;
            return;
          }

          // User spoke, so reset the silence timeout!
          resetSilenceTimeout();

          setIsLoading(true);
          try {
            const allActiveTasks: any[] = [];
            Object.entries(tasks || {}).forEach(([tab, list]) => {
              ((list as TaskItem[]) || []).forEach(t => allActiveTasks.push({ ...t, tab }));
            });

            const res = await fetch('/api/ai/assistant', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: transcript,
                history: messages.map(m => ({ sender: m.sender, text: m.text })),
                allTasks: allActiveTasks
              })
            });

            const data = await res.json();
            setIsLoading(false);

            const aiReplyText = data.reply || data.text || "I processed that.";

            // Smart Auto-Open panel when visual content is needed
            const isVisualNeeded = !!(
              (data.places && data.places.length > 0) || 
              (data.proposals && data.proposals.length > 0) || 
              data.conflictWarning ||
              aiReplyText.includes('\n-') || 
              aiReplyText.includes('\n*') || 
              aiReplyText.includes('\n|') || 
              /\n\d+\./.test(aiReplyText)
            );

            if (isVisualNeeded) {
              setIsOpen(true);
            }
            
            // Sync message inside the chat list for visual record in background
            setMessages(prev => [...prev, 
              {
                id: (Date.now() - 1).toString(),
                sender: 'user',
                text: transcript,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              },
              {
                id: Date.now().toString(),
                sender: 'ai',
                text: aiReplyText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                proposals: data.proposals || [],
                conflictWarning: data.conflictWarning || undefined,
                places: data.places || []
              }
            ]);

            // Clear silence timeout during speak to avoid timer ticking
            clearSilenceTimeout();

            // Speak the answer or a short summary
            let verbalSpeech = aiReplyText;
            if (isVisualNeeded) {
              if (data.places && data.places.length > 0) {
                verbalSpeech = `I found ${data.places.length} nearby locations. Check the screen for details.`;
              } else if (data.proposals && data.proposals.length > 0) {
                verbalSpeech = `I've drafted ${data.proposals.length} task proposals for you. Please check the screen to review them.`;
              } else if (data.conflictWarning) {
                verbalSpeech = `I found a scheduling conflict. Check the screen for suggestions to resolve it.`;
              } else {
                const match = aiReplyText.match(/^[^.!?]+[.!?]/);
                const firstSentence = match ? match[0] : aiReplyText.substring(0, 100);
                verbalSpeech = `${firstSentence} Please check the screen for complete details.`;
              }
            }

            if (!isTalkModeActiveRef.current) {
              isProcessingSpeechRef.current = false;
              setIsListening(false);
              return;
            }

            speakText(verbalSpeech, () => {
              isProcessingSpeechRef.current = false;
              setIsListening(false);
              setTimeout(() => {
                if (isTalkModeActiveRef.current) {
                  resetSilenceTimeout(); // Reset silence timeout when Jarvis finishes speaking
                  startActiveTalkListening();
                }
              }, 400);
            });

          } catch (err) {
            setIsLoading(false);
            isProcessingSpeechRef.current = false;
            setIsListening(false);
            clearSilenceTimeout();
            if (!isTalkModeActiveRef.current) return;
            
            speakText("I had a network issue. Let's try again.", () => {
              setTimeout(() => {
                if (isTalkModeActiveRef.current) {
                  resetSilenceTimeout();
                  startActiveTalkListening();
                }
              }, 400);
            });
          }
        }
      };

      rec.onend = () => {
        setIsListening(false);
        // If we haven't processed a result (and therefore we aren't about to speak), restart listening!
        if (!hasProcessedResult && isTalkModeActiveRef.current && !isProcessingSpeechRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isTalkModeActiveRef.current && !isProcessingSpeechRef.current && !isSpeakingRef.current) {
              startActiveTalkListening();
            }
          }, 300);
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Active talk recognition error:', e.error);
        }
        setIsListening(false);
        // If error occurred and we aren't processing/speaking, restart to continue listening
        if (!hasProcessedResult && isTalkModeActiveRef.current && !isProcessingSpeechRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isTalkModeActiveRef.current && !isProcessingSpeechRef.current && !isSpeakingRef.current) {
              startActiveTalkListening();
            }
          }, 1000);
        }
      };

      rec.start();
      activeTalkRecognitionRef.current = rec;
    } catch (e) {
      console.warn('Failed to start active talk recognition:', e);
    }
  };

  useEffect(() => {
    if (isTalkModeActive) {
      setShowVoiceToast(true);
      const toastTimer = setTimeout(() => {
        setShowVoiceToast(false);
      }, 3000);

      resetSilenceTimeout();

      speakText("Hi, how can I help you?", () => {
        setTimeout(() => {
          if (isTalkModeActiveRef.current) {
            startActiveTalkListening();
          }
        }, 400);
      });

      return () => {
        clearTimeout(toastTimer);
      };
    } else {
      clearSilenceTimeout();
      if (activeTalkRecognitionRef.current) {
        try {
          activeTalkRecognitionRef.current.onend = null;
          activeTalkRecognitionRef.current.onerror = null;
          activeTalkRecognitionRef.current.stop();
        } catch (e) {}
        activeTalkRecognitionRef.current = null;
      }
      setIsListening(false);
      startWakeWordListener();
    }
  }, [isTalkModeActive]);

  // Background Speech Recognition for "Hey Jarvis" and Active User Command
  const startFreshUserCommandRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListeningRef.current) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Command SpeechRecognition start failed:', e);
    }
  };

  const startWakeWordListener = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowPulsingDot(false);
      return;
    }

    if (isSpeakingRef.current) {
      console.log('Jarvis TTS: startWakeWordListener blocked because speech is active');
      return;
    }

    if (backgroundRecognitionRef.current) {
      try {
        backgroundRecognitionRef.current.onend = null;
        backgroundRecognitionRef.current.onerror = null;
        backgroundRecognitionRef.current.stop();
      } catch (e) {}
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true; // Use continuous to avoid constant restarting
      rec.interimResults = true; // catch interim speech to trigger instantly!
      rec.lang = 'en-US';

      rec.onstart = () => {
        console.log('Jarvis: Wake word listener started');
        setIsBackgroundListening(true);
        setShowPulsingDot(true);
      };

      rec.onresult = (event: any) => {
        console.log('Jarvis: Wake word listener result');
        const resultsLen = event.results.length;
        for (let i = event.resultIndex; i < resultsLen; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          console.log('Jarvis: Wake word transcript:', transcript);
          // Match 'hey jarvis', 'jarvis', 'hi jarvis', 'ok jarvis', or 'okay jarvis'
          if (
            transcript.includes('hey jarvis') || 
            transcript.includes('hey, jarvis') ||
            transcript.includes('hi jarvis') || 
            transcript.includes('hi, jarvis') ||
            transcript.includes('ok jarvis') ||
            transcript.includes('okay jarvis') ||
            transcript.includes('jarvis')
          ) {
            console.log('Jarvis: Wake word detected!');
            // Wake word detected! Trigger Talk Mode instead of opening panel initially
            setIsTalkModeActive(true);
            
            // Clear wake word: stop current listener
            rec.onend = null;
            rec.onerror = null;
            try {
              rec.stop();
            } catch (err) {}
            setIsBackgroundListening(false);
            setShowPulsingDot(false);
            break;
          }
        }
      };

      rec.onend = () => {
        setIsBackgroundListening(false);
        // Auto-restart on end if not active listening and not talk mode
        if (!isListeningRef.current && !isTalkModeActiveRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (!isListeningRef.current && !isTalkModeActiveRef.current && !isSpeakingRef.current) {
              startWakeWordListener();
            }
          }, 300);
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Wake word SpeechRecognition error:', e.error);
        }
        setIsBackgroundListening(false);
        if (e.error === 'not-allowed') {
          setShowPulsingDot(false);
          return;
        }
        // Auto-restart on error
        if (!isListeningRef.current && !isTalkModeActiveRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (!isListeningRef.current && !isTalkModeActiveRef.current && !isSpeakingRef.current) {
              startWakeWordListener();
            }
          }, 1000);
        }
      };

      rec.start();
      backgroundRecognitionRef.current = rec;
    } catch (err) {
      console.warn('Failed to start wake word listener:', err);
    }
  };

  useEffect(() => {
    // Request permission on load
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          console.log('Microphone permission granted for Jarvis.');
          setMicPermissionGranted(true);
        })
        .catch(err => {
          console.warn('Microphone permission denied for Jarvis wake word.', err);
          setMicPermissionGranted(false);
          setShowPulsingDot(false);
        });
    } else {
      setMicPermissionGranted(false);
      setShowPulsingDot(false);
    }

    return () => {
      if (backgroundRecognitionRef.current) {
        try {
          backgroundRecognitionRef.current.onend = null;
          backgroundRecognitionRef.current.onerror = null;
          backgroundRecognitionRef.current.stop();
        } catch (e) {}
        backgroundRecognitionRef.current = null;
      }
    };
  }, []);

  // Unlock SpeechSynthesis on first user interaction (crucial for mobile/some desktop browsers)
  useEffect(() => {
    const handleGlobalClick = () => {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    if (micPermissionGranted === true && !isTalkModeActive && !isSpeaking) {
      if (!isBackgroundListening) {
        startWakeWordListener();
      }
    } else {
      if (backgroundRecognitionRef.current) {
        try {
          backgroundRecognitionRef.current.onend = null;
          backgroundRecognitionRef.current.onerror = null;
          backgroundRecognitionRef.current.stop();
        } catch (e) {}
        backgroundRecognitionRef.current = null;
        setIsBackgroundListening(false);
        setShowPulsingDot(false);
      }
    }
  }, [micPermissionGranted, isTalkModeActive, isSpeaking]);

  // Gather all existing attachments across tasks
  const existingAttachments: Array<{ attachment: Attachment; taskTitle: string; tab: string }> = [];
  Object.entries(tasks || {}).forEach(([tabKey, taskList]) => {
    ((taskList as TaskItem[]) || []).forEach(t => {
      if (t.attachments && t.attachments.length > 0) {
        t.attachments.forEach(att => {
          existingAttachments.push({ attachment: att, taskTitle: t.title, tab: tabKey });
        });
      }
    });
  });

  const triggerPushNotification = (summary: string) => {
    NotificationEngine.addToast({
      title: 'Jarvis ✨',
      message: summary,
      type: 'success'
    });

    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Jarvis ✨', { body: summary });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              new Notification('Jarvis ✨', { body: summary });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Browser push notification failed:', e);
    }
  };

  const handleSendMessage = async (textToSend?: string, isVoiceReply: boolean = false) => {
    const finalMsg = textToSend || inputText;
    if (!finalMsg.trim() && !mediaFile) return;

    const userMsgId = Date.now().toString();
    const currentMedia = mediaFile ? { ...mediaFile } : null;

    const newUserMsg: AIChatMessage & { mediaUrl?: string; mediaType?: 'image' | 'video'; attachmentName?: string } = {
      id: userMsgId,
      sender: 'user',
      text: finalMsg.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mediaUrl: currentMedia && (currentMedia.type === 'image' || currentMedia.type === 'video') ? currentMedia.dataUrl : undefined,
      mediaType: currentMedia && (currentMedia.type === 'image' || currentMedia.type === 'video') ? currentMedia.type : undefined,
      attachmentName: currentMedia && currentMedia.type === 'doc' ? currentMedia.name : undefined
    };

    setMessages(prev => [...prev, newUserMsg]);
    if (!textToSend) setInputText('');
    setMediaFile(null);
    setShowDocMenu(false);
    setIsLoading(true);

    try {
      // Gather all tasks flat list for AI context
      const allActiveTasks: any[] = [];
      Object.entries(tasks || {}).forEach(([tab, list]) => {
        ((list as TaskItem[]) || []).forEach(t => allActiveTasks.push({ ...t, tab }));
      });

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMsg.trim(),
          history: messages.map(m => ({ sender: m.sender, text: m.text })),
          allTasks: allActiveTasks,
          media: currentMedia && currentMedia.dataUrl ? {
            data: currentMedia.dataUrl,
            mimeType: currentMedia.mimeType
          } : undefined,
          documentContent: currentMedia && currentMedia.textContent ? currentMedia.textContent : undefined
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Jarvis: API request failed', res.status, errorText);
        throw new Error(`API request failed: ${res.status}`);
      }

      const data = await res.json();
      setIsLoading(false);

      const aiReplyText = data.reply || data.text || "I've processed your request.";
      const aiMsgId = (Date.now() + 1).toString();

      const newAiMsg: AIChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        proposals: data.proposals || [],
        conflictWarning: data.conflictWarning || undefined,
        places: data.places || []
      };

      setMessages(prev => [...prev, newAiMsg]);

      if (data.deleteTask && (data.deleteTask.taskId || data.deleteTask.taskTitle)) {
        console.log('Jarvis: Delete task intent detected:', data.deleteTask);
        let foundTab = null;
        let foundTaskId = data.deleteTask.taskId;
        
        for (const [tab, taskList] of Object.entries(tasks)) {
           let task = (taskList as any[]).find(t => t.id === foundTaskId);
           if (!task && data.deleteTask.taskTitle) {
               task = (taskList as any[]).find(t => t.title.toLowerCase() === data.deleteTask.taskTitle.toLowerCase());
               if (task) foundTaskId = task.id;
           }
           if (task) {
             foundTab = tab;
             break;
           }
        }
        console.log('Jarvis: Found tab and task ID for deletion:', foundTab, foundTaskId);
        if (foundTab && foundTaskId) {
          onDeleteTask(foundTab as any, foundTaskId);
        }
      }

      if (data.updateTask && (data.updateTask.taskId || data.updateTask.taskTitle) && data.updateTask.updates) {
        console.log('Jarvis: Update task intent detected:', data.updateTask);
        let foundTab = null;
        let foundTaskId = data.updateTask.taskId;
        
        for (const [tab, taskList] of Object.entries(tasks)) {
           let task = (taskList as any[]).find(t => t.id === foundTaskId);
           if (!task && data.updateTask.taskTitle) {
               task = (taskList as any[]).find(t => t.title.toLowerCase() === data.updateTask.taskTitle.toLowerCase());
               if (task) foundTaskId = task.id;
           }
           if (task) {
             foundTab = tab;
             break;
           }
        }
        console.log('Jarvis: Found tab and task ID for update:', foundTab, foundTaskId);
        if (foundTab && foundTaskId) {
          onUpdateTask(foundTab as any, foundTaskId, data.updateTask.updates);
        }
      }

      if (aiReplyText && aiReplyText.trim().length > 0) {
        speakText(aiReplyText);
      }

      if ((data.proposals && data.proposals.length > 0) || data.conflictWarning) {
        setIsOpen(true);
      }

      if (data.places && data.places.length > 0) {
        triggerPushNotification(`Found ${data.places.length} nearby places.`);
      }
    } catch (err) {
      setIsLoading(false);
      const errorText = "I encountered a network issue communicating with Gemini. Please try again.";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      if (errorText) {
        speakText(errorText);
      }
    }
  };

  const handleAcceptAllProposals = (proposals: AITaskProposal[], msgId: string) => {
    onAcceptTasks(proposals);
    setAcceptedPropMsgIds(prev => ({ ...prev, [msgId]: true }));
    triggerPushNotification(`Autonomously created ${proposals.length} tasks in your schedule.`);
  };

  const handleGetSuggestion = (conflict: { conflictingTask: string; newProposal: string; suggestionText?: string }) => {
    handleSendMessage(`Get suggestion for resolving scheduling conflict between "${conflict.conflictingTask}" and "${conflict.newProposal}".`);
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) return;
    if (isSpeakingRef.current) {
      console.log('Jarvis TTS: startVoiceInput blocked because speech is active');
      return;
    }

    if (backgroundRecognitionRef.current) {
      try {
        backgroundRecognitionRef.current.onend = null;
        backgroundRecognitionRef.current.onerror = null;
        backgroundRecognitionRef.current.stop();
      } catch (e) {}
      backgroundRecognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      handleSendMessage(transcript, true);
    };

    recognition.start();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'doc') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (type === 'doc' && file.type.includes('text')) {
      reader.onload = (evt) => {
        setMediaFile({
          name: file.name,
          dataUrl: '',
          type: 'doc',
          mimeType: file.type,
          textContent: evt.target?.result as string
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        setMediaFile({
          name: file.name,
          dataUrl: evt.target?.result as string,
          type: type,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/* Onboarding Voice Toast */}
      <AnimatePresence>
        {showVoiceToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-28 right-8 z-[99999] p-4 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-md flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-w-sm"
          >
            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-50">Talking Mode active</span>
              <span className="text-[10px] text-slate-400">Say "Jarvis stop" to end</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. FLOATING BUTTON (Glowing Rotating Conic Border Orb) */}
      {!isOpen && (
        <motion.button
          id="ai-assistant-orb-btn"
          onClick={() => {
            if (isTalkModeActive) {
              setIsTalkModeActive(false);
              stopSpeaking();
            } else {
              setIsOpen(prev => !prev);
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-8 right-8 z-[9999] w-16 h-16 rounded-full flex items-center justify-center cursor-pointer group select-none focus:outline-none"
        >
          {/* Radiating pulsating light rings when Talk Mode is active */}
          {isTalkModeActive && (
            <div className="absolute inset-[-14px] rounded-full bg-gradient-to-tr from-indigo-500 via-cyan-400 to-purple-500 opacity-60 blur-md animate-ping" />
          )}
          {isTalkModeActive && (
            <div className="absolute inset-[-8px] rounded-full bg-gradient-to-tr from-indigo-500 via-cyan-400 to-purple-500 opacity-40 blur-sm animate-[pulse_1.5s_infinite_ease-in-out]" />
          )}

          {/* Outer Rotating Conic-Gradient Border */}
          <div 
            className="absolute inset-0 rounded-full bg-[conic-gradient(#6366F1,#22D3EE,#A855F7,#6366F1)] animate-[spin_4s_linear_infinite]"
          />
          
          {/* Inner Button Circle: 4px thick border means absolute inset-[4px] */}
          <div className="absolute inset-[4px] rounded-full inner-circle flex items-center justify-center transition-colors duration-300">
            {/* Sparkle star SVG icon */}
            <svg className="w-8 h-8 sparkle-star" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <path 
                d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" 
              />
            </svg>
          </div>

          {/* Tooltip on hover saying 'Jarvis — here to help' or 'Talk Mode Active' */}
          <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-slate-950 text-white text-xs font-semibold py-1.5 px-3 rounded-full whitespace-nowrap shadow-xl border border-slate-800">
            {isTalkModeActive ? 'Talk Mode Active' : 'Jarvis — here to help'}
          </div>

          {/* The green pulsing dot for wake word active status sits at top-right of the orb at 12px size */}
          {showPulsingDot && !isTalkModeActive && (
            <span 
              className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border border-slate-900 rounded-full shadow-[0_0_10px_#10B981] animate-pulse z-10" 
              title="Wake word active ('Hey Jarvis')"
            />
          )}
        </motion.button>
      )}

      {/* 2. ASSISTANT PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="ai-assistant-side-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-[400px] max-w-[100vw] z-50 bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl text-slate-100"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col gap-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="font-bold text-base tracking-tight text-slate-50">Jarvis ✨</h2>
                    <span className="text-[10px] text-slate-400 font-medium">here to help</span>
                  </div>
                </div>

                {/* Right side: close button & stop speaking if speaking */}
                <div className="flex items-center gap-2">
                  {isSpeaking && (
                    <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 rounded-xl shrink-0">
                      {/* Animated Sound Wave (5 bars rising and falling) */}
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-indigo-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.1s' }} />
                        <span className="w-0.5 bg-indigo-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.3s' }} />
                        <span className="w-0.5 bg-indigo-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
                        <span className="w-0.5 bg-indigo-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
                        <span className="w-0.5 bg-indigo-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }} />
                      </div>
                      <button
                        onClick={stopSpeaking}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                        title="Stop speaking"
                      >
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-xs" /> Stop
                      </button>
                    </div>
                  )}

                  <button
                    id="close-ai-panel-btn"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Removed Interaction Mode Toggle */}

              {/* Hands-free Talk Mode Banner/Toggle */}
              <button
                onClick={() => {
                  if (isTalkModeActive) {
                    setIsTalkModeActive(false);
                    stopSpeaking();
                  } else {
                    setIsTalkModeActive(true);
                  }
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  isTalkModeActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {isTalkModeActive && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isTalkModeActive ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                    </span>
                    <span>Continuous Hands-Free Dialogue</span>
                  </div>
                  <span className="text-[10px] text-slate-500 text-left pl-4 font-normal normal-case">
                    Jarvis listens, replies, and keeps listening automatically.
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase shrink-0">{isTalkModeActive ? 'Active' : 'Off'}</span>
              </button>
            </div>

            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900/40">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-2xl p-3.5 max-w-[88%] text-sm leading-relaxed shadow-md ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs ml-auto'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {/* User Media / Attachment Preview in Chat Bubble */}
                    {msg.sender === 'user' && (
                      <div className="space-y-2">
                        {msg.mediaUrl && msg.mediaType === 'image' && (
                          <img src={msg.mediaUrl} alt="Sent Image" className="max-h-44 rounded-xl border border-indigo-400/30 object-cover w-full" />
                        )}
                        {msg.mediaUrl && msg.mediaType === 'video' && (
                          <video src={msg.mediaUrl} controls className="max-h-44 rounded-xl border border-indigo-400/30 w-full" />
                        )}
                        {msg.attachmentName && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-700/90 rounded-lg text-xs font-mono mb-1">
                            <Paperclip className="w-3 h-3 text-indigo-200" /> {msg.attachmentName}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span className={`text-[10px] block mt-1 opacity-60 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* 7. CONFLICT WARNING CARD */}
                  {msg.conflictWarning && (
                    <div className="mt-2.5 p-3.5 bg-amber-950/50 border border-amber-500/40 rounded-2xl w-[92%] space-y-2.5 text-xs shadow-lg">
                      <div className="flex items-center gap-2 text-amber-300 font-bold tracking-wider uppercase text-[11px]">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        Scheduling Conflict Detected
                      </div>
                      <div className="space-y-1.5 text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-amber-500/10">
                        <p><span className="text-slate-400 font-semibold">Existing:</span> {msg.conflictWarning.conflictingTask}</p>
                        <p><span className="text-amber-200 font-semibold">New:</span> {msg.conflictWarning.newProposal}</p>
                      </div>
                      {msg.conflictWarning.suggestionText && (
                        <div className="p-2.5 bg-slate-900 rounded-xl text-indigo-300 border border-indigo-500/20 italic">
                          💡 {msg.conflictWarning.suggestionText}
                        </div>
                      )}
                      <button
                        onClick={() => handleGetSuggestion(msg.conflictWarning!)}
                        className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Lightbulb className="w-4 h-4" />
                        Get Suggestion
                      </button>
                    </div>
                  )}

                  {/* 6. AGENTIC TASK CREATION PROPOSALS CARD */}
                  {msg.proposals && msg.proposals.length > 0 && !acceptedPropMsgIds[msg.id] && !rejectedPropMsgIds[msg.id] && (
                    <div className="mt-2.5 p-3.5 bg-indigo-950/30 border border-indigo-500/40 rounded-2xl w-[92%] space-y-3 text-xs shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          Suggested Action Plan ({msg.proposals.length})
                        </span>
                      </div>
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {msg.proposals.map((prop, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-100 text-xs">{prop.title}</p>
                              {prop.deadline && (
                                <p className="text-[10px] text-indigo-300/80 mt-1 font-mono">
                                  ⏰ {new Date(prop.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({prop.estimatedMinutes}m)
                                </p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 bg-indigo-900/60 text-indigo-200 border border-indigo-500/30 rounded-md text-[9px] font-mono uppercase tracking-wider shrink-0">
                              {prop.tab}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleAcceptAllProposals(msg.proposals!, msg.id)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)] cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Accept All
                        </button>
                        <button
                          onClick={() => setRejectedPropMsgIds(prev => ({ ...prev, [msg.id]: true }))}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {acceptedPropMsgIds[msg.id] && (
                    <div className="mt-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-400" /> Tasks created autonomously in schedule.
                    </div>
                  )}

                  {rejectedPropMsgIds[msg.id] && (
                    <div className="mt-2 text-xs font-semibold text-rose-400 flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 rounded-xl">
                      <X className="w-4 h-4 text-rose-400" /> Suggestions rejected.
                    </div>
                  )}

                  {/* 9. GOOGLE MAPS PLACES CARDS */}
                  {msg.places && msg.places.length > 0 && (
                    <div className="mt-3 w-[92%] space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        Nearby Locations Found
                      </div>
                      <div className="space-y-2">
                        {msg.places.slice(0, 3).map((place, pIdx) => (
                          <a
                            key={pIdx}
                            href={place.url || `https://maps.google.com/?q=${encodeURIComponent(`${place.name} ${place.address}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all hover:bg-slate-800/80 group shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-xs text-slate-100 group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                                {place.name}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                              </p>
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold shrink-0">
                                <Star className="w-3 h-3 fill-amber-400" />
                                {place.rating || 4.5}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{place.address}</p>
                            {place.distance && (
                              <span className="text-[10px] text-slate-500 font-mono mt-1 block">📍 {place.distance} away</span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* 4. AI THINKING STATES (Animated Cycling Text) */}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-xs p-3.5 shadow-md max-w-[85%]">
                    <ThinkingIndicator />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'image')}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'video')}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'doc')}
            />

            {/* Selected Media Chip */}
            {mediaFile && (
              <div className="px-4 pt-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 rounded-lg max-w-[85%] truncate">
                  {mediaFile.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  {mediaFile.type === 'video' && <VideoIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  {mediaFile.type === 'doc' && <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  <span className="truncate">{mediaFile.name}</span>
                </div>
                <button
                  onClick={() => setMediaFile(null)}
                  className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Document / Attachment Select Menu Popover */}
            <AnimatePresence>
              {showDocMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mx-4 mb-2 p-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-56 overflow-y-auto space-y-2 text-xs"
                >
                  <div className="font-bold text-slate-400 text-[11px] uppercase tracking-wider px-1">
                    Select Document / Attachment
                  </div>
                  <button
                    onClick={() => { setShowDocMenu(false); docInputRef.current?.click(); }}
                    className="w-full p-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl flex items-center gap-2 font-semibold transition-colors cursor-pointer text-left"
                  >
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    📤 Upload local file (PDF, DOC, TXT)
                  </button>

                  {existingAttachments.length > 0 && (
                    <div className="pt-2 space-y-1 border-t border-slate-800">
                      <p className="text-[10px] text-slate-500 px-1 font-mono">FROM EXISTING TASKS ({existingAttachments.length}):</p>
                      {existingAttachments.map((item, aIdx) => (
                        <button
                          key={aIdx}
                          onClick={() => {
                            setMediaFile({
                              name: item.attachment.name,
                              dataUrl: item.attachment.url || '',
                              type: 'doc',
                              mimeType: item.attachment.type || 'text/plain',
                              textContent: item.attachment.content
                            });
                            setShowDocMenu(false);
                          }}
                          className="w-full p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer gap-2"
                        >
                          <span className="truncate text-slate-200 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {item.attachment.name}
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 shrink-0">
                            {item.tab}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. MULTIMODAL INPUT BAR */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                  className="flex-1 bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || (!inputText.trim() && !mediaFile)}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shadow-md disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Multimodal Action Buttons */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  {/* Microphone (Web Speech API) */}
                  <button
                    onClick={startVoiceInput}
                    className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                      isListening
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-soft-pulse'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    }`}
                    title="Voice Input (SpeechRecognition)"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isListening && <span className="text-[10px]">Listening...</span>}
                  </button>

                  {/* Image Upload */}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Upload Image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  {/* Video Upload */}
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Upload Video"
                  >
                    <VideoIcon className="w-4 h-4" />
                  </button>

                  {/* Document Upload (Local + Existing Attachments) */}
                  <button
                    onClick={() => setShowDocMenu(prev => !prev)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      showDocMenu ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    }`}
                    title="Upload Document / Select Attachment"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-[10px] font-mono text-slate-500">Gemini 2.5 Flash</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function ThinkingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % THINKING_STATES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex gap-1">
        <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 rounded-full bg-indigo-400" />
        <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 rounded-full bg-indigo-400" />
        <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 rounded-full bg-indigo-400" />
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.25 }}
          className="text-xs font-mono text-indigo-300 italic"
        >
          {THINKING_STATES[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
