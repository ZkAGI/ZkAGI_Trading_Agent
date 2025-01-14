

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Telegraf } = require('telegraf');

const {
  Keypair,
  PublicKey,
  Connection
} = require('@solana/web3.js');

const nacl = require('tweetnacl');
const { decodeUTF8, encodeBase64 } = require('tweetnacl-util');

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const swap = require('./swap');


const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;  
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env');
  process.exit(1);
}
if (!TOTP_ENCRYPTION_KEY || TOTP_ENCRYPTION_KEY.length < 32) {
  console.error('TOTP_ENCRYPTION_KEY missing or not at least 32 bytes. Check .env');
  process.exit(1);
}


const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: '*' }));


const bot = new Telegraf(BOT_TOKEN);


const USERS_DB_FILE = 'users.json';

function loadUsers() {
  if (!fs.existsSync(USERS_DB_FILE)) {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify({}), 'utf-8');
  }
  const data = fs.readFileSync(USERS_DB_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveUsers(users) {
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2), 'utf-8');
  console.log('[SAVE USERS] Users DB updated on disk.');
}


function deriveKeyFromPIN(pin, salt) {
  // 256-bit key derived from user PIN + salt
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');
}

function encryptWithPIN(privateKeyHex, pin) {
  console.log('[ENCRYPT] Encrypting private key...');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKeyFromPIN(pin, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(privateKeyHex, 'hex', 'hex');
  encrypted += cipher.final('hex');

  console.log('[ENCRYPT] Encryption complete.');
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    salt
  };
}

function decryptWithPIN(encryptedData, ivHex, pin, salt) {
  console.log('[DECRYPT] Decrypting private key...');
  const key = deriveKeyFromPIN(pin, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'hex');
  decrypted += decipher.final('hex');

  const privateKeyBuffer = Buffer.from(decrypted, 'hex');
  if (privateKeyBuffer.length !== 64) {
    console.error('[DECRYPT] Decrypted key length is not 64 bytes!');
    throw new Error('Decrypted private key must be 64 bytes long');
  }

  console.log('[DECRYPT] Successfully decrypted the private key.');
  return privateKeyBuffer;
}

// 2FA Secret Encryption using a server key
function encryptTOTPSecret(secretBase32) {
  console.log('[2FA] Encrypting TOTP secret...');
  const key = Buffer.from(TOTP_ENCRYPTION_KEY, 'utf8');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(secretBase32, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encryptedSecret: encrypted,
    iv: iv.toString('hex'),
  };
}

function decryptTOTPSecret(encryptedSecret, ivHex) {
  console.log('[2FA] Decrypting TOTP secret...');
  const key = Buffer.from(TOTP_ENCRYPTION_KEY, 'utf8');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedSecret, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted; 
}


const userSetupStages = {}; 


const pendingSwaps = new Map(); 




bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const telegramUsername = ctx.from.username || '';
  console.log(`[BOT START] /start by user ${telegramId} (@${telegramUsername})`);

  const users = loadUsers();

 
  if (users[telegramId]) {
    const userRecord = users[telegramId];
    if (!userRecord.wallet || !userRecord.wallet.publicKey) {
      console.error(`[BOT START] User ${telegramId} record incomplete!`);
      return ctx.reply('Something seems off with your account. Please contact support.');
    }
    console.log(`[BOT START] User ${telegramId} is already registered. PK: ${userRecord.wallet.publicKey}`);
    return ctx.reply(
      `Welcome back, @${telegramUsername}!\n\n` +
      `Your Solana address: ${userRecord.wallet.publicKey}\n` +
      `Use /swap to perform a token swap, or /balance to check your balance.`
    );
  }

  
  userSetupStages[telegramId] = {
    stage: 'awaitingPin',
    telegramUsername,
  };
  console.log(`[BOT START] New user ${telegramId}. Registration flow started.`);

  return ctx.reply(
    'Welcome! To set up your account, please create a PIN.\n' +
    'Your PIN must be at least 8 characters, contain letters, numbers, and at least 1 special character.\n' +
    'Enter your desired PIN now.'
  );
});


