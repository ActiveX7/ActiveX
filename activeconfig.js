// ============================================
// ActiveX CONFIG - Bot Configuration
// Powered by ActiveDev Tech
// ============================================

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'database', 'config.json');

// ============ DEFAULT CONFIGURATION ============
const defaultConfig = {
    // Bot Identity
    BOT_NAME: '𝗔𝗰𝘁𝗶𝘃𝗲𝗫',
    BOT_VERSION: '3.1.1',
    BOT_PREFIX: '.',
    
    // Font Style
    BOT_FONT: 'bold',
    
    // Footer Text
    FOOTER_TEXT: '©𝐀𝐜𝐭𝐢𝐯𝐞𝐗 🔥',
    POWERED_BY: '𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐛𝐲 𝗔𝗰𝘁𝗶𝘃𝗲Dev 𝐓𝐞𝐜𝐡',
    
    // Newsletter/Channel
    NEWSLETTER_JID: '120363424973782944@newsletter',
    NEWSLETTER_NAME: '𝗔𝗰𝘁𝗶𝘃𝗲Dev Tech',
    
    // Menu Image URL (for menu command)
    MENU_IMAGE_URL: 'https://url.bmbxmd.workers.dev/5CEOR.jpg',
    
    // Media
    BOT_AVATAR_URL: 'https://url.bmbxmd.workers.dev/WCZMJ.jpg',
    BOT_THUMBNAIL_URL: 'https://url.bmbxmd.workers.dev/5CEOR.jpg',
    
    // Groups
    GROUP_LINK: 'https://chat.whatsapp.com/LvNADQTdtLQCBu2JNZ2iML',
    GROUP_NAME: 'ActiveDev Headquarters',
    GROUP_INVITE_CODE: 'LvNADQTdtLQCBu2JNZ2iML',
    
    // Owner
    OWNER_NUMBER: '255625316099',
    OWNER_NAME: 'Doctor 𝗔𝗰𝘁𝗶𝘃𝗲',
    
    // Features
    AUTO_JOIN_ENABLED: true,
    AUTO_VIEW_STATUS: true,
    AUTO_REACT_STATUS: true,
    RATE_LIMIT_ENABLED: true,
    AUTO_CONNECT_ON_LINK: true,
    AUTO_CONNECT_ON_START: true,
    SEND_WELCOME_MESSAGE: true,
    
    // Timeout Settings
    MIN_COMMAND_DELAY: 1000,
    STICKER_DELAY: 2000,
    CONNECTION_TIMEOUT: 40000,
    KEEP_ALIVE_INTERVAL: 15000,
    
    // Max retry attempts
    MAX_RETRY_ATTEMPTS: 10,
    
    // Directories
    SESSION_DIR: './database/sessions',
    DATABASE_DIR: './database',
    CACHE_DIR: './database/cache',
    COMMANDS_DIR: './tyrextech',  // Changed from commands to tyrextech
    FONTS_DIR: './fonts',
    
    // Deployment
    DEPLOY_MODE: process.env.DEPLOY_MODE || '2',
    SESSION_ID: process.env.SESSION_ID || '',
};

// ============ CONFIG INSTANCE ============
let config = { ...defaultConfig };

// ============ LOAD CONFIG FROM DATABASE ============
function loadConfigFromDatabase() {
    try {
        // Ensure directory exists
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        if (fs.existsSync(CONFIG_FILE)) {
            const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config = { ...defaultConfig, ...savedConfig };
            console.log('✅ Config loaded from database');
            console.log(`🤖 Bot Name: ${config.BOT_NAME}`);
            console.log(`📢 Channel JID: ${config.NEWSLETTER_JID}`);
            console.log(`👤 Owner: ${config.OWNER_NAME} (${config.OWNER_NUMBER})`);
            console.log(`👥 Group: ${config.GROUP_NAME}`);
            console.log(`📁 Commands Dir: ${config.COMMANDS_DIR}`);
        } else {
            // Save default config
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            config = { ...defaultConfig };
            console.log('✅ Default config created');
            console.log(`👤 Owner: ${config.OWNER_NAME} (${config.OWNER_NUMBER})`);
            console.log(`👥 Group: ${config.GROUP_NAME}`);
        }
    } catch (error) {
        console.error('Error loading config:', error.message);
        config = { ...defaultConfig };
    }
    return config;
}

