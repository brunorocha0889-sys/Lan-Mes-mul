import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  // Create WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  // In-memory store for privacy (files are never written to disk and auto-expire)
  interface LocalFile {
    id: string;
    filename: string;
    type: string;
    data: string; // base64
    size: number;
    timestamp: number;
  }
  const filesStore = new Map<string, LocalFile>();

  // Clients directory: username -> ClientInfo
  interface ClientInfo {
    ws: WebSocket;
    profileImage?: string;
    machineName?: string;
    ip?: string;
  }
  const clients = new Map<string, ClientInfo>();
  // Offline temporary buffer: username -> msg[]
  const offlineMessages = new Map<string, any[]>();

  // Express middleware
  app.use(express.json({ limit: '100mb' }));

  // Persistent User JSON storage for Local LAN system
  const USERS_FILE = path.join(process.cwd(), "users.json");

  interface RegisteredUser {
    id: string;
    username: string;
    email: string;
    password: string;
    isAdmin?: boolean;
    profileImage?: string;
    machineName?: string;
    ip?: string;
  }

  function loadUsers(): RegisteredUser[] {
    try {
      if (!fs.existsSync(USERS_FILE)) {
        const initialUsers: RegisteredUser[] = [
          {
            id: "admin-1",
            username: "@admin",
            email: "admin@admin.com",
            password: "admin",
            isAdmin: true,
            profileImage: "",
            machineName: "Mesa do Administrador",
            ip: "127.0.0.1"
          }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), "utf8");
        return initialUsers;
      }
      const data = fs.readFileSync(USERS_FILE, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      return [];
    }
  }

  function saveUsers(usersList: RegisteredUser[]) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), "utf8");
    } catch (err) {
      console.error("Erro ao salvar usuários:", err);
    }
  }

  // --- Auth APIs ---
  app.post("/api/auth/register", (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Todos os campos (usuário, email e senha) são obrigatórios." });
      }

      const emailLower = email.trim().toLowerCase();
      if (!emailLower.includes("@") || !emailLower.includes(".")) {
        return res.status(400).json({ error: "Por favor, digite um email válido." });
      }

      let normalizedUser = username.trim().toLowerCase();
      if (!normalizedUser.startsWith("@")) {
        normalizedUser = "@" + normalizedUser;
      }

      if (normalizedUser.length < 3) {
        return res.status(400).json({ error: "O nome de usuário deve ter pelo menos 3 caracteres." });
      }

      const users = loadUsers();
      if (users.some(u => u.email.toLowerCase() === emailLower)) {
        return res.status(400).json({ error: "Este email já está cadastrado." });
      }

      if (users.some(u => u.username.toLowerCase() === normalizedUser)) {
        return res.status(400).json({ error: "Este nome de usuário já está sendo usado." });
      }

      const newUser: RegisteredUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        username: normalizedUser,
        email: emailLower,
        password,
        isAdmin: false,
        machineName: "Dispositivo LAN",
        ip: "127.0.0.1"
      };

      users.push(newUser);
      saveUsers(users);

      res.json({ success: true, user: { id: newUser.id, username: newUser.username, email: newUser.email, isAdmin: false } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios." });
      }

      const emailLower = email.trim().toLowerCase();
      const users = loadUsers();

      const user = users.find(u => u.email.toLowerCase() === emailLower);
      if (!user) {
        return res.status(400).json({ error: "E-mail ou senha incorretos." });
      }

      if (user.password !== password) {
        return res.status(400).json({ error: "E-mail ou senha incorretos." });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: !!user.isAdmin,
          profileImage: user.profileImage,
          machineName: user.machineName,
          ip: user.ip
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Admin APIs ---
  app.get("/api/admin/users", (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"] as string;
      const users = loadUsers();

      const requester = users.find(u => u.email.toLowerCase() === adminEmail?.toLowerCase());
      if (!requester || !requester.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const list = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        password: u.password,
        isAdmin: !!u.isAdmin,
        machineName: u.machineName || "",
        ip: u.ip || ""
      }));

      res.json({ success: true, users: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/save", (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"] as string;
      const users = loadUsers();

      const requester = users.find(u => u.email.toLowerCase() === adminEmail?.toLowerCase());
      if (!requester || !requester.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { id, username, email, password, isAdmin } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Nome de usuário, email e senha são obrigatórios." });
      }

      const emailLower = email.trim().toLowerCase();
      let normalizedUser = username.trim().toLowerCase();
      if (!normalizedUser.startsWith("@")) {
        normalizedUser = "@" + normalizedUser;
      }

      if (id) {
        // Edit Mode
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex === -1) {
          return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Validate duplicates excluding current editing user
        if (users.some((u, idx) => idx !== userIndex && u.email.toLowerCase() === emailLower)) {
          return res.status(400).json({ error: "Este email já está sendo usado por outro login." });
        }
        if (users.some((u, idx) => idx !== userIndex && u.username.toLowerCase() === normalizedUser)) {
          return res.status(400).json({ error: "Este nome de usuário já está sendo usado por outro login." });
        }

        users[userIndex].username = normalizedUser;
        users[userIndex].email = emailLower;
        users[userIndex].password = password;
        
        // Prevent removing oneself's admin status
        if (users[userIndex].email === requester.email) {
          users[userIndex].isAdmin = true;
        } else {
          users[userIndex].isAdmin = !!isAdmin;
        }

        saveUsers(users);
        res.json({ success: true, message: "Usuário atualizado com sucesso!" });
      } else {
        // Create Mode
        if (users.some(u => u.email.toLowerCase() === emailLower)) {
          return res.status(400).json({ error: "Este email já está cadastrado." });
        }
        if (users.some(u => u.username.toLowerCase() === normalizedUser)) {
          return res.status(400).json({ error: "Este nome de usuário já está sendo usado." });
        }

        const newUser: RegisteredUser = {
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          username: normalizedUser,
          email: emailLower,
          password: password,
          isAdmin: !!isAdmin,
          machineName: "Dispositivo LAN",
          ip: "127.0.0.1"
        };

        users.push(newUser);
        saveUsers(users);
        res.json({ success: true, message: "Usuário criado com sucesso!" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/delete", (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"] as string;
      const users = loadUsers();

      const requester = users.find(u => u.email.toLowerCase() === adminEmail?.toLowerCase());
      if (!requester || !requester.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "ID de usuário ausente." });
      }

      const userToDelete = users.find(u => u.id === id);
      if (!userToDelete) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      if (userToDelete.email.toLowerCase() === requester.email.toLowerCase()) {
        return res.status(400).json({ error: "Você não pode deletar sua própria conta de administrador." });
      }

      const filtered = users.filter(u => u.id !== id);
      saveUsers(filtered);

      res.json({ success: true, message: "Usuário removido com sucesso!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Upload file in-memory
  app.post("/api/upload", (req, res) => {
    try {
      const { filename, type, data, size } = req.body;
      if (!filename || !type || !data) {
        return res.status(400).json({ error: "Parâmetros do arquivo ausentes." });
      }
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      filesStore.set(fileId, {
        id: fileId,
        filename,
        type,
        data,
        size: size || 0,
        timestamp: Date.now()
      });
      res.json({ fileId, url: `/api/download/${fileId}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Download file from in-memory store
  app.get("/api/download/:id", (req, res) => {
    const file = filesStore.get(req.params.id);
    if (!file) {
      return res.status(404).send("Arquivo não encontrado ou já expirou (limite de 30 minutos).");
    }
    const buffer = Buffer.from(file.data, 'base64');
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.send(buffer);
  });

  // API - Active state check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", clients: Array.from(clients.keys()).length });
  });

  // Privacy Cleanup: Auto-delete files older than 30 minutes every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let deletedCount = 0;
    for (const [id, file] of filesStore.entries()) {
      if (now - file.timestamp > maxAge) {
        filesStore.delete(id);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`[Privacidade] Limpeza concluída: ${deletedCount} arquivos expirados removidos da memória.`);
    }
  }, 5 * 60 * 1000);

  // WebSocket Server logic
  wss.on("connection", (ws, request) => {
    let registeredUsername: string | null = null;

    // Detect client IP address
    let detectedIpAddress = "127.0.0.1";
    const rawIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    if (rawIp) {
      if (typeof rawIp === 'string') {
        const parts = rawIp.split(',');
        detectedIpAddress = parts[0].trim();
      } else if (Array.isArray(rawIp)) {
        detectedIpAddress = rawIp[0];
      }
    }
    if (detectedIpAddress === "::1") {
      detectedIpAddress = "127.0.0.1";
    } else if (detectedIpAddress.startsWith("::ffff:")) {
      detectedIpAddress = detectedIpAddress.substring(7);
    }

    ws.on("message", (messageStr) => {
      try {
        const message = JSON.parse(messageStr.toString());
        
        switch (message.type) {
          case "register": {
            const { username, profileImage, machineName, ip } = message;
            if (!username || typeof username !== "string" || (!username.startsWith("@") && !username.startsWith("#"))) {
              ws.send(JSON.stringify({ 
                type: "register_response", 
                success: false, 
                error: "Nome de usuário inválido. Deve iniciar com @" 
              }));
              return;
            }
            
            const normalized = username.trim().toLowerCase();
            
            // Allow re-registration if the socket is the same, otherwise check duplicates
            if (clients.has(normalized)) {
              ws.send(JSON.stringify({ 
                type: "register_response", 
                success: false, 
                error: "Este nome de usuário já está sendo usado na rede local." 
              }));
              return;
            }

            // Load registered users and verify if this is an @username registration
            let loadedProfileImage = profileImage;
            let loadedMachineName = machineName;
            let loadedIp = ip || detectedIpAddress;

            if (normalized.startsWith("@")) {
              const users = loadUsers();
              const dbUser = users.find(u => u.username.toLowerCase() === normalized);
              if (!dbUser) {
                ws.send(JSON.stringify({ 
                  type: "register_response", 
                  success: false, 
                  error: "Este usuário não está cadastrado no sistema. Por favor, faça login." 
                }));
                return;
              }
              // Retrieve persistent fields from database
              if (dbUser.profileImage) loadedProfileImage = dbUser.profileImage;
              if (dbUser.machineName) loadedMachineName = dbUser.machineName;
              if (dbUser.ip) loadedIp = dbUser.ip;
            }
            
            registeredUsername = normalized;
            clients.set(normalized, {
              ws,
              profileImage: loadedProfileImage,
              machineName: loadedMachineName,
              ip: loadedIp
            });
            
            ws.send(JSON.stringify({ 
              type: "register_response", 
              success: true, 
              username: normalized,
              detectedIp: detectedIpAddress,
              profileImage: loadedProfileImage,
              machineName: loadedMachineName,
              ip: loadedIp
            }));
            
            // Broadcast updated online list
            broadcastOnlineUsers();
            
            // Deliver pending offline messages
            const pending = offlineMessages.get(normalized);
            if (pending && pending.length > 0) {
              ws.send(JSON.stringify({ type: "pending_messages", messages: pending }));
              offlineMessages.delete(normalized);
            }
            break;
          }

          case "update_profile": {
            const { profileImage, machineName, ip } = message;
            if (!registeredUsername) return;
            const info = clients.get(registeredUsername);
            if (info) {
              info.profileImage = profileImage;
              info.machineName = machineName;
              info.ip = ip || info.ip;
              clients.set(registeredUsername, info);

              // Also persist in users.json
              const users = loadUsers();
              const idx = users.findIndex(u => u.username.toLowerCase() === registeredUsername);
              if (idx !== -1) {
                if (profileImage !== undefined) users[idx].profileImage = profileImage;
                if (machineName !== undefined) users[idx].machineName = machineName;
                if (ip !== undefined) users[idx].ip = ip;
                saveUsers(users);
              }

              broadcastOnlineUsers();
            }
            break;
          }
          
          case "direct_message": {
            const { recipient, text, fileId, fileName, fileType, fileSize, duration, id, timestamp, isNudge } = message;
            if (!registeredUsername) {
              ws.send(JSON.stringify({ type: "error", message: "Você precisa se registrar antes de enviar mensagens." }));
              return;
            }
            
            const normalizedRecipient = recipient.trim().toLowerCase();
            const msgPayload = {
              id: id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              sender: registeredUsername,
              recipient: normalizedRecipient,
              text,
              fileId,
              fileName,
              fileType,
              fileSize,
              duration,
              isNudge,
              timestamp: timestamp || Date.now()
            };
            
            if (normalizedRecipient.startsWith("#")) {
              // Group Broadcast! Send to all connected clients
              const payload = JSON.stringify({ type: "message", data: msgPayload });
              for (const [uname, info] of clients.entries()) {
                if (info.ws.readyState === WebSocket.OPEN) {
                  info.ws.send(payload);
                }
              }
              ws.send(JSON.stringify({ type: "message_status", id: msgPayload.id, status: "delivered" }));
            } else {
              // Direct Message
              const recipientInfo = clients.get(normalizedRecipient);
              if (recipientInfo && recipientInfo.ws.readyState === WebSocket.OPEN) {
                recipientInfo.ws.send(JSON.stringify({ type: "message", data: msgPayload }));
                ws.send(JSON.stringify({ type: "message_status", id: msgPayload.id, status: "delivered" }));
              } else {
                // Buffer offline messages temporarily
                if (!offlineMessages.has(normalizedRecipient)) {
                  offlineMessages.set(normalizedRecipient, []);
                }
                offlineMessages.get(normalizedRecipient)!.push(msgPayload);
                ws.send(JSON.stringify({ type: "message_status", id: msgPayload.id, status: "buffered" }));
              }
            }
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket:", err);
      }
    });

    ws.on("close", () => {
      if (registeredUsername) {
        clients.delete(registeredUsername);
        broadcastOnlineUsers();
      }
    });

    function broadcastOnlineUsers() {
      const onlineList = Array.from(clients.entries()).map(([username, info]) => ({
        username,
        profileImage: info.profileImage,
        machineName: info.machineName,
        ip: info.ip
      }));
      const payload = JSON.stringify({ type: "online_users", users: onlineList });
      for (const info of clients.values()) {
        if (info.ws.readyState === WebSocket.OPEN) {
          info.ws.send(payload);
        }
      }
    }
  });

  // Handle upgrade to WebSockets
  httpServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Serve Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[LAN Chat Server] Rodando na porta ${PORT}`);
  });
}

startServer();
