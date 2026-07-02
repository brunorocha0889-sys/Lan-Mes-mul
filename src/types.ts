export interface Message {
  id: string;
  sender: string;       // e.g. "@alice"
  recipient: string;    // e.g. "@bob" or "#trabalho"
  text: string;
  fileId?: string;       // ID for in-memory download endpoint
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  duration?: number;     // for audio or video duration in seconds
  timestamp: number;
  isNudge?: boolean;     // MSN Nudge
}

export interface Contact {
  username: string;     // e.g. "@bob" or "#grupo"
  addedAt: number;
  isGroup?: boolean;    // Is this a group?
}

export interface UserProfile {
  username: string;
  profileImage?: string; // Base64 avatar
  machineName?: string;  // hostname/OS
  ip?: string;           // Remote/Local IP
}

export interface OnlineStatusMap {
  [username: string]: boolean; // username -> online status
}

export interface ChatHistory {
  [contactUsername: string]: Message[];
}