bot.command('balance', async (ctx) => {
  const telegramId = String(ctx.from.id);
  console.log(`[BALANCE] User ${telegramId} requested balance.`);

  const users = loadUsers();
  const user = users[telegramId];

  if (!user || !user.wallet || !user.wallet.publicKey) {
    console.warn(`[BALANCE] No user record or wallet for ${telegramId}`);
    return ctx.reply('No wallet found. Use /start to register.');
  }

  const pubKeyStr = user.wallet.publicKey;
  let pubKey;
  try {
    pubKey = new PublicKey(pubKeyStr);
  } catch (error) {
    console.error('[BALANCE] Invalid public key:', error.message);
    return ctx.reply('Failed to parse your wallet public key.');
  }


  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  try {
    const balanceLamports = await connection.getBalance(pubKey);
    const balanceSol = balanceLamports / 1_000_000_000;
    console.log(`[BALANCE] User ${telegramId} balance: ${balanceSol} SOL`);
    await ctx.reply(`Your SOL balance: ${balanceSol} SOL`);
  } catch (error) {
    console.error('[BALANCE] Error:', error.message);
    await ctx.reply('Failed to fetch balance. Please try later.');
  }
});


bot.on('text', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const message = ctx.message.text.trim();
  console.log(`[TEXT] "${message}" from user ${telegramId}`);

  const users = loadUsers();

 
  if (userSetupStages[telegramId]) {
    const userStage = userSetupStages[telegramId];
    console.log(`[REG FLOW] Stage: ${userStage.stage} for ${telegramId}`);

    
    if (userStage.stage === 'awaitingPin') {
      // Validate PIN
      const pinRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
      if (!pinRegex.test(message)) {
        console.warn(`[REG FLOW] Invalid PIN from ${telegramId}`);
        return ctx.reply(
          'Invalid PIN. Must be 8+ chars, contain letters, numbers, and a special character.\nTry again.'
        );
      }

      
      console.log(`[REG FLOW] PIN accepted for ${telegramId}`);
      const pinHash = await bcrypt.hash(message, 10);
      userStage.pinHash = pinHash;
      userStage.plainPin = message;
      userStage.stage = 'awaiting2FASetup1';

      
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `MyBot (${telegramId})`,
      });
      const totpBase32 = secret.base32;
      const { encryptedSecret, iv: totpIv } = encryptTOTPSecret(totpBase32);

      userStage.tempTotpEncrypted = encryptedSecret;
      userStage.tempTotpIv = totpIv;
      console.log(`[REG FLOW] TOTP secret generated for ${telegramId} (encrypted).`);

      
      try {
        const qrBuffer = await QRCode.toBuffer(secret.otpauth_url);
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          {
            caption:
              'Scan this QR code in Google Auth (or similar), or manually enter this key:\n' +
              `\`${totpBase32}\`\nThen enter the 6-digit code to confirm setup.`,
            parse_mode: 'Markdown'
          }
        );
      } catch (err) {
        console.error('[REG FLOW] QR code error:', err.message);
        return ctx.reply('QR code generation failed. Please try again.');
      }
      return;
    }

    
    if (userStage.stage === 'awaiting2FASetup1') {
      if (!/^\d{6}$/.test(message)) {
        return ctx.reply('Please enter a valid 6-digit code from your authenticator app.');
      }

      console.log(`[REG FLOW] Verifying TOTP for ${telegramId}...`);
      const totpSecretBase32 = decryptTOTPSecret(
        userStage.tempTotpEncrypted, 
        userStage.tempTotpIv
      );

      const verified = speakeasy.totp.verify({
        secret: totpSecretBase32,
        encoding: 'base32',
        token: message,
      });

      if (!verified) {
        console.warn(`[REG FLOW] TOTP verification failed for ${telegramId}`);
        return ctx.reply('Invalid TOTP code. Please try again.');
      }

      
      console.log(`[REG FLOW] TOTP verified. Creating wallet for ${telegramId}...`);
      userStage.stage = 'complete';
      const newWallet = Keypair.generate();
      const publicKeyStr = newWallet.publicKey.toString();
      const privateKeyHex = Buffer.from(newWallet.secretKey).toString('hex');

      
      const { encryptedData, iv, salt } = encryptWithPIN(privateKeyHex, userStage.plainPin);

      
      const allUsers = loadUsers();
      allUsers[telegramId] = {
        telegramId,
        telegramUsername: userStage.telegramUsername,
        pinHash: userStage.pinHash,
        totpSecretEncrypted: userStage.tempTotpEncrypted,
        totpSecretIv: userStage.tempTotpIv,
        wallet: {
          publicKey: publicKeyStr,
          encryptedPrivateKey: encryptedData,
          iv,
          salt
        }
      };
      saveUsers(allUsers);

      
      console.log(`[REG FLOW] Registration complete for ${telegramId}. PK: ${publicKeyStr}`);
      delete userSetupStages[telegramId];
      await ctx.reply(
        `✅ 2FA setup successful!\n` +
        `Your new Solana address: *${publicKeyStr}*\n\n` +
        `Here is your **private key (hex)** (only shown once):\n\n\`${privateKeyHex}\`\n\n` +
        `Keep this private key safe!\nUse /swap to do a token swap, or /balance to check SOL.\n`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  
  if (pendingSwaps.has(telegramId)) {
    const swapState = pendingSwaps.get(telegramId);

    
    if (swapState.swapStage === 'awaitingPin') {
      const user = users[telegramId];
      if (!user || !user.pinHash) {
        await ctx.reply('No user record found, cannot authenticate.');
        pendingSwaps.delete(telegramId);
        return;
      }

      const pinMatches = await bcrypt.compare(message, user.pinHash);
      if (!pinMatches) {
        await ctx.reply('Invalid PIN. Transaction denied.');
        pendingSwaps.delete(telegramId);
        return;
      }

      
      swapState.swapStage = 'awaiting2fa';
      swapState.pinCache = message;
      await ctx.reply('PIN verified. Now enter your 2FA code (6-digit).');
      return;
    }

    
    if (swapState.swapStage === 'awaiting2fa') {
      if (!/^\d{6}$/.test(message)) {
        return ctx.reply('Please enter a valid 6-digit code from your authenticator app.');
      }

      const user = users[telegramId];
      if (!user || !user.totpSecretEncrypted || !user.totpSecretIv) {
        await ctx.reply('No 2FA data found. Cannot authenticate.');
        pendingSwaps.delete(telegramId);
        return;
      }

      
      const totpSecretBase32 = decryptTOTPSecret(user.totpSecretEncrypted, user.totpSecretIv);
      const verified = speakeasy.totp.verify({
        secret: totpSecretBase32,
        encoding: 'base32',
        token: message,
      });

      if (!verified) {
        await ctx.reply('Invalid 2FA code. Transaction denied.');
        pendingSwaps.delete(telegramId);
        return;
      }

      
      await ctx.reply('2FA verified, executing swap. Please wait...');
      try {
        const userPin = swapState.pinCache;
        const { encryptedPrivateKey, iv, salt } = user.wallet;
        const privateKeyBuf = decryptWithPIN(encryptedPrivateKey, iv, userPin, salt);
        const userKeypair = Keypair.fromSecretKey(privateKeyBuf);

        const outputMint = swapState.outputMint;
        let txid;
        try {
          txid = await swap(userKeypair, outputMint); 
        } catch (error) {
          
          if (error.message.includes('block height exceeded')) {
            console.warn('[SWAP] Blockhash expired. Retrying once...');
            txid = await swap(userKeypair, outputMint);
          } else {
            throw error;
          }
        }

        await ctx.reply(
          `Swap successful!\nTXID: ${txid}\n\n` +
          `View on Solscan: https://solscan.io/tx/${txid}`
        );
      } catch (error) {
        console.error('[SWAP] Error:', error.message);
        await ctx.reply(`Swap failed: ${error.message}`);
      } finally {
        // Clean up ephemeral swap state
        pendingSwaps.delete(telegramId);
      }
      return;
    }
  }

 
  console.log(`[TEXT] No special flow for user ${telegramId}. Ignoring.`);
});


app.post('/swap', async (req, res) => {
  const { telegramId, outputMint } = req.body;
  if (!telegramId || !outputMint) {
    return res.status(400).json({ error: 'telegramId and outputMint are required.' });
  }

  const users = loadUsers();
  const user = users[telegramId];
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

 
  pendingSwaps.set(telegramId, {
    outputMint,
    swapStage: 'awaitingPin'
  });

  try {
    await bot.telegram.sendMessage(
      telegramId,
      `Swap requested.\nOutput Mint: ${outputMint}\n\nPlease enter your PIN to approve.`
    );
    return res.json({ message: 'Swap request sent to user on Telegram.' });
  } catch (error) {
    console.error('[HTTP /swap] Error sending Telegram message:', error.message);
    return res.status(500).json({ error: 'Failed to contact user on Telegram.' });
  }
});


process.once('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received. Stopping bot...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received. Stopping bot...');
  bot.stop('SIGTERM');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on port ${PORT} and listening on 0.0.0.0`);
});

bot.launch()
  .then(() => console.log('[BOT] Telegram bot launched.'))
  .catch((err) => console.error('[BOT] Launch error:', err));
