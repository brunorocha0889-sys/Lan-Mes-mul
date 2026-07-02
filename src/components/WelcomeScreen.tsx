import React, { useState } from "react";
import { Shield, Lock, Wifi, MessageSquare, Mail, User, Key, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  onAuthSuccess: (user: {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    profileImage?: string;
    machineName?: string;
    ip?: string;
  }) => void;
}

export default function WelcomeScreen({ onAuthSuccess }: WelcomeScreenProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fields
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // --- LOGIN FLOW ---
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
          }),
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Erro ao fazer login.");
        }

        if (data.success && data.user) {
          onAuthSuccess(data.user);
        }
      } else {
        // --- REGISTER FLOW ---
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: usernameInput,
            email: emailInput,
            password: passwordInput,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Erro ao criar conta.");
        }

        if (data.success && data.user) {
          onAuthSuccess(data.user);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de conexão com o servidor local.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] p-4 font-sans selection:bg-orange-500/20">
      <div className="w-full max-w-md bg-[#0D0D0E] rounded-2xl border border-white/5 shadow-2xl p-8 transition-all duration-300">
        
        {/* Title & Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/5 mb-3">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Chat Local LAN</h1>
          <p className="text-white/40 text-xs mt-1">Conexão criptografada direta na sua rede local</p>
        </div>

        {/* Info badges for Privacy & Local nature */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <Shield className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-[11px] font-bold text-white/80">Privacidade 100%</h4>
              <p className="text-[9px] text-white/40 mt-0.5 leading-normal">Arquivos e áudios salvos na memória.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <Lock className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-[11px] font-bold text-white/80">Histórico Local</h4>
              <p className="text-[9px] text-white/40 mt-0.5 leading-normal">Não sai do seu computador.</p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#0A0A0B] border border-white/5 p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(true);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isLoginMode 
                ? "bg-orange-500 text-white shadow-sm" 
                : "text-white/40 hover:text-white"
            }`}
          >
            Acessar Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(false);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isLoginMode 
                ? "bg-orange-500 text-white shadow-sm" 
                : "text-white/40 hover:text-white"
            }`}
          >
            Criar Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input - ONLY for Register */}
          {!isLoginMode && (
            <div>
              <label htmlFor="username" className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-orange-500" /> Escolha seu @username
              </label>
              <div className="relative rounded-lg shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-white/30 font-mono text-xs pointer-events-none select-none">
                  @
                </span>
                <input
                  type="text"
                  id="username"
                  required
                  autoComplete="off"
                  placeholder="usuario_lan"
                  value={usernameInput.replace(/^@/, "")}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="block w-full pl-7 pr-3.5 py-2 border border-white/10 rounded-xl bg-white/5 focus:bg-[#141416] text-white placeholder:text-white/20 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-orange-500" /> Endereço de E-mail
            </label>
            <input
              type="email"
              id="email"
              required
              placeholder="nome@email.com"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setErrorMsg(null);
              }}
              className="block w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-white/5 focus:bg-[#141416] text-white placeholder:text-white/20 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-orange-500" /> Senha
            </label>
            <input
              type="password"
              id="password"
              required
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setErrorMsg(null);
              }}
              className="block w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-white/5 focus:bg-[#141416] text-white placeholder:text-white/20 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
              disabled={isLoading}
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-medium border border-red-500/20">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-semibold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed shadow-md shadow-orange-500/5 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Autenticando...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {isLoginMode ? "Entrar no Chat" : "Criar Cadastro e Entrar"} 
                <ArrowRight className="w-3.5 h-3.5 text-orange-200" />
              </span>
            )}
          </button>
        </form>

        {/* Master Admin credentials notice */}
        {isLoginMode && (
          <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] text-white/40 leading-relaxed">
            <p className="font-semibold text-white/60 mb-0.5 flex items-center gap-1">
              🔑 Login de Administrador Mestre:
            </p>
            E-mail: <strong className="text-orange-400/80">admin@admin.com</strong><br />
            Senha: <strong className="text-orange-400/80">admin</strong>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/5 text-center text-[10px] text-white/30 flex items-center justify-center gap-1">
          <Wifi className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
          Apenas na rede local / LAN
        </div>
      </div>
    </div>
  );
}