// ============ SAVE CONFIG TO DATABASE ============
function saveConfigToDatabase() {
    try {
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving config:', error.message);
        return false;
    }
}

// Load config on module load
loadConfigFromDatabase();

// ============ CONFIG UPDATE FUNCTION ============
export function updateConfig(key, value) {
    if (config.hasOwnProperty(key)) {
        const oldValue = config[key];
        config[key] = value;
        
        // Also update process.env for compatibility
        if (process.env[key] !== undefined) {
            process.env[key] = value;
        }
        
        // Save to database
        saveConfigToDatabase();
        
        return { success: true, key, oldValue, newValue: value };
    }
    return { success: false, error: `Config key '${key}' not found` };
}

export function getConfig() {
    return { ...config };
}

export function getConfigValue(key) {
    return config[key] !== undefined ? config[key] : null;
}

export function reloadConfig() {
    return loadConfigFromDatabase();
}

// ============ GET CURRENT PREFIX ============
let currentPrefix = config.BOT_PREFIX;
let isPrefixless = false;

export function setPrefix(prefix) {
    currentPrefix = prefix;
    if (prefix === '') {
        isPrefixless = true;
    } else {
        isPrefixless = false;
    }
    updateConfig('BOT_PREFIX', prefix);
    return { prefix, isPrefixless };
}

export function getCurrentPrefix() {
    return currentPrefix;
}

export function getIsPrefixless() {
    return isPrefixless;
}

// ============ CONTACT KEY FOR MESSAGES ============
export const fkontak = {
    "key": {
        "participant": '0@s.whatsapp.net',
        "remoteJid": '0@s.whatsapp.net',
        "fromMe": false,
        "id": "Halo"
    },
    "message": {
        "conversation": config.BOT_NAME || "𝐓𝐘𝐑𝐄𝐗 𝐊𝐒𝐇 𝐌𝐃"
    }
};

// ============ GET CONTEXT INFO ============
export const getContextInfo = (msg, customBotName = null) => {
    const botName = customBotName || config.BOT_NAME;
    const sender = msg?.key?.participant || msg?.key?.remoteJid || '';
    
    return {
        mentionedJid: sender ? [sender] : [],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.NEWSLETTER_JID,
            newsletterName: config.NEWSLETTER_NAME || botName,
            serverMessageId: 143,
        },
        externalAdReply: {
            title: `👑 ${botName}`,
            body: config.FOOTER_TEXT || '',
            mediaType: 1,
            previewType: 0,
            thumbnailUrl: config.BOT_THUMBNAIL_URL,
            sourceUrl: `https://wa.me/${config.OWNER_NUMBER}`,
            renderLargerThumbnail: false,
        }
    };
};

// ============ GET STYLED TEXT ============
export function getStyledText(text, font = config.BOT_FONT) {
    const fonts = {
        'bold': `*${text}*`,
        'italic': `_${text}_`,
        'mono': `\`${text}\``,
        'bolditalic': `_*${text}*_`,
    };
    return fonts[font] || `*${text}*`;
}

// ============ GET FOOTER ============
export const getFooter = () => {
    return `> ® ${config.POWERED_BY}`;
};

// ============ CHECK IF OWNER ============
export function isOwner(number) {
    const cleanNumber = number?.toString().replace(/[^0-9]/g, '') || '';
    const ownerClean = config.OWNER_NUMBER.toString().replace(/[^0-9]/g, '');
    return cleanNumber === ownerClean;
}

// ============ CHECK IF GROUP ============
export function isGroup(jid) {
    return jid?.includes('@g.us') || false;
}

// ============ GET BOT INFO ============
export function getBotInfo() {
    return {
        name: config.BOT_NAME,
        version: config.BOT_VERSION,
        prefix: currentPrefix,
        owner: config.OWNER_NUMBER,
        ownerName: config.OWNER_NAME,
        groupLink: config.GROUP_LINK,
        groupName: config.GROUP_NAME,
        newsletterJid: config.NEWSLETTER_JID,
        menuImage: config.MENU_IMAGE_URL,
    };
}

// Export config as default
export default config;
