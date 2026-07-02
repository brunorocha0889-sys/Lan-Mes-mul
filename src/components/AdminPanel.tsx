import React, { useState, useEffect } from "react";
import { 
  Shield, Users, Trash2, Edit2, Plus, Search, 
  ChevronLeft, Lock, Mail, User, Key, Check, Info, X, ShieldAlert, Laptop, Globe
} from "lucide-react";

interface AdminPanelProps {
  currentUser: { id: string; email: string; username: string; isAdmin: boolean } | null;
  onBack: () => void;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  machineName?: string;
  ip?: string;
}

export default function AdminPanel({ currentUser, onBack }: AdminPanelProps) {
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null); // null means "Create mode"
  
  // Form fields
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch users list
  const fetchUsers = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          "x-admin-email": currentUser.email
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao carregar os logins.");
      }
      const data = await response.json();
      if (data.success) {
        setUsersList(data.users);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro na conexão com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  // Handle open create/edit modal
  const openSaveModal = (user: UserRecord | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormEmail(user.email);
      setFormPassword(user.password || "");
      setFormIsAdmin(user.isAdmin);
    } else {
      setEditingUser(null);
      setFormUsername("");
      setFormEmail("");
      setFormPassword("");
      setFormIsAdmin(false);
    }
    setShowFormModal(true);
  };

  // Handle Create or Update
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/admin/users/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": currentUser.email
        },
        body: JSON.stringify({
          id: editingUser?.id || undefined,
          username: formUsername,
          email: formEmail,
          password: formPassword,
          isAdmin: formIsAdmin
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar alterações.");
      }

      setSuccessMsg(data.message || "Usuário salvo com sucesso!");
      setShowFormModal(false);
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro na conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete login
  const handleDeleteUser = async (user: UserRecord) => {
    if (!currentUser) return;
    if (user.email.toLowerCase() === currentUser.email.toLowerCase()) {
      alert("Você não pode deletar o seu próprio login ativo!");
      return;
    }

    if (!confirm(`Tem certeza absoluta de que deseja excluir permanentemente o cadastro de ${user.username} (${user.email})?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": currentUser.email
        },
        body: JSON.stringify({ id: user.id })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao excluir usuário.");
      }

      setSuccessMsg(data.message || "Usuário excluído!");
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir.");
    }
  };

  // Filter list
  const filteredUsers = usersList.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.machineName && u.machineName.toLowerCase().includes(query)) ||
      (u.ip && u.ip.includes(query))
    );
  });

  return (
    <div className="flex-1 bg-[#0A0A0B] flex flex-col h-full overflow-hidden font-sans relative selection:bg-orange-500/20">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#0D0D0E] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
            title="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              Console de Administração LAN
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400">
                MASTER
              </span>
            </h2>
            <p className="text-[10px] text-white/40 mt-0.5">
              Gerencie cadastros, altere credenciais de logins e permissões
            </p>
          </div>
        </div>

        <button
          onClick={() => openSaveModal()}
          className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-orange-500/5 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Cadastro
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-medium border border-red-500/20 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-medium border border-emerald-500/20 flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Stats & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0D0D0E] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Total de Logins</p>
              <p className="text-xl font-bold text-white mt-1">{usersList.length}</p>
            </div>
            <Users className="w-8 h-8 text-white/10 stroke-[1.5]" />
          </div>
          
          <div className="p-4 rounded-xl bg-[#0D0D0E] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Administradores</p>
              <p className="text-xl font-bold text-orange-400 mt-1">
                {usersList.filter(u => u.isAdmin).length}
              </p>
            </div>
            <Shield className="w-8 h-8 text-orange-500/10 stroke-[1.5]" />
          </div>

          {/* Search bar inside dashboard */}
          <div className="p-2 bg-[#0D0D0E] border border-white/5 rounded-xl flex items-center gap-2 sm:col-span-1">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-white/30 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar por nome, email ou IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-white/5 rounded-lg bg-[#0A0A0B] text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </div>

        {/* Logins Database Table */}
        <div className="bg-[#0D0D0E] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 bg-black/10">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              📂 Banco de Logins do Sistema
            </h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-white/30 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-xs font-medium">Buscando banco de logins em users.json...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-white/30">
              <p className="text-xs font-semibold">Nenhum registro encontrado</p>
              <p className="text-[10px] text-white/20 mt-1">Nenhum login corresponde aos critérios de pesquisa.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black/10 border-b border-white/5 text-[10px] uppercase font-bold tracking-wider text-white/40">
                    <th className="p-4 font-mono">Usuário (@)</th>
                    <th className="p-4">E-mail Cadastrado</th>
                    <th className="p-4">Senha de Acesso</th>
                    <th className="p-4">Nível / Cargo</th>
                    <th className="p-4">Último Dispositivo</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {filteredUsers.map((user) => {
                    const isSelf = user.email.toLowerCase() === currentUser?.email.toLowerCase();
                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-white/5 transition-colors ${isSelf ? "bg-orange-500/5" : ""}`}
                      >
                        {/* Username */}
                        <td className="p-4 font-mono font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{user.username}</span>
                            {isSelf && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500 text-white leading-none scale-90">
                                Você
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-4 text-white/70 font-medium">
                          {user.email}
                        </td>

                        {/* Password */}
                        <td className="p-4 font-mono text-white/60">
                          <span className="bg-black/40 px-2.5 py-1 rounded border border-white/5 tracking-widest text-[10px] hover:text-orange-400 transition-colors cursor-pointer select-all" title="Senha em texto claro para controle LAN">
                            {user.password || "••••••"}
                          </span>
                        </td>

                        {/* Role / Admin */}
                        <td className="p-4">
                          {user.isAdmin ? (
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-semibold text-[10px] inline-flex items-center gap-1">
                              <Shield className="w-3 h-3 shrink-0" /> Administrador
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/50 text-[10px] inline-flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0" /> Operador LAN
                            </span>
                          )}
                        </td>

                        {/* Device Meta */}
                        <td className="p-4 font-mono text-[10px] text-white/40">
                          <div className="flex flex-col gap-0.5 max-w-[150px] truncate">
                            {user.machineName ? (
                              <span className="flex items-center gap-1 text-white/60 truncate">
                                <Laptop className="w-3 h-3 text-orange-400/80 shrink-0" />
                                {user.machineName}
                              </span>
                            ) : (
                              <span>Não detectado</span>
                            )}
                            {user.ip && (
                              <span className="flex items-center gap-1 text-orange-400/60 truncate">
                                <Globe className="w-3 h-3 shrink-0" />
                                {user.ip}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openSaveModal(user)}
                              className="p-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                              title="Editar Credenciais"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg border border-transparent transition-all cursor-pointer ${
                                isSelf 
                                  ? "text-white/10 cursor-not-allowed" 
                                  : "hover:bg-red-500/10 hover:border-red-500/20 text-white/40 hover:text-red-400"
                              }`}
                              title={isSelf ? "Não é possível excluir a si mesmo" : "Excluir Cadastro"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Support Card / Advice */}
        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 flex gap-3.5 items-start">
          <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-white/90">Central de Operações de Rede</h4>
            <p className="text-white/50 leading-relaxed">
              Como administrador mestre, as alterações feitas nos logins entram em vigor em tempo real. Se você alterar a senha ou @usuario de um membro, informe-o para que ele faça o login novamente com as novas credenciais.
            </p>
          </div>
        </div>
      </div>

      {/* Save / Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0D0E] rounded-2xl overflow-hidden border border-white/10 shadow-2xl w-full max-w-md flex flex-col p-6 animate-fade-in font-sans">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5">
              <div className="flex items-center gap-1.5 text-white">
                {editingUser ? (
                  <>
                    <Edit2 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold">Editar Cadastro Existente</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold">Criar Novo Cadastro de Login</span>
                  </>
                )}
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-500" /> Nome de Usuário (@)
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-white/30 font-mono text-xs pointer-events-none">
                    @
                  </span>
                  <input 
                    type="text" 
                    required
                    value={formUsername.replace(/^@/, "")}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="usuario_lan"
                    className="w-full pl-7 pr-3 py-2 border border-white/10 rounded-lg bg-[#0A0A0B] text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-1">Identificador único no chat local.</p>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-500" /> E-mail de Login
                </label>
                <input 
                  type="email" 
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="nome@email.com"
                  className="w-full px-3 py-2 border border-white/10 rounded-lg bg-[#0A0A0B] text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                />
                <p className="text-[10px] text-white/30 mt-1">Utilizado pelo operador para efetuar o login.</p>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-500" /> Senha de Acesso
                </label>
                <input 
                  type="text" 
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Digite a senha"
                  className="w-full px-3 py-2 border border-white/10 rounded-lg bg-[#0A0A0B] text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                />
              </div>

              {/* Administrator Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formIsAdmin}
                    disabled={editingUser?.email.toLowerCase() === currentUser?.email.toLowerCase()}
                    onChange={(e) => setFormIsAdmin(e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded border-white/10 bg-black/40"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-white flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-orange-500" /> Privilégios de Administrador
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      Permite criar, alterar e remover outros logins.
                    </p>
                  </div>
                </label>
                {editingUser?.email.toLowerCase() === currentUser?.email.toLowerCase() && (
                  <p className="text-[9.5px] text-orange-400/60 mt-1 pl-1">
                    * Você não pode revogar seus próprios privilégios de administrador mestre.
                  </p>
                )}
              </div>

              {/* Form buttons */}
              <div className="pt-4 border-t border-white/5 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-medium rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-orange-500/5 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {isSaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    "Confirmar e Salvar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
