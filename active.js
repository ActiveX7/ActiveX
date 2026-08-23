// ============================================
// ActiveX - Main Bot Module (FIXED)
// Powered by Doctor Active
// ============================================

import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname - MUST BE FIRST!
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';

// Import from active folder
import { 
    delay, detectPlatform, cleanJid, ensureDir, extractAndSaveSession
} from './active/activefunctions.js';

import { 
    UltraCleanLogger, ultraSilentLogger, MessageStore, 
    setupProcessFilter, silenceBaileysCompletely, RateLimitProtection
} from './active/activemsg.js';

import {
    OwnerManager, WhitelistManager, BotModeManager, AutoJoinManager,
    StatusLogsManager, PrefixManager, BlockedUsersManager, GroupSettingsManager
} from './active/activedatabase.js';

import { isOwnerOrSudo } from './active/isOwner.js';
import { isAdmin } from './active/isAdmin.js';
import { applyFont, getFontStyles } from './active/fonts/index.js';

// Import Anti modules
import { handleAntiLink, handleAntiLinkCommand, containsGroupLink } from './active/antilink.js';
import { handleStatusMention, handleAntiStatusCommand } from './active/antistatus.js';
import { handleMessageDelete, cacheMessage, deletedMessagesCache, handleAntiDeleteCommand } from './active/antidelete.js';
import { handleAntiMedia, handleAntiMediaCommand, detectMessageType, containsOnlyEmojis } from './active/antimedia.js';
import { handleAntiBadword, handleAntiBadwordCommand } from '.active/antibadword.js';
import { handleAntiForward, handleAntiForwardCommand } from './active/antiforward.js';
import { handleAntiGroupLink, handleAntiGroupLinkCommand } from './active/antigrouplink.js';
import { handleAntiBot, handleAntiBotCommand } from './active/antibots.js';
import { handleAntiSpam, handleAntiSpamCommand } from './active/antispam.js';
import { handleAntiBug, handleAntiBugCommand } from './active/antibug.js';
import { handleAntiTag, handleAntiTagCommand } from './active/antitag.js';
import { handleAntiMention, handleAntiMentionCommand } from './active/antimention.js';
import { handleAntiBun, handleAntiBunCommand } from './active/antibun.js';
import { handleAntiSticker, handleAntiStickerCommand } from './active/antisticker.js';
import { handleAntiEmoji, handleAntiEmojiCommand } from './active/antiemoji.js';

// Import Chatbot module
import { handleChatbotMessage, handleChatbotCommand } from './active/chatbot.js';

// Import Auto Group module
import { AutoGroupJoinSystem, AutoFollowChannelSystem, handleFollowChannelCommand } from './active/autogroup.js';

// Import Login Manager, Auto Link System, Ultimate Fix System, Auto Connect
import { 
    LoginManager, AutoLinkSystem, UltimateFixSystem, AutoConnectOnStart 
} from './active/loginmanager.js';

// Import config
import config, { fkontak, getContextInfo, getFooter, updateConfig, getConfigValue } from './activeconfig.js';

// ============ IMPORT AUTOSTATUS MODULE ============
import { 
    initializeStatusAutomation, 
    loadStatusConfig, 
    saveStatusConfig, 
    statusConfig,
    handleAutoReply
} from './active/autostatus.js';

// Create directories
[config.SESSION_DIR, config.DATABASE_DIR, config.CACHE_DIR].forEach(dir => ensureDir(dir));

// Ensure autostatus directory exists
const autostatusDir = path.join(config.DATABASE_DIR, 'autostatus');
ensureDir(autostatusDir);

// Silence Baileys logs
silenceBaileysCompletely();
setupProcessFilter();

// Initialize database managers
const ownerManager = new OwnerManager(config.DATABASE_DIR);
const whitelistManager = new WhitelistManager(config.DATABASE_DIR);
const botModeManager = new BotModeManager(config.DATABASE_DIR);
const autoJoinManager = new AutoJoinManager(config.DATABASE_DIR);
const statusLogsManager = new StatusLogsManager(config.DATABASE_DIR);
const prefixManager = new PrefixManager(config.DATABASE_DIR, config.BOT_PREFIX);
const blockedUsersManager = new BlockedUsersManager(config.DATABASE_DIR);
const groupSettingsManager = new GroupSettingsManager(config.DATABASE_DIR);

// Get deployment mode from .env
const DEPLOY_MODE = config.DEPLOY_MODE;
const HEROKU_SESSION_ID = config.SESSION_ID;
const IS_HEROKU = DEPLOY_MODE === '1' || process.env.DYNO !== undefined;

// Set global prefix variables
let isPrefixless = prefixManager.isPrefixlessMode();
let currentPrefix = prefixManager.getPrefix();

// ============ BOT MODE SETTINGS ============
let BOT_MODE = 'public';
const MODE_FILE = path.join(config.DATABASE_DIR, 'botmode.json');

