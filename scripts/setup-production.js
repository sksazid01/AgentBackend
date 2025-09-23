#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Setup script for production environment
 * Creates the Smythos vault configuration from environment variables
 */

const setupSmythVault = () => {
    try {
        // Create the directory structure
        const vaultDir = '/tmp/.smyth/.sre';
        fs.mkdirSync(vaultDir, { recursive: true });
        
        // Create vault.json with API keys from environment variables
        const vaultConfig = {
            default: {
                echo: "",
                openai: process.env.OPENAI_API_KEY || "",
                anthropic: process.env.ANTHROPIC_API_KEY || "",
                googleai: process.env.GOOGLE_API_KEY || process.env.GOOGLEAI_API_KEY || "",
                groq: process.env.GROQ_API_KEY || "",
                togetherai: process.env.TOGETHER_API_KEY || "",
                xai: process.env.XAI_API_KEY || "",
                deepseek: process.env.DEEPSEEK_API_KEY || "",
                tavily: process.env.TAVILY_API_KEY || "",
                scrapfly: process.env.SCRAPFLY_API_KEY || ""
            }
        };
        
        const vaultPath = path.join(vaultDir, 'vault.json');
        fs.writeFileSync(vaultPath, JSON.stringify(vaultConfig, null, 2));
        
        console.log('✅ Smythos vault configuration created at:', vaultPath);
        console.log('📝 Available API keys:', Object.keys(vaultConfig.default).filter(key => vaultConfig.default[key] !== ""));
        
        // Also set up a local .smyth directory as fallback
        const localVaultDir = './.smyth/.sre';
        fs.mkdirSync(localVaultDir, { recursive: true });
        fs.writeFileSync(path.join(localVaultDir, 'vault.json'), JSON.stringify(vaultConfig, null, 2));
        console.log('✅ Local vault configuration created as fallback');
        
    } catch (error) {
        console.error('❌ Failed to setup Smythos vault:', error);
        process.exit(1);
    }
};

const main = () => {
    console.log('🚀 Setting up production environment...');
    setupSmythVault();
    console.log('✅ Production setup complete!');
};

main();