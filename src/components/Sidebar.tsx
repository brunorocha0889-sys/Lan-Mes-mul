import React, { useState, useMemo, useRef } from "react";
import { UserPlus, Search, Trash2, LogOut, Copy, Check, Wifi, WifiOff, MessageCircle, User, Users, Settings2, Laptop, Globe, X, Info, Shield } from "lucide-react";
import { Contact, OnlineStatusMap, ChatHistory, UserProfile } from "../types";
import { normalizeUsername } from "../utils";

interface SidebarProps {
  currentUsername: string;
  contacts: Contact[];
  onlineStatuses: OnlineStatusMap;
  chatHistory: ChatHistory;
  activeContact: string | null;
  onSelectContact: (username: string) => void;
  onAddContact: (username: string) => string | null; // Returns error string or null
  onRemoveContact: (username: string) => void;
  onLogout: () => void;
  isSocketConnected: boolean;
  unreadCounts: { [username: string]: number };
  
  // Profile settings
  myProfileImage?: string;
  myMachineName: string;
  myCustomIp: string;
  detectedIp: string;
  onUpdateProfile: (profileImage?: string, machineName?: string, customIp?: string) => void;
  userProfiles: { [username: string]: UserProfile };
  currentUserIsAdmin?: boolean;
}

export default function Sidebar({
  currentUsername,
  contacts,
  onlineStatuses,
  chatHistory,
  activeContact,
  onSelectContact,
  onAddContact,
  onRemoveContact,
  onLogout,
  isSocketConnected,
  unreadCounts,
  myProfileImage,
  myMachineName,
  myCustomIp,
  detectedIp,
  onUpdateProfile,
  userProfiles,
  currentUserIsAdmin,
}: SidebarProps) {
  const [newContactInput, setNewContactInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form states for profile edit modal
  const [editMachineName, setEditMachineName] = useState(myMachineName);
  const [editCustomIp, setEditCustomIp] = useState(myCustomIp);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy current user's @username
  const handleCopyUsername = () => {
    navigator.clipboard.writeText(currentUsername);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add Contact submission
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);

    const target = normalizeUsername(newContactInput);
    if (!target || target === "@" || target === "#") {
      setAddError("Digite um usuário ou #grupo válido.");
      return;
    }

    if (target === currentUsername) {
      setAddError("Você não pode adicionar a si mesmo.");
      return;
    }

    const err = onAddContact(target);
    if (err) {
      setAddError(err);
    } else {
      setNewContactInput("");
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
    }
  };

  // Avatar Image upload and canvas compression
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        onUpdateProfile(compressedBase64, undefined, undefined);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    onUpdateProfile("", undefined, undefined);
  };

  const handleSaveProfileSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(undefined, editMachineName.trim() || undefined, editCustomIp.trim());
    setShowProfileModal(false);
  };

  // Get last message info for each contact
  const contactsWithLastMessage = useMemo(() => {
    return contacts.map((contact) => {
      const history = chatHistory[contact.username] || [];
      const lastMsg = history[history.length - 1];
      const isGroup = contact.username.startsWith("#");
      const isOnline = isGroup ? true : !!onlineStatuses[contact.username];
      const unreadCount = unreadCounts[contact.username] || 0;

      return {
        ...contact,
        isOnline,
        isGroup,
        unreadCount,
        lastMessage: lastMsg ? (lastMsg.text ? lastMsg.text : lastMsg.fileId ? "📎 Arquivo compartilhado" : "") : null,
        lastTimestamp: lastMsg ? lastMsg.timestamp : null,
      };
    }).sort((a, b) => {
      // Sort by last message timestamp (most recent first), then online status, then name
      if (a.lastTimestamp && b.lastTimestamp) {
        return b.lastTimestamp - a.lastTimestamp;
      }
      if (a.lastTimestamp) return -1;
      if (b.lastTimestamp) return 1;
      
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      return a.username.localeCompare(b.username);
    });
  }, [contacts, chatHistory, onlineStatuses, unreadCounts]);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contactsWithLastMessage;
    return contactsWithLastMessage.filter((c) => c.username.toLowerCase().includes(query));
  }, [contactsWithLastMessage, searchQuery]);

  return (
    <div className="w-full md:w-80 border-r border-white/5 bg-[#0D0D0E] text-gray-300 flex flex-col h-full shrink-0 font-sans relative">
      
      {/* App Header & Current Profile */}
      <div className="p-4 border-b border-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm">
              CL
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">Chat Local LAN</span>
          </div>
          
          {/* Connection Status indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 border border-white/5">
            {isSocketConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span className="text-[10px] font-medium text-orange-400 uppercase tracking-wider font-mono">LAN</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider font-mono">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141416]/50 border border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full border border-orange-500/30 flex items-center justify-center shrink-0 overflow-hidden bg-[#101011]">
              {myProfileImage ? (
                <img src={myProfileImage} alt="Meu Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-4 h-4 text-orange-500/80" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Seu usuário</p>
              <p className="text-xs font-mono font-semibold text-white truncate" title={currentUsername}>
                {currentUsername}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setEditMachineName(myMachineName);
                setEditCustomIp(myCustomIp);
                setShowProfileModal(true);
              }}
              title="Configurar seu perfil (Foto, Máquina, IP)"
              className="p-1.5 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopyUsername}
              title="Copiar seu nome de usuário"
              className="p-1.5 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-orange-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onLogout}
              title="Sair"
              className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {currentUserIsAdmin && (
          <button
            onClick={() => onSelectContact("system_admin_panel")}
            className={`w-full py-1.5 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeContact === "system_admin_panel"
                ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                : "bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/10 text-orange-400"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            Painel do Administrador
          </button>
        )}
      </div>

      {/* Add Contact Panel */}
      <div className="p-4 border-b border-white/5 bg-black/20">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-orange-500" /> Adicionar Contato ou Grupo
        </h3>
        <form onSubmit={handleAddSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center font-mono text-xs text-white/30 pointer-events-none select-none">
              {newContactInput.startsWith("#") ? "#" : "@"}
            </span>
            <input
              type="text"
              placeholder="buscar ou criar..."
              value={newContactInput.replace(/^[@#]/, "")}
              onChange={(e) => {
                setNewContactInput(e.target.value);
                setAddError(null);
              }}
              className="w-full pl-6 pr-2.5 py-1.5 border border-white/10 rounded-lg bg-[#0A0A0B] text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            Adicionar
          </button>
        </form>
        <p className="text-[9px] text-white/30 mt-1 pl-0.5">
          Use <strong className="text-orange-400/80">@nome</strong> para pessoas ou <strong className="text-orange-400/80">#grupo</strong> para canais.
        </p>
        {addError && <p className="text-[10px] text-red-400 font-medium mt-1.5 pl-1">{addError}</p>}
        {addSuccess && <p className="text-[10px] text-orange-400 font-medium mt-1.5 pl-1 flex items-center gap-1">Contato adicionado!</p>}
      </div>

      {/* Search Input */}
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-white/5 hover:border-white/10 rounded-lg bg-[#0A0A0B] text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 bg-[#0D0D0E]">
        {filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-white/30 flex flex-col items-center gap-2 mt-4">
            <MessageCircle className="w-8 h-8 text-white/20 stroke-[1.5]" />
            <p className="text-xs font-semibold text-white/40">Nenhum contato encontrado</p>
            <p className="text-[10px] leading-relaxed max-w-[180px]">
              Adicione um amigo ou canal digitando acima para salvar localmente.
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isSelected = activeContact === contact.username;
            const profile = userProfiles[contact.username];
            const hasAvatar = profile?.profileImage;

            return (
              <div
                key={contact.username}
                onClick={() => onSelectContact(contact.username)}
                className={`flex items-center justify-between p-3 cursor-pointer group transition-all duration-150 ${
                  isSelected 
                    ? "bg-orange-500/5 font-medium border-l-2 border-orange-500" 
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Status Indicator Avatar */}
                  <div className="relative shrink-0">
                    {contact.isGroup ? (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                        isSelected 
                          ? "bg-orange-500/15 border-orange-500/40 text-orange-400" 
                          : "bg-black/30 border-white/5 text-white/40"
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border overflow-hidden transition-colors ${
                        isSelected || contact.isOnline 
                          ? "bg-[#1A1A1C] border-orange-500/30 text-orange-500" 
                          : "bg-[#1A1A1C] border-white/10 text-white/40"
                      }`}>
                        {hasAvatar ? (
                          <img src={profile.profileImage} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          contact.username[1]?.toUpperCase() || contact.username[0]?.toUpperCase() || "U"
                        )}
                      </div>
                    )}
                    
                    {/* Online status indicator (not shown for groups) */}
                    {!contact.isGroup && (
                      <div
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0D0D0E] shadow-sm ${
                          contact.isOnline 
                            ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" 
                            : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>

                  {/* Contact Name & Message preview */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs font-mono font-semibold truncate ${isSelected ? "text-orange-400" : "text-white"}`} title={contact.username}>
                        {contact.username}
                      </p>
                      {contact.lastTimestamp && (
                        <span className="text-[9px] text-white/20 font-mono whitespace-nowrap">
                          {new Date(contact.lastTimestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-[11px] truncate pr-2 ${
                        contact.unreadCount > 0 ? "text-white/90 font-medium" : "text-white/40"
                      }`}>
                        {contact.lastMessage || (
                          <span className="text-[10px] text-white/20 italic">
                            {contact.isGroup ? "Canal do Grupo" : "Conversar agora"}
                          </span>
                        )}
                      </p>
                      {contact.unreadCount > 0 && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 animate-pulse">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remove contact button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const itemType = contact.isGroup ? "o grupo" : "o contato";
                    if (confirm(`Deseja remover ${itemType} ${contact.username} da lista local? O histórico não será apagado.`)) {
                      onRemoveContact(contact.username);
                    }
                  }}
                  title="Remover"
                  className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 shrink-0 ml-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Profile Modal Dialog */}
      {showProfileModal && (
        <div className="absolute inset-0 bg-[#0A0A0B]/95 z-50 flex flex-col p-6 animate-fade-in font-sans">
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5">
            <div className="flex items-center gap-1.5 text-white">
              <Settings2 className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold tracking-tight">Editar Seu Perfil</h2>
            </div>
            <button 
              onClick={() => setShowProfileModal(false)}
              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full border-2 border-orange-500/30 flex items-center justify-center overflow-hidden bg-black/40 shadow-inner">
                {myProfileImage ? (
                  <img src={myProfileImage} alt="Meu Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 text-orange-500/50" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white/90 font-medium transition-all cursor-pointer"
              >
                <span>Enviar Foto</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 transition-all cursor-pointer"
              >
                Escolher Foto
              </button>
              {myProfileImage && (
                <button 
                  type="button" 
                  onClick={handleRemoveAvatar}
                  className="text-xs font-semibold px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/10 transition-all cursor-pointer"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfileSettings} className="space-y-4 flex-1 flex flex-col">
            <div>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-orange-500" /> Nome da Máquina
              </label>
              <input 
                type="text" 
                value={editMachineName}
                onChange={(e) => setEditMachineName(e.target.value)}
                placeholder="Ex: TI-DESKTOP-01"
                className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
              />
              <p className="text-[10px] text-white/30 mt-1 pl-0.5">Identificação para conexões e suporte remoto.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-orange-500" /> IP de Rede (Local ou Personalizado)
              </label>
              <input 
                type="text" 
                value={editCustomIp}
                onChange={(e) => setEditCustomIp(e.target.value)}
                placeholder={`Deixe em branco para usar detectado: ${detectedIp}`}
                className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 font-mono text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
              />
              <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded bg-orange-500/5 border border-orange-500/10">
                <Info className="w-3 h-3 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-[9.5px] text-white/40 leading-normal">
                  IP autodetectado pelo servidor: <strong className="text-white/60 font-mono">{detectedIp}</strong>. Se você estiver usando VPN ou NAT, insira o IP físico local para que outros acessem seu computador.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-auto border-t border-white/5 flex gap-2">
              <button 
                type="button" 
                onClick={() => setShowProfileModal(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-orange-500/5 transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