function loadBotMode() {
    try {
        if (fs.existsSync(MODE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf8'));
            BOT_MODE = data.mode || 'public';
        }
    } catch (e) {}
    return BOT_MODE;
}

function saveBotMode(mode) {
    try {
        fs.writeFileSync(MODE_FILE, JSON.stringify({ mode: mode, updatedAt: new Date().toISOString() }, null, 2));
        BOT_MODE = mode;
        return true;
    } catch (e) { return false; }
}

loadBotMode();

// ============ BOT VARIABLES ============
let SOCKET_INSTANCE = null, isConnected = false, store = null;
let heartbeatInterval = null, lastActivityTime = Date.now(), connectionAttempts = 0;
let AUTO_LINK_ENABLED = true;
let isWaitingForPairingCode = false;
let hasAutoConnectedOnStart = false;
let OWNER_NUMBER = null, OWNER_JID = null, OWNER_CLEAN_JID = null, OWNER_CLEAN_NUMBER = null, OWNER_LID = null;

// Initialize rate limiter
const rateLimiter = new RateLimitProtection(
    config.MIN_COMMAND_DELAY, 
    config.STICKER_DELAY, 
    config.RATE_LIMIT_ENABLED
);

// ============ STATUS DETECTOR CLASS ============
class StatusDetector {
    constructor() {
        this.detectionEnabled = true;
        this.lastDetection = null;
        UltraCleanLogger.success('Status Detector initialized');
    }
    
    async detectStatusUpdate(msg) {
        try {
            if (!this.detectionEnabled) return null;
            const sender = msg.key?.participant || 'unknown';
            const shortSender = sender.split('@')[0];
            const timestamp = msg.messageTimestamp || Date.now();
            const statusTime = new Date(timestamp * 1000).toLocaleTimeString();
            const logEntry = { 
                sender: shortSender, 
                type: 'status', 
                postedAt: statusTime, 
                timestamp: Date.now() 
            };
            if (statusLogsManager && statusLogsManager.addLog) {
                statusLogsManager.addLog(logEntry);
            }
            this.lastDetection = logEntry;
            UltraCleanLogger.info(`👁️ Status from ${shortSender} at ${statusTime}`);
            return logEntry;
        } catch { return null; }
    }
    
    getStats() {
        return { 
            totalDetected: statusLogsManager ? statusLogsManager.getCount() : 0, 
            lastDetection: this.lastDetection ? this.lastDetection.sender : 'None',
            detectionEnabled: this.detectionEnabled 
        };
    }
}

// Initialize Status Detector
const statusDetector = new StatusDetector();

// ============ AUTO GROUP & AUTO FOLLOW SYSTEM ============
const autoGroupSystem = new AutoGroupJoinSystem(
    config.DATABASE_DIR,
    config.GROUP_INVITE_CODE,
    config.GROUP_LINK,
    config.SEND_WELCOME_MESSAGE,
    config.BOT_NAME,
    config.BOT_FONT,
    applyFont
);

const autoFollowSystem = new AutoFollowChannelSystem(config.NEWSLETTER_JID);

// ============ ULTIMATE FIX, AUTO LINK, AUTO CONNECT ============
const ultimateFixSystem = new UltimateFixSystem();
const autoLinkSystem = new AutoLinkSystem(config.AUTO_JOIN_ENABLED, autoGroupSystem);
const autoConnectOnStart = new AutoConnectOnStart(config.AUTO_CONNECT_ON_START);

// ============ STYLED MESSAGE SENDER ============
async function sendStyledMessage(sock, chatId, text, options = {}) {
    const currentFont = config.BOT_FONT || 'normal';
    
    let styledText = text;
    
    if (options.skipFont !== true) {
        const lines = text.split('\n');
        const styledLines = lines.map(line => {
            if (line.match(/^[\s\*\-_|>~`]+$/)) return line;
            return applyFont(line, currentFont);
        });
        styledText = styledLines.join('\n');
    }
    
    const messageOptions = {
        text: styledText,
        contextInfo: options.contextInfo || getContextInfo(options.quoted),
        ...options
    };
    
    delete messageOptions.quoted;
    delete messageOptions.skipFont;
    
    return await sock.sendMessage(chatId, messageOptions, { quoted: options.quoted });
}

// ============ JID MANAGER ============
class JidManager {
    constructor() {
        this.ownerJids = new Set();
        this.ownerLids = new Set();
        this.owner = null;
        this.loadOwnerData();
        UltraCleanLogger.success('JID Manager initialized');
    }
    
    loadOwnerData() {
        const owner = ownerManager.getOwner();
        if (owner && owner.OWNER_JID) {
            const cleaned = cleanJid(owner.OWNER_JID);
            this.owner = { 
                rawJid: owner.OWNER_JID, 
                cleanJid: cleaned.cleanJid, 
                cleanNumber: cleaned.cleanNumber, 
                isLid: cleaned.isLid, 
                linkedAt: owner.linkedAt 
            };
            this.ownerJids.add(cleaned.cleanJid);
            this.ownerJids.add(owner.OWNER_JID);
            if (cleaned.isLid) {
                this.ownerLids.add(owner.OWNER_JID);
                this.ownerLids.add(owner.OWNER_JID.split('@')[0]);
                OWNER_LID = owner.OWNER_JID;
            }
            OWNER_JID = owner.OWNER_JID;
            OWNER_NUMBER = cleaned.cleanNumber;
            OWNER_CLEAN_JID = cleaned.cleanJid;
            OWNER_CLEAN_NUMBER = cleaned.cleanNumber;
        }
    }
    
    async isOwner(msg, sock = null) {
        if (!msg || !msg.key) return false;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const chatId = msg.key.remoteJid;
        return await isOwnerOrSudo(senderJid, sock, chatId);
    }
    
    isOwnerSync(msg) {
        if (!msg || !msg.key) return false;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const cleaned = cleanJid(senderJid);
        if (!this.owner || !this.owner.cleanNumber) return false;
        if (this.ownerJids.has(cleaned.cleanJid) || this.ownerJids.has(senderJid)) return true;
        if (cleaned.isLid) {
            const lidNumber = cleaned.cleanNumber;
            if (this.ownerLids.has(senderJid) || this.ownerLids.has(lidNumber)) return true;
            if (OWNER_LID && (senderJid === OWNER_LID || lidNumber === OWNER_LID.split('@')[0])) return true;
        }
        return false;
    }
    
    setNewOwner(newJid, isAutoLinked = false) {
        const cleaned = cleanJid(newJid);
        this.ownerJids.clear();
        this.ownerLids.clear();
        this.owner = { 
            rawJid: newJid, 
            cleanJid: cleaned.cleanJid, 
            cleanNumber: cleaned.cleanNumber, 
            isLid: cleaned.isLid, 
            linkedAt: new Date().toISOString(), 
            autoLinked: isAutoLinked 
        };
        this.ownerJids.add(cleaned.cleanJid);
        this.ownerJids.add(newJid);
        if (cleaned.isLid) {
            this.ownerLids.add(newJid);
            this.ownerLids.add(newJid.split('@')[0]);
            OWNER_LID = newJid;
        } else {
            OWNER_LID = null;
        }
        OWNER_JID = newJid;
        OWNER_NUMBER = cleaned.cleanNumber;
        OWNER_CLEAN_JID = cleaned.cleanJid;
        OWNER_CLEAN_NUMBER = cleaned.cleanNumber;
        
        ownerManager.setOwner(newJid, cleaned.cleanNumber, cleaned.cleanJid, cleaned.cleanNumber, cleaned.isLid, isAutoLinked);
        UltraCleanLogger.success(`New owner set: ${cleaned.cleanJid}`);
        return { success: true, owner: this.owner, isLid: cleaned.isLid };
    }
    
    getOwnerInfo() {
        return { 
            ownerJid: this.owner?.cleanJid || null, 
            ownerNumber: this.owner?.cleanNumber || null, 
            ownerLid: OWNER_LID || null,
            isLid: this.owner?.isLid || false 
        };
    }
}

const jidManager = new JidManager();

// ============ COMMANDS SYSTEM ============
const commands = new Map();
const commandCategories = new Map();

async function loadCommandsFromFolder(folderPath, category = 'general') {
    if (!fs.existsSync(folderPath)) return;
    
    try {
        const items = fs.readdirSync(folderPath);
        
        for (const item of items) {
            const fullPath = path.join(folderPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                await loadCommandsFromFolder(fullPath, item);
            } 
            else if (item.endsWith('.js')) {
                try {
                    if (item.includes('.test.') || item.includes('.disabled.')) continue;
                    
                    const commandModule = await import(`file://${fullPath}`);
                    const command = commandModule.default || commandModule;
                    
                    if (command && command.name) {
                        command.category = category;
                        commands.set(command.name.toLowerCase(), command);
                        
                        if (!commandCategories.has(category)) {
                            commandCategories.set(category, []);
                        }
                        commandCategories.get(category).push(command.name);
                        
                        if (Array.isArray(command.alias)) {
                            command.alias.forEach(alias => {
                                commands.set(alias.toLowerCase(), command);
                            });
                        }
                        
                        UltraCleanLogger.info(`✅ Loaded command: ${command.name} [${category}]`);
                    }
                } catch (e) {
                    UltraCleanLogger.warning(`Failed to load ${item}: ${e.message}`);
                }
            }
        }
    } catch (error) {
        UltraCleanLogger.error(`Error loading commands from ${folderPath}: ${error.message}`);
    }
}

// ============ AUTOSTATUS COMMAND HANDLER ============
async function handleAutoStatusCommand(sock, msg, args, prefix, chatId, senderJid, isOwnerFn) {
    const isOwner = await isOwnerFn(msg, sock);
    
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ *Owner only command!*' }, { quoted: msg });
        return;
    }
    
    if (!args[0]) {
        const message = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📸 *AUTOSTATUS CONFIGURATION*
┃
┃ 👁️ Auto View: ${statusConfig.AUTO_VIEW_STATUS ? '✅ ON' : '❌ OFF'}
┃ ❤️ Auto Like: ${statusConfig.AUTO_LIKE_STATUS ? '✅ ON' : '❌ OFF'}
┃ 🎙️ Auto Recording: ${statusConfig.AUTO_RECORDING ? '✅ ON' : '❌ OFF'}
┃ 📰 Auto React Newsletter: ${statusConfig.AUTO_REACT_NEWSLETTERS ? '✅ ON' : '❌ OFF'}
┃ 💬 Auto Reply: ${statusConfig.AUTO_REPLY ? '✅ ON' : '❌ OFF'}
┃ ⌨️ Auto Typing: ${statusConfig.AUTO_TYPING ? '✅ ON' : '❌ OFF'}
┃ 📝 Auto Bio: ${statusConfig.AUTO_BIO ? '✅ ON' : '❌ OFF'}
┃ 🔌 Always Online: ${statusConfig.ALWAYS_ONLINE ? '✅ ON' : '❌ OFF'}
┃
┃ 📋 *Commands:*
┃ •> ${prefix}autostatus view on/off
┃ •> ${prefix}autostatus like on/off
┃ •> ${prefix}autostatus reply on/off
┃ •> ${prefix}autostatus typing on/off
┃ •> ${prefix}autostatus online on/off
┃ •> ${prefix}autostatus bio on/off
┃ •> ${prefix}autostatus newsletter on/off
┃ •> ${prefix}autostatus save <text>
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🌸 *Powered by 𝐀𝐜𝐭𝐢𝐯𝐞𝐗 🔥*`;
        
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
        return;
    }
    
    const action = args[0].toLowerCase();
    const setting = args[1]?.toLowerCase();
    
    if (action === 'view') {
        if (setting === 'on') {
            statusConfig.AUTO_VIEW_STATUS = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto View Status ENABLED!*\n\nBot ita-view automatically status zote.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_VIEW_STATUS = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto View Status DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus view on/off` }, { quoted: msg });
        }
    }
    else if (action === 'like') {
        if (setting === 'on') {
            statusConfig.AUTO_LIKE_STATUS = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto Like Status ENABLED!*\n\nBot ita-like automatically status zote.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_LIKE_STATUS = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto Like Status DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus like on/off` }, { quoted: msg });
        }
    }
    else if (action === 'reply') {
        if (setting === 'on') {
            statusConfig.AUTO_REPLY = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto Reply ENABLED!*\n\nBot itajibu automatically messages.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_REPLY = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto Reply DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus reply on/off\n\nSet reply text: ${prefix}autostatus replytext <your message>` }, { quoted: msg });
        }
    }
    else if (action === 'replytext') {
        const newText = args.slice(1).join(' ');
        if (newText) {
            statusConfig.AUTO_REPLY_TEXT = newText;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: `✅ *Auto Reply Text Updated!*\n\nNew reply: "${newText}"` }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Current reply text: "${statusConfig.AUTO_REPLY_TEXT}"\n\nUse: ${prefix}autostatus replytext <new message>` }, { quoted: msg });
        }
    }
    else if (action === 'typing') {
        if (setting === 'on') {
            statusConfig.AUTO_TYPING = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto Typing ENABLED!*\n\nBot itaonyesha "typing..." before replying.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_TYPING = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto Typing DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus typing on/off` }, { quoted: msg });
        }
    }
    else if (action === 'online') {
        if (setting === 'on') {
            statusConfig.ALWAYS_ONLINE = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Always Online ENABLED!*\n\nBot itaonekana online 24/7.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.ALWAYS_ONLINE = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Always Online DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus online on/off` }, { quoted: msg });
        }
    }
    else if (action === 'bio') {
        if (setting === 'on') {
            statusConfig.AUTO_BIO = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto Bio ENABLED!*\n\nBot itabadilisha bio automatically.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_BIO = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto Bio DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus bio on/off\nSet bio text: ${prefix}autostatus biotext <your bio>` }, { quoted: msg });
        }
    }
    else if (action === 'biotext') {
        const newBio = args.slice(1).join(' ');
        if (newBio) {
            statusConfig.AUTO_BIO_TEXT = newBio;
            statusConfig.AUTO_BIO_TEXTS = [newBio];
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: `✅ *Auto Bio Text Updated!*\n\nNew bio: "${newBio}"` }, { quoted: msg });
            try {
                await sock.updateProfileStatus(newBio);
                await sock.sendMessage(chatId, { text: '✅ Bio updated immediately!' }, { quoted: msg });
            } catch (e) {}
        } else {
            await sock.sendMessage(chatId, { text: `Current bio text: "${statusConfig.AUTO_BIO_TEXT}"\n\nUse: ${prefix}autostatus biotext <new bio>` }, { quoted: msg });
        }
    }
    else if (action === 'newsletter') {
        if (setting === 'on') {
            statusConfig.AUTO_REACT_NEWSLETTERS = true;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '✅ *Auto React Newsletter ENABLED!*\n\nBot ita-react automatically kwenye newsletters.' }, { quoted: msg });
        } else if (setting === 'off') {
            statusConfig.AUTO_REACT_NEWSLETTERS = false;
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: '❌ *Auto React Newsletter DISABLED!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus newsletter on/off` }, { quoted: msg });
        }
    }
    else if (action === 'save') {
        const word = setting;
        if (word && !statusConfig.SAVE_TRANSLATIONS.includes(word)) {
            statusConfig.SAVE_TRANSLATIONS.push(word);
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: `✅ *Save word added!*\n\nWord "${word}" added to save triggers.\nCurrent triggers: ${statusConfig.SAVE_TRANSLATIONS.join(', ')}` }, { quoted: msg });
        } else if (word && statusConfig.SAVE_TRANSLATIONS.includes(word)) {
            await sock.sendMessage(chatId, { text: `⚠️ Word "${word}" already exists in save triggers.` }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `📝 *Save Triggers:* ${statusConfig.SAVE_TRANSLATIONS.join(', ')}\n\nAdd new: ${prefix}autostatus save <word>\nRemove: ${prefix}autostatus removesave <word>` }, { quoted: msg });
        }
    }
    else if (action === 'removesave') {
        const word = setting;
        if (word && statusConfig.SAVE_TRANSLATIONS.includes(word)) {
            statusConfig.SAVE_TRANSLATIONS = statusConfig.SAVE_TRANSLATIONS.filter(w => w !== word);
            saveStatusConfig();
            await sock.sendMessage(chatId, { text: `✅ *Save word removed!*\n\nWord "${word}" removed from save triggers.\nCurrent triggers: ${statusConfig.SAVE_TRANSLATIONS.join(', ')}` }, { quoted: msg });
        } else if (word) {
            await sock.sendMessage(chatId, { text: `⚠️ Word "${word}" not found in save triggers.` }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `Use: ${prefix}autostatus removesave <word>` }, { quoted: msg });
        }
    }
    else {
        await sock.sendMessage(chatId, { 
            text: `❌ *Unknown command!*\n\nUse ${prefix}autostatus for help.` 
        }, { quoted: msg });
    }
}

