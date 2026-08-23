#!/usr/bin/env node
// ============================================
// TYREX_KSH MD - Premium WhatsApp Bot
// Bootloader - Starts the bot
// Powered by TYREX_KSH TECH
// ============================================

import dotenv from 'dotenv';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: './.env' });

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Console clear and banner
console.clear();

// Display startup banner
console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════╗
║  ████████╗██╗   ██╗██████╗ ███████╗██╗  ██╗    ██╗  ██╗███████╗██╗  ║
║  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝╚██╗██╔╝    ██║ ██╔╝██╔════╝██║  ║
║     ██║    ╚████╔╝ ██████╔╝█████╗   ╚███╔╝     █████╔╝ ███████╗██║  ║
║     ██║     ╚██╔╝  ██╔══██╗██╔══╝   ██╔██╗     ██╔═██╗ ╚════██║╚═╝  ║
║     ██║      ██║   ██║  ██║███████╗██╔╝ ██╗    ██║  ██╗███████║██╗  ║
║     ╚═╝      ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝╚═╝  ║
║                                                                      ║
║                   ███╗   ███╗██████╗                               ║
║                   ████╗ ████║██╔══██╗                              ║
║                   ██╔████╔██║██║  ██║                              ║
║                   ██║╚██╔╝██║██║  ██║                              ║
║                   ██║ ╚═╝ ██║██████╔╝                              ║
║                   ╚═╝     ╚═╝╚═════╝                               ║
║                                                                      ║
║   🧛 TYREX_KSH MD v2.0.0 - Premium WhatsApp Bot                    ║
║   ⚡ POWERED BY TYREX_KSH TECH                                       ║
║   👑 OWNER: 255650583044                                            ║
║   📢 CHANNEL: 120363424973782944@newsletter                         ║
║   👥 GROUP: https://chat.whatsapp.com/CGJQ0TGin3w4FmG3bKZ2d3       ║
╚══════════════════════════════════════════════════════════════════════╝
`));

// Check deployment mode
const DEPLOY_MODE = process.env.DEPLOY_MODE || '2';
const IS_HEROKU = DEPLOY_MODE === '1' || process.env.DYNO !== undefined;

console.log(chalk.green(`\n🚀 Booting TYREX_KSH MD...`));
console.log(chalk.blue(`📱 Mode: ${IS_HEROKU ? 'HEROKU (Auto)' : 'LOCAL (Menu)'}`));
console.log(chalk.blue(`👑 Owner: 255650583044`));
console.log(chalk.blue(`📢 Channel: 120363424973782944@newsletter`));
console.log(chalk.gray(`📁 Directory: ${__dirname}\n`));

// Import main bot module (tyrex.js)
import('./tyrex.js').catch((error) => {
    console.error(chalk.red('❌ Failed to start bot:'), error.message);
    process.exit(1);
});
