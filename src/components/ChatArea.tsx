import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Paperclip, Mic, Video, Download, Play, Square, X, 
  FileText, Check, Shield, Lock, Trash2, Camera, CircleCheck, AlertCircle,
  ChevronLeft, Info, BellRing, Copy, Users
} from "lucide-react";
import { Message, UserProfile } from "../types";
import { formatBytes, formatDuration, blobToBase64 } from "../utils";

interface ChatAreaProps {
  currentUsername: string;
  activeContact: string | null;
  messages: Message[];
  isContactOnline: boolean;
  onSendMessage: (text: string, fileData?: { filename: string; type: string; base64: string; size: number }, isNudge?: boolean) => Promise<void>;
  onClearHistory: (contactUsername: string) => void;
  onBack?: () => void;
  userProfiles: { [username: string]: UserProfile };
}

export default function ChatArea({
  currentUsername,
  activeContact,
  messages,
  isContactOnline,
  onSendMessage,
  onClearHistory,
  onBack,
  userProfiles,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);

  // Audio Recording states
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Video Recording states
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll ref
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeContact]);

  // Audio Timer
  useEffect(() => {
    if (isRecordingAudio) {
      audioIntervalRef.current = setInterval(() => {
        setAudioDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      setAudioDuration(0);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isRecordingAudio]);

  // Video Timer
  useEffect(() => {
    if (isRecordingVideo) {
      videoIntervalRef.current = setInterval(() => {
        setVideoDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      setVideoDuration(0);
    }
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    };
  }, [isRecordingVideo]);

  if (!activeContact) {
    return (
      <div className="flex-1 bg-[#0A0A0B] flex flex-col items-center justify-center p-8 text-center selection:bg-orange-500/20 font-sans">
        <div className="max-w-md flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500 shadow-lg shadow-orange-500/5">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Seu Chat LAN Privado</h2>
          <p className="text-white/40 text-xs leading-relaxed">
            Nenhuma mensagem é transmitida pela internet. Todas as trocas de arquivos, áudio, vídeo e texto ocorrem exclusivamente na sua rede local física.
          </p>
          <div className="flex gap-4 p-3.5 bg-[#0D0D0E] rounded-xl border border-white/5 text-[11px] text-white/60 text-left">
            <div className="flex gap-1.5 items-start">
              <Shield className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <span><strong>Total Privacidade:</strong> O histórico de mensagens e os arquivos compartilhados ficam armazenados apenas de forma local.</span>
            </div>
          </div>
          <p className="text-xs text-orange-400/60 italic mt-2 animate-pulse">
            Adicione ou selecione um contato na barra lateral para iniciar a conversa local.
          </p>
        </div>
      </div>
    );
  }

  // Handle message submission
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    try {
      setInputText("");
      await onSendMessage(text);
    } catch (err: any) {
      setUploadError("Erro ao enviar mensagem: " + err.message);
    }
  };

  // Helper to upload file and send message
  const uploadAndSend = async (file: File, typePrefix = "file") => {
    setIsUploading(true);
    setUploadError(null);
    try {
      if (file.size > 40 * 1024 * 1024) {
        throw new Error("Tamanho máximo de arquivo permitido é 40MB.");
      }

      const base64 = await blobToBase64(file);
      
      await onSendMessage(`Compartilhou um ${typePrefix}`, {
        filename: file.name,
        type: file.type || "application/octet-stream",
        base64,
        size: file.size
      });
    } catch (err: any) {
      setUploadError(err.message || "Falha ao processar arquivo.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle standard file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAndSend(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadAndSend(file);
    }
  };

  // Audio Recording Controls
  const startAudioRecording = async () => {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Determine appropriate mimeType
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
        const file = new File([audioBlob], `audio_gravado_${Date.now()}.${ext}`, { type: mimeType });
        await uploadAndSend(file, "áudio");
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (err) {
      setUploadError("Acesso ao microfone negado ou indisponível.");
      console.error(err);
    }
  };

  const stopAudioRecording = (shouldSend = true) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (!shouldSend) {
        // Discard
        mediaRecorderRef.current.onstop = () => {};
      }
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    setIsRecordingAudio(false);
  };

  // Video Recording Controls (via Modal)
  const openVideoRecorder = async () => {
    setUploadError(null);
    setShowVideoModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      videoStreamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.play().catch(err => console.log("video preview error:", err));
      }
    } catch (err) {
      setUploadError("Acesso à câmera/microfone negado.");
      setShowVideoModal(false);
      console.error(err);
    }
  };

  const startVideoRecording = () => {
    if (!videoStreamRef.current) return;
    
    let mimeType = "video/webm";
    if (MediaRecorder.isTypeSupported("video/mp4")) {
      mimeType = "video/mp4";
    }
    
    const mediaRecorder = new MediaRecorder(videoStreamRef.current, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    videoChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        videoChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
      const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
      const file = new File([videoBlob], `video_gravado_${Date.now()}.${ext}`, { type: mimeType });
      await uploadAndSend(file, "vídeo");
    };

    mediaRecorder.start();
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = (shouldSend = true) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {};
      }
      mediaRecorderRef.current.stop();
    }
    
    closeVideoStreams();
    setIsRecordingVideo(false);
    setShowVideoModal(false);
  };

  const closeVideoStreams = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
  };

  // Render message depending on properties
  const renderMessageContent = (msg: Message) => {
    const isOutgoing = msg.sender === currentUsername;
    const downloadUrl = msg.fileId ? `/api/download/${msg.fileId}` : "";

    if (msg.isNudge) {
      return (
        <div className="flex items-center gap-2 text-red-400 font-bold text-xs py-1 px-0.5 animate-pulse">
          <BellRing className="w-4 h-4 text-red-500 animate-bounce" />
          <span>{msg.sender === currentUsername ? "Você chamou a atenção!" : "chamou sua atenção!"}</span>
        </div>
      );
    }

    if (msg.fileId) {
      const isImage = msg.fileType?.startsWith("image/");
      const isAudio = msg.fileType?.startsWith("audio/");
      const isVideo = msg.fileType?.startsWith("video/");

      if (isImage) {
        return (
          <div className="space-y-1 mt-1 max-w-sm">
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10 hover:opacity-95 transition-opacity">
              <img 
                src={downloadUrl} 
                alt={msg.fileName} 
                className="max-h-60 object-cover w-full"
                referrerPolicy="no-referrer"
              />
            </a>
            <div className="flex items-center justify-between text-[10px] text-white/40 px-1 font-mono">
              <span className="truncate max-w-[150px]">{msg.fileName}</span>
              <span>{formatBytes(msg.fileSize || 0)}</span>
            </div>
          </div>
        );
      }

      if (isAudio) {
        return (
          <div className="space-y-1.5 mt-1 min-w-[240px] md:min-w-[280px]">
            <div className="bg-[#141416]/90 border border-white/5 rounded-lg p-2.5 flex items-center gap-2">
              <audio src={downloadUrl} controls className="w-full h-8 outline-none filter invert brightness-90" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/40 px-1 font-mono">
              <span className="truncate max-w-[150px]">🎙️ Áudio Gravado</span>
              <span>{formatBytes(msg.fileSize || 0)}</span>
            </div>
          </div>
        );
      }

      if (isVideo) {
        return (
          <div className="space-y-1 mt-1 max-w-sm">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
              <video src={downloadUrl} controls className="max-h-64 w-full" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/40 px-1 font-mono">
              <span className="truncate max-w-[150px]">🎥 Vídeo Gravado</span>
              <span>{formatBytes(msg.fileSize || 0)}</span>
            </div>
          </div>
        );
      }

      // Default Generic file download card
      return (
        <div className="mt-1">
          <a
            href={downloadUrl}
            download={msg.fileName}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isOutgoing 
                ? "bg-orange-600 border-orange-500 text-white hover:bg-orange-700/80 shadow-md shadow-orange-500/10" 
                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isOutgoing ? "bg-orange-750" : "bg-white/5 border border-white/10"
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-semibold truncate max-w-[160px] md:max-w-[220px]" title={msg.fileName}>
                {msg.fileName}
              </p>
              <p className={`text-[10px] font-mono mt-0.5 ${isOutgoing ? "text-orange-200" : "text-white/40"}`}>
                {msg.fileType?.split("/")[1]?.toUpperCase() || "FILE"} • {formatBytes(msg.fileSize || 0)}
              </p>
            </div>
            <Download className="w-4 h-4 shrink-0 opacity-70 hover:opacity-100" />
          </a>
        </div>
      );
    }

    return <p className="text-xs leading-relaxed whitespace-pre-wrap text-left break-words">{msg.text}</p>;
  };

  const isGroupChat = activeContact.startsWith("#");
  const activeProfile = userProfiles[activeContact];

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-[#0A0A0B] relative selection:bg-orange-500/20 font-sans"
      onDragOver={handleDragOver}
    >
      {/* Drag & Drop File Overlay */}
      {isDragging && (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-6"
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="bg-[#0D0D0E] border border-orange-500/40 rounded-2xl p-8 max-w-sm text-center shadow-2xl flex flex-col items-center gap-3 animate-pulse pointer-events-none">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-orange-500">
              <Paperclip className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Solte para Compartilhar</h3>
            <p className="text-xs text-white/40">
              O arquivo será carregado diretamente em memória na rede local. (Máx. 40MB)
            </p>
          </div>
        </div>
      )}

      {/* Chat Area Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#0D0D0E] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all mr-1 shrink-0 cursor-pointer"
              title="Voltar para a lista de contatos"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            {isGroupChat ? (
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">
                <Users className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm overflow-hidden bg-black/40">
                {activeProfile?.profileImage ? (
                  <img src={activeProfile.profileImage} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  activeContact[1]?.toUpperCase() || activeContact[0]?.toUpperCase() || "U"
                )}
              </div>
            )}
            
            {/* Online status indicator */}
            {!isGroupChat && (
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0D0D0E] ${
                isContactOnline ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "bg-white/10"
              }`} />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-xs font-mono font-bold text-white truncate" title={activeContact}>
              {activeContact}
            </h2>
            <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
              {isGroupChat ? (
                <span className="text-orange-400 font-medium font-mono flex items-center gap-1">
                  ● Canal do Grupo LAN
                </span>
              ) : isContactOnline ? (
                <span className="text-orange-400 font-medium font-mono flex items-center gap-1">
                  ● Conectado à LAN
                </span>
              ) : (
                <span className="text-white/20">Offline na rede local</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {!isGroupChat && (
            <button
              onClick={() => setShowDetailsModal(true)}
              className="p-1.5 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Ver detalhes do contato (Máquina, IP, Suporte Remoto)"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Detalhes</span>
            </button>
          )}
          
          <button
            onClick={() => {
              if (confirm("Tem certeza que deseja apagar o histórico de mensagens deste contato de forma PERMANENTE? Esta ação ocorre apenas na sua máquina local e é irreversível.")) {
                onClearHistory(activeContact);
              }
            }}
            className="p-1.5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Limpar histórico local"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Messages Sandbox Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0A0B]">
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-orange-500/5 border border-orange-500/10 text-[10px] text-orange-400">
            <Lock className="w-3 h-3 text-orange-500" />
            <span>Chat Criptografado & Local (LAN)</span>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="py-12 text-center text-white/30 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#0D0D0E] border border-white/5 flex items-center justify-center text-white/30 mb-1">
              💬
            </div>
            <p className="text-xs font-semibold text-white/40">Sem mensagens ainda</p>
            <p className="text-[10px] leading-relaxed max-w-[220px]">
              Envie uma mensagem de áudio, vídeo, arquivo, texto ou chame atenção para iniciar a conversa local.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.sender === currentUsername;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOutgoing ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm border text-sm transition-all ${
                    msg.isNudge
                      ? "bg-red-500/10 border-red-500/20 text-white rounded-xl shadow-[0_4px_12px_rgba(239,68,68,0.15)] animate-bounce"
                      : isOutgoing
                      ? "bg-orange-500 border-orange-500 text-white rounded-br-none shadow-[0_4px_12px_rgba(249,115,22,0.15)]"
                      : "bg-[#0D0D0E] border-white/5 text-white rounded-bl-none"
                  }`}
                >
                  {/* Sender title if incoming */}
                  {!isOutgoing && (
                    <p className="text-[9px] font-mono font-bold text-orange-400/80 mb-1 uppercase tracking-wider">
                      {msg.sender}
                    </p>
                  )}
                  
                  {/* Message body / components */}
                  {renderMessageContent(msg)}
                </div>

                {/* Date stamp */}
                <div className="flex items-center gap-1 mt-1 px-1 text-[9px] text-white/30 font-mono">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOutgoing && (
                    <span className="text-orange-400 font-semibold" title="Entregue via LAN">
                      ✓✓
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Input controls block */}
      <div className="p-4 border-t border-white/5 bg-[#0D0D0E] shrink-0">
        
        {/* Upload feedback line */}
        {(isUploading || uploadError) && (
          <div className="mb-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between border border-orange-500/20 bg-orange-500/5 text-orange-400">
            {isUploading ? (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></span>
                <span>Processando e enviando mídia via rede local...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-medium text-red-400">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadError && (
              <button 
                onClick={() => setUploadError(null)}
                className="text-white/40 hover:text-white font-semibold text-[10px]"
              >
                Dispensar
              </button>
            )}
          </div>
        )}

        {/* Dynamic Toolbar depending on recording status */}
        {isRecordingAudio ? (
          <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span className="text-xs font-semibold text-red-400">Gravando Áudio: {formatDuration(audioDuration)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => stopAudioRecording(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-xs font-medium transition-all"
                title="Descartar gravação"
              >
                Cancelar
              </button>
              <button
                onClick={() => stopAudioRecording(true)}
                className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                title="Parar e Enviar"
              >
                <Square className="w-3 h-3 shrink-0" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex gap-2.5 items-center">
            
            {/* hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Media Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded-xl transition-all cursor-pointer"
                title="Compartilhar arquivo (fotos, pdf, documentos)"
                disabled={isUploading}
              >
                <Paperclip className="w-4.5 h-4.5" />
              </button>
              
              <button
                type="button"
                onClick={startAudioRecording}
                className="p-2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded-xl transition-all cursor-pointer"
                title="Gravar áudio (Mensagem de voz)"
                disabled={isUploading}
              >
                <Mic className="w-4.5 h-4.5" />
              </button>

              <button
                type="button"
                onClick={openVideoRecorder}
                className="p-2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded-xl transition-all cursor-pointer"
                title="Gravar vídeo"
                disabled={isUploading}
              >
                <Video className="w-4.5 h-4.5" />
              </button>

              {/* MSN Attention Nudge Button */}
              {!isGroupChat && (
                <button
                  type="button"
                  onClick={async () => {
                    if (nudgeCooldown) return;
                    setNudgeCooldown(true);
                    try {
                      await onSendMessage("⚠️ chamou sua atenção!", undefined, true);
                    } catch (e) {
                      console.error(e);
                    }
                    setTimeout(() => setNudgeCooldown(false), 5000);
                  }}
                  disabled={nudgeCooldown || isUploading}
                  className={`p-2 border rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    nudgeCooldown 
                      ? "bg-red-500/5 border-red-500/10 text-red-500/30 cursor-not-allowed" 
                      : "hover:bg-white/5 border-white/5 hover:border-white/10 text-white/40 hover:text-orange-500"
                  }`}
                  title={nudgeCooldown ? "Aguarde 5s para chamar atenção novamente" : "Chamar Atenção! (Zumbido clássico)"}
                >
                  <BellRing className={`w-4.5 h-4.5 ${nudgeCooldown ? "animate-pulse" : "animate-bounce text-orange-500/80"}`} />
                </button>
              )}
            </div>

            {/* Message input */}
            <input
              type="text"
              placeholder={`Escrever mensagem para ${activeContact}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all bg-[#0A0A0B] focus:bg-[#141416]"
              disabled={isUploading}
              autoComplete="off"
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={isUploading || !inputText.trim()}
              className="p-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-white/5 text-white disabled:text-white/20 rounded-xl transition-all shadow-md shadow-orange-500/5 shrink-0 cursor-pointer"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Video Recorder Modal */}
      {showVideoModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0D0E] rounded-2xl overflow-hidden border border-white/10 shadow-2xl w-full max-w-sm flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#0D0D0E]">
              <div className="flex items-center gap-1.5 text-white">
                <Camera className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold">Gravar Mensagem de Vídeo</span>
              </div>
              <button 
                onClick={() => stopVideoRecording(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video preview arena */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video 
                ref={videoPreviewRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              {isRecordingVideo && (
                <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  <span>{formatDuration(videoDuration)}</span>
                </div>
              )}
            </div>

            {/* Modal controls */}
            <div className="p-4 flex justify-center gap-3 bg-[#0D0D0E] border-t border-white/5">
              {!isRecordingVideo ? (
                <button
                  type="button"
                  onClick={startVideoRecording}
                  className="py-2 px-5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Iniciar Gravação
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => stopVideoRecording(true)}
                  className="py-2 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Parar e Enviar
                </button>
              )}
              <button
                type="button"
                onClick={() => stopVideoRecording(false)}
                className="py-2 px-4 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {showDetailsModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0D0E] rounded-2xl overflow-hidden border border-white/10 shadow-2xl w-full max-w-sm flex flex-col p-6 animate-fade-in font-sans">
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5">
              <div className="flex items-center gap-1.5 text-white">
                <Info className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold">Detalhes do Contato LAN</span>
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="w-20 h-20 rounded-full border border-orange-500/20 flex items-center justify-center overflow-hidden bg-black/40 text-orange-500 text-2xl font-bold font-sans">
                {activeProfile?.profileImage ? (
                  <img src={activeProfile.profileImage} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  activeContact[1]?.toUpperCase() || activeContact[0]?.toUpperCase() || "U"
                )}
              </div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-white font-mono">{activeContact}</h3>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1.5 font-medium ${
                  isContactOnline 
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/25" 
                    : "bg-white/5 text-white/30 border border-white/5"
                }`}>
                  {isContactOnline ? "Online na LAN" : "Offline / Cache local"}
                </span>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              {/* Machine Name */}
              <div className="bg-black/20 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-0.5">Nome do Computador</p>
                  <p className="text-xs font-mono text-white/90 truncate">
                    {activeProfile?.machineName || (isContactOnline ? "Buscando..." : "Não disponível")}
                  </p>
                </div>
                {activeProfile?.machineName && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeProfile?.machineName || "");
                      alert("Nome da máquina copiado para transferência de arquivos / identificação!");
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Copiar Nome da Máquina"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* IP address */}
              <div className="bg-black/20 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-0.5">Endereço IP Local</p>
                  <p className="text-xs font-mono text-orange-400 font-semibold truncate">
                    {activeProfile?.ip || (isContactOnline ? "Buscando..." : "Não disponível")}
                  </p>
                </div>
                {activeProfile?.ip && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeProfile?.ip || "");
                      alert("IP copiado! Use para RDP, SSH, ping ou acesso local.");
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Copiar IP da Máquina"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-[9.5px] text-white/30 leading-normal text-center pt-2">
                Use este IP e nome de máquina para realizar acessos remotos via RDP (Área de Trabalho Remota), SSH, VNC, FTP ou mapeamento de rede na sua LAN.
              </p>
            </div>

            <div className="pt-5 mt-6 border-t border-white/5">
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