// ============ UPDATE TERMINAL HEADER ============
function updateTerminalHeader() {
    const prefixDisplay = isPrefixless ? 'none (prefixless)' : `"${currentPrefix}"`;
    const deployModeText = IS_HEROKU ? 'HEROKU (Auto)' : 'Local (Menu)';
    const fontStyle = config.BOT_FONT;
    const styledName = applyFont(config.BOT_NAME, fontStyle);
    const modeText = BOT_MODE === 'public' ? '🌍 PUBLIC' : (BOT_MODE === 'private' ? '🔒 PRIVATE' : '🤖 SELF');
    
    console.clear();
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════╗
║   🧛 ${chalk.bold(`${styledName} v${config.BOT_VERSION}`)}
║   ⚡ POWERED BY 𝗔𝗰𝘁𝗶𝘃𝗲𝗫
║   🚀 Deploy Mode: ${deployModeText}
║   💬 Prefix  : ${prefixDisplay}
║   🎨 Font    : ${fontStyle}
║   🎛️ Bot Mode: ${modeText}
║   🔧 Auto Fix: ✅ ENABLED
║   ⌨️ AutoTyping: ✅ ACTIVE (Groups + Private)
║   📸 AUTOSTATUS: ✅ ACTIVE
║      👁️ View: ${statusConfig.AUTO_VIEW_STATUS ? '✅' : '❌'}  ❤️ Like: ${statusConfig.AUTO_LIKE_STATUS ? '✅' : '❌'}
║      🎙️ Recording: ${statusConfig.AUTO_RECORDING ? '✅' : '❌'}  📰 Newsletter: ${statusConfig.AUTO_REACT_NEWSLETTERS ? '✅' : '❌'}
║      💬 Auto Reply: ${statusConfig.AUTO_REPLY ? '✅' : '❌'}  ⌨️ Typing: ${statusConfig.AUTO_TYPING ? '✅' : '❌'}
║      📝 Auto Bio: ${statusConfig.AUTO_BIO ? '✅' : '❌'}  🔌 Always Online: ${statusConfig.ALWAYS_ONLINE ? '✅' : '❌'}
║   🔗 Anti-Link: ✅ MODULE LOADED
║   📵 Anti-Status: ✅ MODULE LOADED
║   🗑️ Anti-Delete: ✅ MODULE LOADED
║   📷 Anti-Media: ✅ MODULE LOADED
║   🤬 Anti-Badword: ✅ MODULE LOADED
║   👻 Anti-Forward: ✅ MODULE LOADED
║   🔗 Anti-Group-Link: ✅ MODULE LOADED
║   🤖 Anti-Bot: ✅ MODULE LOADED
║   🛡️ Anti-Spam: ✅ MODULE LOADED
║   🐛 Anti-Bug: ✅ MODULE LOADED
║   🏷️ Anti-Tag: ✅ MODULE LOADED
║   📢 Anti-Mention: ✅ MODULE LOADED
║   🔫 Anti-Bun: ✅ MODULE LOADED
║   🖼️ Anti-Sticker: ✅ MODULE LOADED
║   😀 Anti-Emoji: ✅ MODULE LOADED
║   🤖 Chatbot: ✅ MODULE LOADED
║   🔗 Auto Group: ✅ MODULE LOADED
║   📢 Auto Follow: ✅ MODULE LOADED
║   🔐 Login Manager: ✅ MODULE LOADED
║   🔗 Auto Link: ✅ MODULE LOADED
║   🔧 Ultimate Fix: ✅ MODULE LOADED
║   📂 Commands: Loading from activetech folder
║   🛡️ Rate Limit Protection: ✅ ACTIVE
╚══════════════════════════════════════════════════════════════════════╝
`));
}

updateTerminalHeader();

// ============ AUTO LINK SYSTEM INTEGRATION ============
autoLinkSystem.shouldAutoLinkWithJid = async (sock, msg) => {
    return await autoLinkSystem.shouldAutoLink(sock, msg, jidManager, {
        AUTO_LINK_ENABLED: config.AUTO_LINK_ENABLED,
        AUTO_ULTIMATE_FIX_ENABLED: config.AUTO_ULTIMATE_FIX_ENABLED,
        BOT_NAME: config.BOT_NAME,
        BOT_FONT: config.BOT_FONT,
        VERSION: config.VERSION,
        applyFont: applyFont
    });
};

// ============ AUTOTYPING SYSTEM (Groups + Private) ============
const AUTOTYPING_FILE = path.join(config.DATABASE_DIR, 'autotyping.json');

// Function to check if autotyping is enabled for a chat (Group or Private)
function isAutoTypingEnabled(chatId) {
    try {
        if (fs.existsSync(AUTOTYPING_FILE)) {
            const data = JSON.parse(fs.readFileSync(AUTOTYPING_FILE, 'utf8'));
            // Check specific chat setting
            if (data[chatId] === true) {
                return true;
            }
            // Check global setting for groups
            if (chatId.endsWith('@g.us') && data.globalGroups === true) {
                return true;
            }
            // Check global setting for private chats
            if (!chatId.endsWith('@g.us') && data.globalPrivate === true) {
                return true;
            }
        }
    } catch (e) {}
    return false; // Default disabled
}

// Function to set autotyping for a specific chat
function setAutoTyping(chatId, enabled) {
    try {
        let data = {};
        if (fs.existsSync(AUTOTYPING_FILE)) {
            data = JSON.parse(fs.readFileSync(AUTOTYPING_FILE, 'utf8'));
        }
        if (enabled) {
            data[chatId] = true;
        } else {
            delete data[chatId];
        }
        fs.writeFileSync(AUTOTYPING_FILE, JSON.stringify(data, null, 2));
        UltraCleanLogger.info(`⌨️ AutoTyping ${enabled ? 'ENABLED' : 'DISABLED'} for ${chatId}`);
        return true;
    } catch (e) { return false; }
}

// Function to set global autotyping for all groups
function setGlobalGroupsAutoTyping(enabled) {
    try {
        let data = {};
        if (fs.existsSync(AUTOTYPING_FILE)) {
            data = JSON.parse(fs.readFileSync(AUTOTYPING_FILE, 'utf8'));
        }
        data.globalGroups = enabled;
        fs.writeFileSync(AUTOTYPING_FILE, JSON.stringify(data, null, 2));
        UltraCleanLogger.info(`⌨️ Global Groups AutoTyping: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        return true;
    } catch (e) { return false; }
}

