import { useState, useEffect, useRef, useCallback } from "react";
import { Message, Contact, ChatHistory, OnlineStatusMap, UserProfile } from "./types";
import WelcomeScreen from "./components/WelcomeScreen";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import AdminPanel from "./components/AdminPanel";
import { normalizeUsername, playMessageSound, playNudgeSound } from "./utils";

export default function App() {
  // Authentication & Profile State
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; username: string; isAdmin: boolean } | null>(() => {
    const saved = localStorage.getItem("lan_chat_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [username, setUsername] = useState<string | null>(() => {
    return localStorage.getItem("lan_chat_username");
  });
  const [isRegistered, setIsRegistered] = useState(() => {
    return !!localStorage.getItem("lan_chat_username");
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuthSuccess = (user: { id: string; email: string; username: string; isAdmin: boolean }) => {
    setCurrentUser(user);
    setUsername(user.username);
    setIsRegistered(true);
    localStorage.setItem("lan_chat_user", JSON.stringify(user));
    localStorage.setItem("lan_chat_username", user.username);
  };

  // Contacts & History State
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem("lan_chat_contacts");
    return saved ? JSON.parse(saved) : [];
  });
  const [chatHistory, setChatHistory] = useState<ChatHistory>(() => {
    const saved = localStorage.getItem("lan_chat_history");
    return saved ? JSON.parse(saved) : {};
  });
  const [unreadCounts, setUnreadCounts] = useState<{ [username: string]: number }>(() => {
    const saved = localStorage.getItem("lan_chat_unreads");
    return saved ? JSON.parse(saved) : {};
  });

  // Active Chat State
  const [activeContact, setActiveContact] = useState<string | null>(null);
  
  // Real-time network states
  const [onlineStatuses, setOnlineStatuses] = useState<OnlineStatusMap>({});
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Cached User Profiles (including avatar, machineName, ip)
  const [userProfiles, setUserProfiles] = useState<{ [username: string]: UserProfile }>(() => {
    const saved = localStorage.getItem("lan_chat_profiles");
    return saved ? JSON.parse(saved) : {};
  });

  // Device-level metadata auto-detection
  const getDeviceName = () => {
    const ua = navigator.userAgent;
    let os = "Dispositivo LAN";
    if (ua.indexOf("Win") !== -1) os = "Windows PC";
    else if (ua.indexOf("Mac") !== -1) os = "Macbook/Mac";
    else if (ua.indexOf("Linux") !== -1) os = "Linux Machine";
    else if (ua.indexOf("Android") !== -1) os = "Android Device";
    else if (ua.indexOf("like Mac") !== -1) os = "iOS Device";

    let browser = "Navegador";
    if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
    else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
    else if (ua.indexOf("Safari") !== -1) browser = "Safari";
    else if (ua.indexOf("Edge") !== -1) browser = "Edge";

    return `${os} (${browser})`;
  };

  // Profile overrides
  const [myProfileImage, setMyProfileImage] = useState<string | undefined>(() => {
    return localStorage.getItem("lan_chat_my_profile_image") || undefined;
  });
  const [myMachineName, setMyMachineName] = useState<string>(() => {
    return localStorage.getItem("lan_chat_my_machine_name") || getDeviceName();
  });
  const [myCustomIp, setMyCustomIp] = useState<string>(() => {
    return localStorage.getItem("lan_chat_my_custom_ip") || "";
  });
  const [detectedIp, setDetectedIp] = useState<string>("127.0.0.1");

  // Nudge Shake vibration status
  const [isShaking, setIsShaking] = useState(false);

  // System-wide notification toasts
  interface ToastNotification {
    id: string;
    sender: string;
    text: string;
    avatar?: string;
  }
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback((sender: string, text: string, avatar?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, sender, text, avatar }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize Contacts to LocalStorage
  useEffect(() => {
    localStorage.setItem("lan_chat_contacts", JSON.stringify(contacts));
  }, [contacts]);

  // Synchronize History to LocalStorage
  useEffect(() => {
    localStorage.setItem("lan_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Synchronize Unread Counts to LocalStorage
  useEffect(() => {
    localStorage.setItem("lan_chat_unreads", JSON.stringify(unreadCounts));
  }, [unreadCounts]);

  // Synchronize Cached Profiles
  useEffect(() => {
    localStorage.setItem("lan_chat_profiles", JSON.stringify(userProfiles));
  }, [userProfiles]);

  // Clean unread counts when active contact changes
  useEffect(() => {
    if (activeContact && unreadCounts[activeContact] > 0) {
      setUnreadCounts((prev) => {
        const next = { ...prev };
        next[activeContact] = 0;
        return next;
      });
    }
  }, [activeContact, unreadCounts]);

  // WebSocket Heartbeat to prevent inactive timeouts
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000); // Send ping every 20 seconds
  }, []);

  // Connect to LAN WebSocket Server
  const connectWebSocket = useCallback((targetUsername: string) => {
    if (!targetUsername) return;
    setIsLoading(true);
    setErrorMsg(null);

    // Close any previous socket cleanly
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Determine protocol and host dynamically for LAN support
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsSocketConnected(true);
      setErrorMsg(null);
      
      // Register current username and profile details with LAN server
      socket.send(
        JSON.stringify({
          type: "register",
          username: targetUsername,
          profileImage: myProfileImage,
          machineName: myMachineName,
          ip: myCustomIp || undefined
        })
      );
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "register_response": {
            setIsLoading(false);
            if (message.success) {
              setIsRegistered(true);
              setUsername(message.username);
              localStorage.setItem("lan_chat_username", message.username);
              if (message.detectedIp) {
                setDetectedIp(message.detectedIp);
              }
            } else {
              setErrorMsg(message.error);
              setIsRegistered(false);
              setUsername(null);
              localStorage.removeItem("lan_chat_username");
              socket.close();
            }
            break;
          }

          case "online_users": {
            const activeUsersList: { username: string, profileImage?: string, machineName?: string, ip?: string }[] = message.users || [];
            const newStatuses: OnlineStatusMap = {};
            const newProfiles: { [username: string]: UserProfile } = { ...userProfiles };
            
            activeUsersList.forEach((user) => {
              if (user.username !== targetUsername) {
                newStatuses[user.username] = true;
                newProfiles[user.username] = {
                  username: user.username,
                  profileImage: user.profileImage,
                  machineName: user.machineName,
                  ip: user.ip
                };
              }
            });
            setOnlineStatuses(newStatuses);
            setUserProfiles(newProfiles);
            break;
          }

          case "message": {
            const msg: Message = message.data;
            const chatPartner = msg.sender === targetUsername ? msg.recipient : msg.sender;
            const isGroupMessage = msg.recipient.startsWith("#");
            const storageKey = isGroupMessage ? msg.recipient : chatPartner;

            // Auto-add contact/group if messaging us and not yet added (UX friendly)
            setContacts((prev) => {
              const exists = prev.some((c) => c.username === storageKey);
              if (!exists) {
                return [...prev, { username: storageKey, addedAt: Date.now() }];
              }
              return prev;
            });

            // Save in history
            setChatHistory((prev) => {
              const currentHistory = prev[storageKey] || [];
              // Prevent duplicates
              if (currentHistory.some((m) => m.id === msg.id)) {
                return prev;
              }
              return {
                ...prev,
                [storageKey]: [...currentHistory, msg],
              };
            });

            // Notification / alerts
            if (msg.sender !== targetUsername) {
              if (msg.isNudge) {
                playNudgeSound();
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 800);
                
                // Nudge toast alert
                showToast(msg.sender, "⚠️ Chamou sua atenção!", userProfiles[msg.sender]?.profileImage);
              } else {
                playMessageSound();
                if (storageKey !== activeContact) {
                  showToast(msg.sender, isGroupMessage ? `[${msg.recipient}] ${msg.text}` : msg.text, userProfiles[msg.sender]?.profileImage);
                }
              }
            }

            // Increment unread count if we are not currently viewing their chat
            if (storageKey !== activeContact) {
              setUnreadCounts((prev) => {
                const count = prev[storageKey] || 0;
                return {
                  ...prev,
                  [storageKey]: count + 1,
                };
              });
            }
            break;
          }

          case "pending_messages": {
            const pendingMsgs: Message[] = message.messages || [];
            if (pendingMsgs.length === 0) return;

            setChatHistory((prev) => {
              const nextHistory = { ...prev };
              
              pendingMsgs.forEach((msg) => {
                const chatPartner = msg.sender === targetUsername ? msg.recipient : msg.sender;
                const isGroupMessage = msg.recipient.startsWith("#");
                const storageKey = isGroupMessage ? msg.recipient : chatPartner;

                // Add contact
                setContacts((prevContacts) => {
                  const exists = prevContacts.some((c) => c.username === storageKey);
                  if (!exists) {
                    return [...prevContacts, { username: storageKey, addedAt: Date.now() }];
                  }
                  return prevContacts;
                });

                const historyList = nextHistory[storageKey] || [];
                // Check duplicate
                if (!historyList.some((m) => m.id === msg.id)) {
                  nextHistory[storageKey] = [...historyList, msg];
                  
                  // Unread increment if not active
                  if (storageKey !== activeContact) {
                    setUnreadCounts((prevUnreads) => {
                      const count = prevUnreads[storageKey] || 0;
                      return {
                        ...prevUnreads,
                        [storageKey]: count + 1,
                      };
                    });
                  }
                }
              });

              return nextHistory;
            });
            break;
          }

          case "message_status": {
            break;
          }
        }
      } catch (err) {
        console.error("Erro ao analisar mensagem de rede:", err);
      }
    };

    socket.onclose = (event) => {
      setIsSocketConnected(false);
      setIsLoading(false);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      // Attempt reconnection if user is still logged in
      if (targetUsername && !event.wasClean) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(targetUsername);
        }, 5000); // Retry connecting in 5 seconds
      }
    };

    socket.onerror = () => {
      setIsSocketConnected(false);
      setIsLoading(false);
    };
  }, [activeContact, startHeartbeat, userProfiles, showToast, myProfileImage, myMachineName, myCustomIp, detectedIp]);

  // Handle join action from Welcome Screen
  const handleJoin = (selectedUsername: string) => {
    connectWebSocket(selectedUsername);
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setUsername(null);
    setIsRegistered(false);
    setIsSocketConnected(false);
    localStorage.removeItem("lan_chat_user");
    localStorage.removeItem("lan_chat_username");

    if (socketRef.current) {
      socketRef.current.close();
    }
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    setActiveContact(null);
  };

  // Connect automatically if already logged in previously
  useEffect(() => {
    if (username) {
      connectWebSocket(username);
    }
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [username, connectWebSocket]);

  // Add Contact
  const handleAddContact = (contactUsername: string): string | null => {
    const normalized = normalizeUsername(contactUsername);
    if (contacts.some((c) => c.username === normalized)) {
      return "Contato ou grupo já adicionado.";
    }

    setContacts((prev) => [
      ...prev,
      { username: normalized, addedAt: Date.now() },
    ]);
    return null;
  };

  // Remove Contact
  const handleRemoveContact = (contactUsername: string) => {
    setContacts((prev) => prev.filter((c) => c.username !== contactUsername));
    if (activeContact === contactUsername) {
      setActiveContact(null);
    }
  };

  // Clear Local Chat History for a contact
  const handleClearHistory = (contactUsername: string) => {
    setChatHistory((prev) => {
      const next = { ...prev };
      delete next[contactUsername];
      return next;
    });
  };

  // Profile details update handler
  const handleUpdateProfile = (profileImage?: string, machineName?: string, customIp?: string) => {
    let updatedImg = myProfileImage;
    let updatedMachine = myMachineName;
    let updatedIp = myCustomIp;

    if (profileImage !== undefined) {
      setMyProfileImage(profileImage);
      updatedImg = profileImage;
      if (profileImage) localStorage.setItem("lan_chat_my_profile_image", profileImage);
      else localStorage.removeItem("lan_chat_my_profile_image");
    }
    if (machineName !== undefined) {
      setMyMachineName(machineName);
      updatedMachine = machineName;
      localStorage.setItem("lan_chat_my_machine_name", machineName);
    }
    if (customIp !== undefined) {
      setMyCustomIp(customIp);
      updatedIp = customIp;
      localStorage.setItem("lan_chat_my_custom_ip", customIp);
    }

    // Send update to server if socket is open
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "update_profile",
          profileImage: updatedImg,
          machineName: updatedMachine,
          ip: updatedIp || detectedIp
        })
      );
    }
  };

  // Send Message (Text / File / Nudge)
  const handleSendMessage = async (
    text: string, 
    fileData?: { filename: string; type: string; base64: string; size: number },
    isNudge?: boolean
  ) => {
    if (!username || !activeContact) return;

    let fileId: string | undefined;
    let fileName: string | undefined;
    let fileType: string | undefined;
    let fileSize: number | undefined;

    // 1. If file data exists, upload it to the local Express server first
    if (fileData) {
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: fileData.filename,
            type: fileData.type,
            data: fileData.base64,
            size: fileData.size,
          }),
        });

        if (!response.ok) {
          throw new Error("Erro ao fazer upload da mídia para o servidor local.");
        }

        const resJson = await response.json();
        fileId = resJson.fileId;
        fileName = fileData.filename;
        fileType = fileData.type;
        fileSize = fileData.size;
      } catch (err: any) {
        console.error(err);
        throw err;
      }
    }

    // 2. Build local message payload
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newMsg: Message = {
      id: msgId,
      sender: username,
      recipient: activeContact,
      text: isNudge ? "⚠️ chamou sua atenção!" : (fileData ? `📎 Enviou um arquivo: ${fileData.filename}` : text),
      fileId,
      fileName,
      fileType,
      fileSize,
      isNudge,
      timestamp: Date.now(),
    };

    // 3. Save message in local history immediately
    setChatHistory((prev) => {
      const currentHistory = prev[activeContact] || [];
      return {
        ...prev,
        [activeContact]: [...currentHistory, newMsg],
      };
    });

    // If nudge, vibrate / shake local client too!
    if (isNudge) {
      playNudgeSound();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 800);
    }

    // 4. Send over WebSocket to recipient
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "direct_message",
          id: msgId,
          recipient: activeContact,
          text: newMsg.text,
          fileId,
          fileName,
          fileType,
          fileSize,
          isNudge,
          timestamp: newMsg.timestamp,
        })
      );
    }
  };

  // If user is not logged in / registered successfully, show welcome screen
  if (!username || !isRegistered) {
    return (
      <WelcomeScreen
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  const activeMessages = activeContact ? chatHistory[activeContact] || [] : [];
  const isContactOnline = activeContact ? (activeContact.startsWith("#") ? true : !!onlineStatuses[activeContact]) : false;

  return (
    <div className={`flex h-screen bg-[#0A0A0B] overflow-hidden font-sans relative ${isShaking ? "animate-shake" : ""}`}>
      
      {/* Toast Notifications container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none font-sans">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className="pointer-events-auto bg-[#0D0D0E]/95 border border-orange-500/30 text-white rounded-xl shadow-2xl p-3.5 flex items-start gap-3 animate-fade-in transition-all duration-300 hover:border-orange-500/50 cursor-pointer"
            onClick={() => {
              setActiveContact(toast.sender);
              setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }}
          >
            {/* Sender image */}
            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden bg-black/40">
              {toast.avatar ? (
                <img src={toast.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                toast.sender[1]?.toUpperCase() || toast.sender[0]?.toUpperCase() || "U"
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold font-mono text-orange-400">{toast.sender}</p>
              <p className="text-xs text-white/70 mt-0.5 truncate">{toast.text}</p>
              <p className="text-[10px] text-white/30 mt-1">Clique para responder</p>
            </div>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
              className="text-white/30 hover:text-white text-xs shrink-0 font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="w-full max-w-7xl mx-auto flex h-full bg-[#0D0D0E] md:shadow-2xl md:my-0 border-x border-white/5 overflow-hidden">
        
        {/* Sidebar - Hidden on mobile if a chat is active */}
        <div className={`w-full md:w-auto h-full shrink-0 ${activeContact ? "hidden md:block" : "block"}`}>
          <Sidebar
            currentUsername={username}
            contacts={contacts}
            onlineStatuses={onlineStatuses}
            chatHistory={chatHistory}
            activeContact={activeContact}
            onSelectContact={setActiveContact}
            onAddContact={handleAddContact}
            onRemoveContact={handleRemoveContact}
            onLogout={handleLogout}
            isSocketConnected={isSocketConnected}
            unreadCounts={unreadCounts}
            currentUserIsAdmin={currentUser?.isAdmin}
            
            // Custom Profiles states
            myProfileImage={myProfileImage}
            myMachineName={myMachineName}
            myCustomIp={myCustomIp}
            detectedIp={detectedIp}
            onUpdateProfile={handleUpdateProfile}
            userProfiles={userProfiles}
          />
        </div>

        {/* Chat Area - Hidden on mobile if no active contact selected */}
        <div className={`flex-1 h-full flex flex-col ${!activeContact ? "hidden md:flex" : "flex"}`}>
          {activeContact === "system_admin_panel" ? (
            <AdminPanel 
              currentUser={currentUser}
              onBack={() => setActiveContact(null)}
            />
          ) : (
            <ChatArea
              currentUsername={username}
              activeContact={activeContact}
              messages={activeMessages}
              isContactOnline={isContactOnline}
              onSendMessage={handleSendMessage}
              onClearHistory={handleClearHistory}
              onBack={() => setActiveContact(null)} // Mobile view back button trigger
              userProfiles={userProfiles}
            />
          )}
        </div>

      </div>
    </div>
  );
}