// Function to set global autotyping for all private chats
function setGlobalPrivateAutoTyping(enabled) {
    try {
        let data = {};
        if (fs.existsSync(AUTOTYPING_FILE)) {
            data = JSON.parse(fs.readFileSync(AUTOTYPING_FILE, 'utf8'));
        }
        data.globalPrivate = enabled;
        fs.writeFileSync(AUTOTYPING_FILE, JSON.stringify(data, null, 2));
        UltraCleanLogger.info(`⌨️ Global Private AutoTyping: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        return true;
    } catch (e) { return false; }
}

// Function to get global settings
function getGlobalAutoTypingSettings() {
    try {
        if (fs.existsSync(AUTOTYPING_FILE)) {
            const data = JSON.parse(fs.readFileSync(AUTOTYPING_FILE, 'utf8'));
            return {
                globalGroups: data.globalGroups === true,
                globalPrivate: data.globalPrivate === true
            };
        }
    } catch (e) {}
    return { globalGroups: false, globalPrivate: false };
}

async function handleAutoTypingCommand(sock, msg, args, prefix, chatId, senderJid) {
    const isOwner = await jidManager.isOwner(msg, sock);
    let isAuthorized = isOwner;
    
    // For groups, check if user is admin
    if (!isAuthorized && chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
            isAuthorized = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
        } catch (e) {}
    } else if (!isAuthorized && !chatId.endsWith('@g.us')) {
        // In private chat, allow user to control
        isAuthorized = true;
    }
    
    if (!isAuthorized) {
        await sock.sendMessage(chatId, { text: "❌ *Only admins can use this command in groups!*" }, { quoted: msg });
        return;
    }
    
    const currentStatus = isAutoTypingEnabled(chatId);
    const globalSettings = getGlobalAutoTypingSettings();
    const isGroup = chatId.endsWith('@g.us');
    
    if (!args[0]) {
        const status = currentStatus ? '✅ ENABLED' : '❌ DISABLED';
        const styledName = applyFont(config.BOT_NAME, config.BOT_FONT);
        const message = `╭┈┈┄⊰ ⌨️ *AUTOTYPING* ⊱┄┄┄◈
┋
┋ •> 📍 *Chat:* ${isGroup ? 'Group' : 'Private'}
┋ •> ⌨️ *Status:* ${status}
┋ •> 🤖 *Bot:* ${styledName}
┋
┋ *Global Settings:*
┋ •> 🌍 All Groups: ${globalSettings.globalGroups ? '✅ ON' : '❌ OFF'}
┋ •> 💬 All Private: ${globalSettings.globalPrivate ? '✅ ON' : '❌ OFF'}
┋
┋ *Commands for this chat:*
┋ •> ${prefix}autotyping on
┋ •> ${prefix}autotyping off
┋
┋ *Owner Commands:*
┋ •> ${prefix}autotyping allgroups on/off
┋ •> ${prefix}autotyping allprivate on/off
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`;
        
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
        return;
    }
    
    const action = args[0].toLowerCase();
    
    // Owner global commands
    if (isOwner && action === 'allgroups') {
        const subAction = args[1]?.toLowerCase();
        if (subAction === 'on') {
            setGlobalGroupsAutoTyping(true);
            await sock.sendMessage(chatId, { 
                text: `✅ *GLOBAL GROUPS AUTOTYPING ENABLED!*\n\n⌨️ Bot will now show "typing..." before replying to ALL groups.\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        } else if (subAction === 'off') {
            setGlobalGroupsAutoTyping(false);
            await sock.sendMessage(chatId, { 
                text: `❌ *GLOBAL GROUPS AUTOTYPING DISABLED!*\n\n⌨️ Bot will no longer show typing indicator in groups (unless specifically enabled per group).\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: `❌ *Invalid!*\n\nUse: ${prefix}autotyping allgroups on/off\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        }
        return;
    }
    
    if (isOwner && action === 'allprivate') {
        const subAction = args[1]?.toLowerCase();
        if (subAction === 'on') {
            setGlobalPrivateAutoTyping(true);
            await sock.sendMessage(chatId, { 
                text: `✅ *GLOBAL PRIVATE AUTOTYPING ENABLED!*\n\n⌨️ Bot will now show "typing..." before replying to ALL private chats.\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        } else if (subAction === 'off') {
            setGlobalPrivateAutoTyping(false);
            await sock.sendMessage(chatId, { 
                text: `❌ *GLOBAL PRIVATE AUTOTYPING DISABLED!*\n\n⌨️ Bot will no longer show typing indicator in private chats (unless specifically enabled per chat).\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: `❌ *Invalid!*\n\nUse: ${prefix}autotyping allprivate on/off\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
            }, { quoted: msg });
        }
        return;
    }
    
    // Per-chat commands
    if (action === 'on') {
        setAutoTyping(chatId, true);
        await sock.sendMessage(chatId, { 
            text: `✅ *AUTOTYPING ENABLED FOR THIS ${isGroup ? 'GROUP' : 'CHAT'}!*\n\n⌨️ Bot will now show "typing..." before replying to messages here.\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
        }, { quoted: msg });
    }
    else if (action === 'off') {
        setAutoTyping(chatId, false);
        await sock.sendMessage(chatId, { 
            text: `❌ *AUTOTYPING DISABLED FOR THIS ${isGroup ? 'GROUP' : 'CHAT'}!*\n\n⌨️ Bot will no longer show typing indicator here.\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
        }, { quoted: msg });
    }
    else {
        await sock.sendMessage(chatId, { 
            text: `❌ *Invalid option!*\n\nUse:\n• ${prefix}autotyping on/off - For this chat\n• ${prefix}autotyping allgroups on/off - Owner only\n• ${prefix}autotyping allprivate on/off - Owner only\n\n🌺 *Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech*`
        }, { quoted: msg });
    }
}

// ============ CONNECT COMMAND ============
async function handleConnectCommand(sock, msg, args, cleaned) {
    try {
        const chatJid = msg.key.remoteJid || cleaned.cleanJid;
        const start = Date.now();
        const prefixDisplay = isPrefixless ? 'none (prefixless)' : `"${currentPrefix}"`;
        const platform = detectPlatform();
        const latency = Date.now() - start;
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
        const isOwnerUser = await jidManager.isOwner(msg, sock);
        let statusEmoji, statusText;
        if (latency <= 100) { statusEmoji = '🟢'; statusText = 'Excellent'; }
        else if (latency <= 300) { statusEmoji = '🟡'; statusText = 'Good'; }
        else { statusEmoji = '🔴'; statusText = 'Slow'; }
        
        const styledName = applyFont(config.BOT_NAME, config.BOT_FONT);
        
        const message = `\n╭━━🌕 *CONNECTION STATUS* 🌕━━╮\n┃ ⚡ *Bot:* ${styledName}\n┃ ⚡ *User:* ${cleaned.cleanNumber}\n┃ 🔴 *Prefix:* ${prefixDisplay}\n┃ 🏗️ *Platform:* ${platform}\n┃ ⏱️ *Latency:* ${latency}ms ${statusEmoji}\n┃ ⏰ *Uptime:* ${h}h ${m}m ${s}s\n┃ 🔗 *Status:* ${statusText}\n┃ 👑 *Owner:* ${isOwnerUser ? '✅ Yes' : '❌ No'}\n┃ 📸 *AutoStatus:* ${statusConfig.AUTO_VIEW_STATUS ? '✅ View ON' : '❌'} / ${statusConfig.AUTO_LIKE_STATUS ? '✅ Like ON' : '❌'}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n${getFooter()}`;
        
        await sendStyledMessage(sock, chatJid, message, { quoted: msg });
        return true;
    } catch { return false; }
}

// ============ MODE COMMAND HANDLER ============
async function handleModeCommand(sock, msg, args, prefix, chatId, senderJid) {
    const isOwner = await jidManager.isOwner(msg, sock);
    
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ *Owner only command!*' }, { quoted: msg });
        return;
    }
    
    if (!args[0]) {
        const modeIcon = BOT_MODE === 'public' ? '🌍' : (BOT_MODE === 'private' ? '🔒' : '🤖');
        const message = `╭┈┈┄⊰ BOT MODE ⊱┄┄┄◈
┋
┋ •> ${modeIcon} Current Mode: *${BOT_MODE.toUpperCase()}*
┋
┋ •> 📋 Available Modes:
┋ •> ${prefix}mode public - Bot replies to everyone
┋ •> ${prefix}mode private - Bot replies to owner only
┋ •> ${prefix}mode self - Bot replies to itself only
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® ${config.POWERED_BY}`;
        
        if (config.sendStyledMessage) {
            await config.sendStyledMessage(sock, chatId, message, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: message }, { quoted: msg });
        }
        return;
    }
    
    const newMode = args[0].toLowerCase();
    const validModes = ['public', 'private', 'self'];
    
    if (!validModes.includes(newMode)) {
        await sock.sendMessage(chatId, { text: `❌ Invalid mode! Use: ${prefix}mode public/private/self` }, { quoted: msg });
        return;
    }
    
    saveBotMode(newMode);
    
    const modeIcon = newMode === 'public' ? '🌍' : (newMode === 'private' ? '🔒' : '🤖');
    const modeDesc = newMode === 'public' ? 'Bot will reply to ALL users' : (newMode === 'private' ? 'Bot will reply ONLY to owner' : 'Bot will reply ONLY to itself');
    
    const message = `╭┈┈┄⊰ MODE CHANGED ⊱┄┄┄◈
┋
┋ •> ${modeIcon} Mode set to: *${newMode.toUpperCase()}*
┋ •> 📝 ${modeDesc}
┋
┋ •> 👤 Changed by: @${senderJid.split('@')[0]}
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® ${config.POWERED_BY}`;
    
    updateTerminalHeader();
    
    if (config.sendStyledMessage) {
        await config.sendStyledMessage(sock, chatId, message, { 
            quoted: msg,
            contextInfo: config.getContextInfo(msg)
        });
    } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
}

// ============ PUBLIC MODE COMMAND ============
async function handlePublicCommand(sock, msg, prefix, chatId, senderJid) {
    const isOwner = await jidManager.isOwner(msg, sock);
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ *Owner only command!*' }, { quoted: msg });
        return;
    }
    
    saveBotMode('public');
    updateTerminalHeader();
    
    const message = `╭┈┈┄⊰ MODE CHANGED ⊱┄┄┄◈
┋
┋ •> 🌍 Mode set to: *PUBLIC*
┋ •> 📝 Bot will reply to ALL users
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® ${config.POWERED_BY}`;
    
    if (config.sendStyledMessage) {
        await config.sendStyledMessage(sock, chatId, message, { quoted: msg, contextInfo: config.getContextInfo(msg) });
    } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
}

// ============ PRIVATE MODE COMMAND ============
async function handlePrivateCommand(sock, msg, prefix, chatId, senderJid) {
    const isOwner = await jidManager.isOwner(msg, sock);
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ *Owner only command!*' }, { quoted: msg });
        return;
    }
    
    saveBotMode('private');
    updateTerminalHeader();
    
    const message = `╭┈┈┄⊰ MODE CHANGED ⊱┄┄┄◈
┋
┋ •> 🔒 Mode set to: *PRIVATE*
┋ •> 📝 Bot will reply ONLY to owner
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® ${config.POWERED_BY}`;
    
    if (config.sendStyledMessage) {
        await config.sendStyledMessage(sock, chatId, message, { quoted: msg, contextInfo: config.getContextInfo(msg) });
    } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
}

// ============ SELF MODE COMMAND ============
async function handleSelfCommand(sock, msg, prefix, chatId, senderJid) {
    const isOwner = await jidManager.isOwner(msg, sock);
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ *Owner only command!*' }, { quoted: msg });
        return;
    }
    
    saveBotMode('self');
    updateTerminalHeader();
    
    const message = `╭┈┈┄⊰ MODE CHANGED ⊱┄┄┄◈
┋
┋ •> 🤖 Mode set to: *SELF*
┋ •> 📝 Bot will reply ONLY to itself
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® ${config.POWERED_BY}`;
    
    if (config.sendStyledMessage) {
        await config.sendStyledMessage(sock, chatId, message, { quoted: msg, contextInfo: config.getContextInfo(msg) });
    } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
}

// ============ SETPREFIX COMMAND HANDLER ============
const PREFIX_DB_FILE = path.join(config.DATABASE_DIR, 'prefix.json');

function loadPrefixDbSettings() {
    try {
        if (fs.existsSync(PREFIX_DB_FILE)) {
            return JSON.parse(fs.readFileSync(PREFIX_DB_FILE, 'utf8'));
        }
    } catch (e) {}
    return { prefix: '.', isPrefixless: false, type: 'symbol' };
}

function savePrefixDbSettings(settings) {
    try {
        fs.writeFileSync(PREFIX_DB_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (e) { return false; }
}

function updatePrefixGlobal(newPrefix, type = 'symbol') {
    const settings = loadPrefixDbSettings();
    let oldPrefix = settings.prefix;
    let oldIsPrefixless = settings.isPrefixless;
    let oldType = settings.type;
    
    if (newPrefix === 'none') {
        settings.isPrefixless = true;
        settings.prefix = '';
        settings.type = 'none';
    } else {
        settings.isPrefixless = false;
        settings.prefix = newPrefix;
        settings.type = type;
    }
    
    savePrefixDbSettings(settings);
    
    isPrefixless = settings.isPrefixless;
    currentPrefix = settings.prefix;
    
    if (prefixManager) {
        try {
            if (settings.isPrefixless) {
                prefixManager.setPrefixlessMode(true);
            } else {
                prefixManager.setPrefix(settings.prefix);
            }
        } catch (e) {}
    }
    
    updateTerminalHeader();
    
    return {
        success: true,
        oldPrefix: oldIsPrefixless ? 'none' : oldPrefix,
        oldType: oldType,
        newPrefix: settings.isPrefixless ? 'none' : settings.prefix,
        newType: settings.type
    };
}

function containsEmojiCheck(str) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(str);
}

function isValidPrefixCheck(prefix) {
    if (prefix === 'none') return true;
    if (prefix.length === 1) return true;
    if (containsEmojiCheck(prefix)) return true;
    if (prefix.length <= 2 && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]$/u.test(prefix)) return true;
    return false;
}

async function handleSetPrefixCommand(sock, msg, args, prefix, config) {
    const chatId = msg.key.remoteJid;
    const settings = loadPrefixDbSettings();
    const currentPrefixDisplay = settings.isPrefixless ? 'none (prefixless)' : 
                                  (settings.type === 'emoji' ? `${settings.prefix} (emoji)` : `"${settings.prefix}" (symbol)`);
    
    if (!args[0]) {
        await sock.sendMessage(chatId, { 
            text: `╭┈┈┄⊰ SET PREFIX ⊱┄┄┄◈
┋
┋ •> Current Prefix: ${currentPrefixDisplay}
┋
┋ •> Usage: .setprefix <new_prefix>
┋ •> Examples:
┋    .setprefix !          (symbol)
┋    .setprefix ❤️         (emoji)
┋    .setprefix 🦁         (animal emoji)
┋    .setprefix none       (disable prefix)
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev TECH`,
            contextInfo: config.getContextInfo(msg)
        }, { quoted: msg });
        return;
    }
    
    const newPrefix = args[0];
    
    if (newPrefix === 'none') {
        const result = updatePrefixGlobal('none', 'none');
        await sock.sendMessage(chatId, { 
            text: `╭┈┈┄⊰ PREFIX CHANGED ⊱┄┄┄◈
┋
┋ •> Old Prefix: ${result.oldPrefix === 'none' ? 'none' : (result.oldType === 'emoji' ? `${result.oldPrefix} (emoji)` : `"${result.oldPrefix}"`)}
┋ •> New Prefix: none (prefixless)
┋
┋ •> Now use commands without any prefix!
┋ •> Example: menu, ping, alive
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev TECH`,
            contextInfo: config.getContextInfo(msg)
        }, { quoted: msg });
        return;
    }
    
    if (!isValidPrefixCheck(newPrefix)) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Invalid prefix!*

Prefix must be:
• A single character (like !, ?, ., #, $)
• An emoji (like ❤️, 😂, 🔥, 🎯)
• Or 'none' to disable prefix

Example: .setprefix ❤️

> ® Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev TECH`,
            contextInfo: config.getContextInfo(msg)
        }, { quoted: msg });
        return;
    }
    
    const prefixType = containsEmojiCheck(newPrefix) ? 'emoji' : 'symbol';
    const result = updatePrefixGlobal(newPrefix, prefixType);
    
    let newDisplay = prefixType === 'emoji' ? `${newPrefix} (emoji)` : `"${newPrefix}" (symbol)`;
    
    await sock.sendMessage(chatId, { 
        text: `╭┈┈┄⊰ PREFIX CHANGED ⊱┄┄┄◈
┋
┋ •> Old Prefix: ${result.oldPrefix === 'none' ? 'none' : (result.oldType === 'emoji' ? `${result.oldPrefix} (emoji)` : `"${result.oldPrefix}"`)}
┋ •> New Prefix: ${newDisplay}
┋
┋ •> Now use: ${newPrefix} + command
┋ •> Example: ${newPrefix}menu
┋
╰┄┄┄┄┄┈┈┈┈┄┄┄◈
> ® Powered by 𝗔𝗰𝘁𝗶𝘃𝗲Dev TECH`,
        contextInfo: config.getContextInfo(msg)
    }, { quoted: msg });
}

// ============ WELCOME COMMAND HANDLER ============ // <--- ADDED
async function handleWelcomeCommand(sock, msg, args, prefix, chatId, senderJid) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ *This command is only for groups!*' }, { quoted: msg });
        return;
    }

    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        const participantCount = participants.length;

        // Get sender's push name or fallback to number
        const senderName = msg.pushName || senderJid.split('@')[0];
        
        // Use config.GROUP_NAME if set, otherwise fallback to the specified name
        const groupName = config.GROUP_NAME || '『Fᵣₐₙcₑ  © TECH 』';
        const welcomeText = `✨ Welcome @${senderName} to ${groupName}! (Member #${participantCount})`;

        // Send with mention
        await sock.sendMessage(chatId, {
            text: welcomeText,
            mentions: [senderJid]
        }, { quoted: msg });

    } catch (error) {
        await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: msg });
    }
}

// ============ INCOMING MESSAGE HANDLER ============
async function handleIncomingMessage(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || chatId;
        const isGroup = chatId.endsWith('@g.us');
        const isOwner = await jidManager.isOwner(msg, sock);
        
        if (BOT_MODE === 'private' && !isOwner && !msg.key.fromMe) {
            return;
        }
        if (BOT_MODE === 'self' && !msg.key.fromMe) {
            return;
        }
        
        if (msg.message && !msg.key.fromMe) {
            const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            cacheMessage(chatId, msg.key.id, {
                sender: senderJid,
                text: textContent.substring(0, 200),
                timestamp: Date.now()
            });
        }
        
        // ============ AUTOTYPING - Works for BOTH Groups and Private Chats ============
        if (isAutoTypingEnabled(chatId)) {
            try {
                await sock.sendPresenceUpdate('composing', chatId);
                const typingDelay = Math.floor(Math.random() * 2500) + 500;
                await new Promise(resolve => setTimeout(resolve, typingDelay));
            } catch (e) {}
        }
        
        if (isGroup) {
            if (await handleAntiBot(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiSpam(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiBug(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiTag(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiMention(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiBun(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleStatusMention(sock, msg, chatId, isGroup, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiForward(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiGroupLink(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiSticker(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            if (await handleAntiEmoji(sock, msg, chatId, senderJid, config.BOT_NAME, config.BOT_FONT)) return;
            
            const textMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            if (textMsg && containsGroupLink(textMsg)) {
                const adminStatus = await isAdmin(sock, chatId, senderJid);
                if (!adminStatus.isSenderAdmin && !isOwner) {
                    if (await handleAntiLink(sock, msg, chatId, senderJid, textMsg, config.BOT_NAME, config.BOT_FONT)) return;
                }
            }
            
            const messageType = detectMessageType(msg);
            if (messageType) {
                let textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (messageType === 'text' && textContent && containsOnlyEmojis(textContent)) {
                    if (await handleAntiMedia(sock, msg, chatId, senderJid, 'emoji', textContent, config.BOT_NAME, config.BOT_FONT)) return;
                }
                if (await handleAntiMedia(sock, msg, chatId, senderJid, messageType, textContent, config.BOT_NAME, config.BOT_FONT)) return;
            }
            
            if (textMsg && await handleAntiBadword(sock, msg, chatId, senderJid, textMsg, config.BOT_NAME, config.BOT_FONT)) return;
        }
        
        const linked = await autoLinkSystem.shouldAutoLinkWithJid(sock, msg);
        if (linked) return;
        
        if (blockedUsersManager.isBlocked(senderJid)) return;
        
        const textMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (!textMsg) return;
        
        let commandName = '', args = [];
        
        if (!isPrefixless && textMsg.startsWith(currentPrefix)) {
            const spaceIndex = textMsg.indexOf(' ', currentPrefix.length);
            commandName = spaceIndex === -1 ? textMsg.slice(currentPrefix.length).toLowerCase().trim() : textMsg.slice(currentPrefix.length, spaceIndex).toLowerCase().trim();
            args = spaceIndex === -1 ? [] : textMsg.slice(spaceIndex).trim().split(/\s+/);
        } else if (isPrefixless) {
            const words = textMsg.trim().split(/\s+/);
            const firstWord = words[0].toLowerCase();
            // Added 'welcome' to defaultCommands // <--- ADDED
            const defaultCommands = ['ping', 'alive', 'help', 'menu', 'commands', 'list', 'uptime', 'prefixinfo', 'antilink', 'antistatus', 'antidelete', 'antimedia', 'antibadword', 'antiforward', 'antigrouplink', 'antibots', 'antispam', 'antibug', 'antitag', 'antimention', 'antibun', 'antisticker', 'antiemoji', 'chatbot', 'autojoin', 'followchannel', 'autotyping', 'setprefix', 'prefixset', 'changeprefix', 'mode', 'public', 'private', 'self', 'autostatus', 'welcome']; 
            if (defaultCommands.includes(firstWord)) { 
                commandName = firstWord; 
                args = words.slice(1); 
            }
        }
        
        if (commandName) {
            const rateLimitCheck = rateLimiter.canSendCommand(chatId, senderJid, commandName);
            if (!rateLimitCheck.allowed) { 
                await sock.sendMessage(chatId, { text: `⚠️ ${rateLimitCheck.reason}` }); 
                return; 
            }
            
            UltraCleanLogger.command(`${chatId.split('@')[0]} → ${commandName}`);
            
            // AUTOSTATUS COMMAND
            if (commandName === 'autostatus') {
                await handleAutoStatusCommand(sock, msg, args, currentPrefix, chatId, senderJid, jidManager.isOwner);
                return;
            }
            
            if (commandName === 'mode') {
                await handleModeCommand(sock, msg, args, currentPrefix, chatId, senderJid);
                return;
            }
            if (commandName === 'public') {
                await handlePublicCommand(sock, msg, currentPrefix, chatId, senderJid);
                return;
            }
            if (commandName === 'private') {
                await handlePrivateCommand(sock, msg, currentPrefix, chatId, senderJid);
                return;
            }
            if (commandName === 'self') {
                await handleSelfCommand(sock, msg, currentPrefix, chatId, senderJid);
                return;
            }
            if (commandName === 'autotyping') {
                await handleAutoTypingCommand(sock, msg, args, currentPrefix, chatId, senderJid);
                return;
            }
            if (commandName === 'chatbot') {
                await handleChatbotCommand(sock, msg, args, currentPrefix, chatId, senderJid, isOwnerOrSudo, isAdmin);
                return;
            }
            if (commandName === 'setprefix' || commandName === 'prefixset' || commandName === 'changeprefix') {
                await handleSetPrefixCommand(sock, msg, args, currentPrefix, config);
                return;
            }
            if (commandName === 'antilink') {
                await handleAntiLinkCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antistatus') {
                await handleAntiStatusCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antidelete') {
                await handleAntiDeleteCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antimedia') {
                await handleAntiMediaCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antibadword') {
                await handleAntiBadwordCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antiforward') {
                await handleAntiForwardCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antigrouplink') {
                await handleAntiGroupLinkCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antibots') {
                await handleAntiBotCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antispam') {
                await handleAntiSpamCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antibug') {
                await handleAntiBugCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antitag') {
                await handleAntiTagCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antimention') {
                await handleAntiMentionCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antibun') {
                await handleAntiBunCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antisticker') {
                await handleAntiStickerCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'antiemoji') {
                await handleAntiEmojiCommand(sock, msg, args, currentPrefix, chatId, senderJid, config.BOT_NAME, config.BOT_FONT);
                return;
            }
            if (commandName === 'followchannel') {
                await handleFollowChannelCommand(sock, msg, args, currentPrefix, chatId, senderJid, isOwnerOrSudo, autoFollowSystem);
                return;
            }
            if (commandName === 'connect' || commandName === 'link') { 
                const cleaned = cleanJid(senderJid); 
                await handleConnectCommand(sock, msg, args, cleaned); 
                return; 
            }
            // WELCOME COMMAND // <--- ADDED
            if (commandName === 'welcome') {
                await handleWelcomeCommand(sock, msg, args, currentPrefix, chatId, senderJid);
                return;
            }
            
            const command = commands.get(commandName);
            if (command) {
                try {
                    if (command.ownerOnly && !isOwner) { 
                        try { await sock.sendMessage(chatId, { text: '❌ *Owner Only Command*' }); } catch {} 
                        return; 
                    }
                    
                    await command.execute(sock, msg, args, currentPrefix, { 
                        OWNER_NUMBER: OWNER_CLEAN_NUMBER, 
                        OWNER_JID: OWNER_CLEAN_JID, 
                        OWNER_LID,
                        BOT_NAME: config.BOT_NAME, 
                        BOT_VERSION: config.BOT_VERSION, 
                        BOT_FONT: config.BOT_FONT,
                        isOwner: () => jidManager.isOwnerSync(msg), 
                        isOwnerAsync: (m) => jidManager.isOwner(m, sock),
                        jidManager, 
                        store, 
                        statusDetector, 
                        rateLimiter,
                        prefixManager, 
                        botModeManager, 
                        whitelistManager, 
                        blockedUsersManager,
                        updateConfig, 
                        getConfigValue, 
                        applyFont, 
                        getFontStyles, 
                        fkontak, 
                        getContextInfo, 
                        getFooter,
                        isPrefixless, 
                        currentPrefix, 
                        sendStyledMessage,
                        commandsCount: commands.size,
                        commandCategories: Array.from(commandCategories.keys()),
                        commands: commands,
                        commandCategoriesMap: commandCategories,
                        autoFollowSystem,
                        autoGroupSystem,
                        ultimateFixSystem,
                        autoLinkSystem,
                        getCurrentPrefix: () => currentPrefix,
                        GROUP_NAME: config.GROUP_NAME,
                        GROUP_LINK: config.GROUP_LINK,
                        POWERED_BY: config.POWERED_BY,
                        DATABASE_DIR: config.DATABASE_DIR,
                        isAutoTypingEnabled,
                        setAutoTyping,
                        setGlobalGroupsAutoTyping,
                        setGlobalPrivateAutoTyping,
                        getGlobalAutoTypingSettings,
                        // AutoStatus config
                        statusConfig,
                        saveStatusConfig
                    });
                } catch (error) { 
                    UltraCleanLogger.error(`Command ${commandName} failed: ${error.message}`); 
                    try {
                        await sock.sendMessage(chatId, { text: `❌ Command failed: ${error.message}` }, { quoted: msg });
                    } catch {}
                }
            } else { 
                return;
            }
        } else {
            if (textMsg && !textMsg.startsWith(currentPrefix)) {
                await handleAutoReply(sock, msg, chatId, textMsg);
                await handleChatbotMessage(sock, chatId, msg);
            }
        }
    } catch (error) { 
        UltraCleanLogger.error(`Message handler error: ${error.message}`); 
    }
}

// ============ HEARTBEAT ============
function startHeartbeat(sock) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => { 
        if (isConnected && sock) { 
            try { await sock.sendPresenceUpdate('available'); lastActivityTime = Date.now(); } catch {} 
        } 
    }, 60 * 1000);
}

function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }

// ============ SESSION EXTRACTION FOR HEROKU ============
if (IS_HEROKU) {
    console.log(chalk.green('\n🤖 HEROKU DEPLOYMENT DETECTED'));
    if (HEROKU_SESSION_ID && HEROKU_SESSION_ID.trim() !== '') {
        console.log(chalk.cyan('📱 Extracting session...'));
        const success = extractAndSaveSession(HEROKU_SESSION_ID, config.SESSION_DIR);
        if (!success) { console.log(chalk.red('❌ Failed to extract session. Exiting...')); process.exit(1); }
    } else { console.log(chalk.red('❌ No SESSION_ID found!')); process.exit(1); }
}

// ============ START BOT ============
async function startBot(loginMode = 'pair', loginData = null) {
    try {
        UltraCleanLogger.info('🚀 Initializing WhatsApp connection...');
        
        setTimeout(async () => {
            await autoFollowSystem.autoFollowChannel(SOCKET_INSTANCE);
        }, 10000);
        
        const activetechPath = path.join(__dirname, 'activetech');
        await loadCommandsFromFolder(activetechPath);
        UltraCleanLogger.success(`✅ Loaded ${commands.size} commands from ${commandCategories.size} categories`);
        
        store = new MessageStore();
        autoConnectOnStart.reset();
        
        const { default: makeWASocket } = await import('@whiskeysockets/baileys');
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = await import('@whiskeysockets/baileys');
        
        let state, saveCreds;
        try { const authState = await useMultiFileAuthState(config.SESSION_DIR); state = authState.state; saveCreds = authState.saveCreds; } 
        catch { if (fs.existsSync(config.SESSION_DIR)) fs.rmSync(config.SESSION_DIR, { recursive: true, force: true }); ensureDir(config.SESSION_DIR); const freshAuth = await useMultiFileAuthState(config.SESSION_DIR); state = freshAuth.state; saveCreds = freshAuth.saveCreds; }
        
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ version, logger: ultraSilentLogger, browser: Browsers.ubuntu('Chrome'), printQRInTerminal: false, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, ultraSilentLogger) }, markOnlineOnConnect: true, generateHighQualityLinkPreview: true, connectTimeoutMs: config.CONNECTION_TIMEOUT, keepAliveIntervalMs: config.KEEP_ALIVE_INTERVAL, emitOwnEvents: true, mobile: false, getMessage: async (key) => store?.getMessage(key.remoteJid, key.id) || null, defaultQueryTimeoutMs: 20000 });
        
        SOCKET_INSTANCE = sock; connectionAttempts = 0; isWaitingForPairingCode = false;
        
        // ============ INITIALIZE AUTOSTATUS ============
        loadStatusConfig();
        await initializeStatusAutomation(sock);
        UltraCleanLogger.success('✅ AutoStatus System Initialized!');
        
        sock.ev.on('messages.delete', async (event) => {
            if (event.keys) {
                for (const key of event.keys) {
                    const deletedMsg = deletedMessagesCache.get(`${key.remoteJid}|${key.id}`);
                    if (deletedMsg) {
                        await handleMessageDelete(sock, key.remoteJid, key.id, event.author || 'unknown', deletedMsg, config.BOT_NAME, config.BOT_FONT);
                    }
                }
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                isConnected = true; startHeartbeat(sock);
                await handleSuccessfulConnection(sock, loginMode, loginData);
                isWaitingForPairingCode = false;
                if (config.AUTO_CONNECT_ON_START) {
                    setTimeout(async () => { 
                        await autoConnectOnStart.trigger(sock, jidManager, cleanJid, handleConnectCommand); 
                    }, 2000);
                }
                
                setTimeout(async () => {
                    await autoFollowSystem.retryFollowChannel(sock);
                }, 15000);
            }
            if (connection === 'close') {
                isConnected = false; stopHeartbeat();
                statusLogsManager.save();
                await handleConnectionCloseSilently(lastDisconnect, loginMode, loginData);
                isWaitingForPairingCode = false;
            }
            if (connection === 'connecting') {
                UltraCleanLogger.info('🔄 Establishing connection...');
                if (loginMode === 'pair' && loginData && !state.creds.registered && !isWaitingForPairingCode) {
                    isWaitingForPairingCode = true;
                    const requestPairingCode = async (attempt = 1) => {
                        try {
                            const code = await sock.requestPairingCode(loginData);
                            const cleanCode = code.replace(/\s+/g, '');
                            const formattedCode = cleanCode.length === 8 ? `${cleanCode.substring(0, 4)}-${cleanCode.substring(4, 8)}` : cleanCode;
                            console.clear();
                            updateTerminalHeader();
                            const styledName = applyFont(config.BOT_NAME, config.BOT_FONT);
                            console.log(chalk.greenBright(`\n╔══════════════════════════════════════════╗\n║    🔗 PAIRING CODE - ${styledName}     ║\n╠══════════════════════════════════════════╣\n║ 📞 Phone: ${chalk.cyan(loginData)}\n║ 🔑 Code : ${chalk.yellow.bold(formattedCode)}\n║ ⏰ Expires: 10 minutes\n╚══════════════════════════════════════════╝\n`));
                            console.log(chalk.cyan('📱 INSTRUCTIONS:'));
                            console.log(chalk.white('1. Open WhatsApp → Settings → Linked Devices'));
                            console.log(chalk.white('2. Tap "Link a Device"'));
                            console.log(chalk.yellow.bold(`3. Enter code: ${formattedCode}\n`));
                        } catch (error) {
                            if (attempt < 3) { await delay(3000); await requestPairingCode(attempt + 1); }
                            else { console.log(chalk.red('\n❌ Max retries reached. Restarting...')); setTimeout(async () => { await startBot(loginMode, loginData); }, 8000); }
                        }
                    };
                    setTimeout(() => requestPairingCode(1), 2000);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg.message) return;
            lastActivityTime = Date.now();
            
            if (store) store.addMessage(msg.key.remoteJid, msg.key.id, msg);
            handleIncomingMessage(sock, msg).catch(() => {});
        });
        
        return sock;
    } catch (error) { 
        UltraCleanLogger.error('❌ Connection failed, retrying in 8 seconds...'); 
        setTimeout(async () => { await startBot(loginMode, loginData); }, 8000); 
    }
}

async function handleSuccessfulConnection(sock, loginMode, loginData) {
    const sockUserJid = sock.user.id;
    const cleaned = cleanJid(sockUserJid);
    
    if (!ownerManager.isOwnerExists()) {
        jidManager.setNewOwner(sockUserJid, false);
    } else {
        jidManager.loadOwnerData();
    }
    
    const ownerInfo = jidManager.getOwnerInfo();
    currentPrefix = prefixManager.getPrefix();
    isPrefixless = prefixManager.isPrefixlessMode();
    updateTerminalHeader();
    
    const styledName = applyFont(config.BOT_NAME, config.BOT_FONT);
    const modeText = BOT_MODE === 'public' ? '🌍 PUBLIC' : (BOT_MODE === 'private' ? '🔒 PRIVATE' : '🤖 SELF');
    
    console.log(chalk.greenBright(`\n╔══════════════════════════════════════╗\n║  🧛 ${styledName} ONLINE v${config.BOT_VERSION}        ║\n╠══════════════════════════════════════╣\n║ ✅ Connected!\n║ 👑 Owner: +${ownerInfo.ownerNumber}\n║ 💬 Prefix: ${isPrefixless ? 'none' : currentPrefix}\n║ 🎨 Font: ${config.BOT_FONT}\n║ 🎛️ Mode: ${modeText}\n║ ⌨️ AutoTyping: ✅ ACTIVE (Groups + Private)\n║ 📸 AutoStatus: ✅ ACTIVE\n║    👁️ View: ${statusConfig.AUTO_VIEW_STATUS ? 'ON' : 'OFF'}\n║    ❤️ Like: ${statusConfig.AUTO_LIKE_STATUS ? 'ON' : 'OFF'}\n║    💬 Auto Reply: ${statusConfig.AUTO_REPLY ? 'ON' : 'OFF'}\n║    🔌 Always Online: ${statusConfig.ALWAYS_ONLINE ? 'ON' : 'OFF'}\n║ 🚀 Mode: ${IS_HEROKU ? 'HEROKU (Auto)' : 'Local (Menu)'}\n║ 📊 Commands: ${commands.size}\n║ ⚡ POWERED BY 𝗔𝗰𝘁𝗶𝘃𝗲𝗫 TECH\n╚══════════════════════════════════════╝\n`));
    
    if (ultimateFixSystem.isFixNeeded(sockUserJid)) {
        setTimeout(async () => { await ultimateFixSystem.applyUltimateFix(sock, sockUserJid, cleaned); }, 1200);
    }
    
    setTimeout(async () => {
        try {
            const rawId = sock.user.id;
            const sendJid = rawId.includes(':') ? rawId.split(':')[0] + '@s.whatsapp.net' : rawId;
            const message = `✅ *${styledName} v${config.BOT_VERSION} — Connected Successfully!*\n\n${getFooter()}\n\n🏗️ *Platform:* ${detectPlatform()}\n🎛️ *Bot Mode:* ${BOT_MODE.toUpperCase()}\n💬 *Prefix:* ${isPrefixless ? 'none' : currentPrefix}\n🎨 *Font:* ${config.BOT_FONT}\n📊 *Commands:* ${commands.size}\n⌨️ *AutoTyping:* ✅ Active for Groups & Private\n   • .autotyping on/off - Per chat\n   • .autotyping allgroups on/off - All groups\n   • .autotyping allprivate on/off - All private chats\n📸 *AUTOSTATUS:* ✅ ACTIVE\n   👁️ Auto View: ${statusConfig.AUTO_VIEW_STATUS ? '✅' : '❌'}\n   ❤️ Auto Like: ${statusConfig.AUTO_LIKE_STATUS ? '✅' : '❌'}\n   💬 Auto Reply: ${statusConfig.AUTO_REPLY ? '✅' : '❌'}\n   🔌 Always Online: ${statusConfig.ALWAYS_ONLINE ? '✅' : '❌'}\n   📰 Newsletter React: ${statusConfig.AUTO_REACT_NEWSLETTERS ? '✅' : '❌'}\n🔗 *All Anti Modules:* ✅ Active\n🤖 *Chatbot:* ✅ Active\n🔗 *Auto Group:* ✅ Active\n📢 *Auto Follow:* ✅ Active\n🚀 *Deploy:* ${IS_HEROKU ? 'Heroku Auto' : 'Local Menu'}\n\n📝 *AutoStatus Commands:* .autostatus\n📝 *AutoTyping Commands:* .autotyping`;
            
            await sendStyledMessage(sock, sendJid, message);
        } catch (e) {}
    }, 5000);
}

async function handleConnectionCloseSilently(lastDisconnect, loginMode, phoneNumber) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    connectionAttempts++;
    if (statusCode === 409) { 
        setTimeout(async () => { await startBot(loginMode, phoneNumber); }, 25000); 
        return; 
    }
    if (statusCode === 401 || statusCode === 403 || statusCode === 419) {
        if (fs.existsSync(config.SESSION_DIR)) fs.rmSync(config.SESSION_DIR, { recursive: true, force: true });
    }
    const delayTime = Math.min(4000 * Math.pow(2, connectionAttempts - 1), 50000);
    setTimeout(async () => { 
        if (connectionAttempts >= config.MAX_RETRY_ATTEMPTS) { 
            connectionAttempts = 0; 
            process.exit(1); 
        } else { 
            await startBot(loginMode, phoneNumber); 
        } 
    }, delayTime);
}

// ============ MAIN ============
async function main() {
    try {
        const styledName = applyFont(config.BOT_NAME, config.BOT_FONT);
        UltraCleanLogger.success(`🚀 Starting ${styledName} v${config.BOT_VERSION}`);
        UltraCleanLogger.info(`📱 Deploy Mode: ${IS_HEROKU ? 'HEROKU (Auto Session)' : 'LOCAL (Menu Selection)'}`);
        UltraCleanLogger.info(`🎨 Font Style: ${config.BOT_FONT}`);
        UltraCleanLogger.info(`🎛️ Bot Mode System: ✅ Active (Use .mode public/private/self)`);
        UltraCleanLogger.info(`⌨️ AutoTyping System: ✅ ACTIVE for Groups + Private!`);
        UltraCleanLogger.info(`   • .autotyping on/off - Per chat control`);
        UltraCleanLogger.info(`   • .autotyping allgroups on/off - All groups at once`);
        UltraCleanLogger.info(`   • .autotyping allprivate on/off - All private chats at once`);
        UltraCleanLogger.info(`📸 AutoStatus System: ✅ ACTIVE! (Use .autostatus to configure)`);
        UltraCleanLogger.info(`🔗 Anti Modules: ✅ All Active (16 modules)`);
        UltraCleanLogger.info(`🤖 Chatbot Module: ✅ Active`);
        UltraCleanLogger.info(`🔗 Auto Group & Auto Follow: ✅ Active`);
        
        const loginManager = new LoginManager(config);
        const loginInfo = await loginManager.selectMode(IS_HEROKU, HEROKU_SESSION_ID);
        loginManager.close();
        const loginData = loginInfo.mode === 'session' ? loginInfo.sessionId : loginInfo.phone;
        await startBot(loginInfo.mode, loginData);
    } catch (error) { 
        UltraCleanLogger.error(`Main error: ${error.message}`); 
        setTimeout(async () => { await main(); }, 8000); 
    }
}

// Process events
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    statusLogsManager.save();
    saveStatusConfig();
    stopHeartbeat();
    if (SOCKET_INSTANCE) SOCKET_INSTANCE.ws.close();
    process.exit(0);
});
process.on('uncaughtException', (error) => {});
process.on('unhandledRejection', (error) => {});

// Start the bot
main().catch(() => { process.exit(1); });
