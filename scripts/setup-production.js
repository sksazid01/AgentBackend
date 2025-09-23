#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Setup script for production environment
 * Creates the Smythos vault configuration from environment variables
 */

// Load environment variables from .env file
dotenv.config();

const setupSmythVault = () => {
    try {
        console.log('🔍 Reading environment variables...');
        console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Found' : 'Missing');
        console.log('GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Found' : 'Missing');
        console.log('googleai:', process.env.googleai ? 'Found' : 'Missing');
        
        // Create the directory structure
        const vaultDir = '/tmp/.smyth/.sre';
        fs.mkdirSync(vaultDir, { recursive: true });
        
        // Create vault.json with API keys from environment variables
        const vaultConfig = {
            default: {
                echo: "",
                openai: process.env.OPENAI_API_KEY || "",
                anthropic: process.env.ANTHROPIC_API_KEY || "",
                googleai: process.env.GOOGLE_AI_API_KEY || process.env.googleai || "",
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
        console.log('📝 Configured API keys:', Object.entries(vaultConfig.default)
            .filter(([key, value]) => value !== "")
            .map(([key, value]) => `${key}: ${value.substring(0, 10)}...`)
        );
        
        // Also update the local .smyth directory
        const localVaultDir = './.smyth/.sre';
        fs.mkdirSync(localVaultDir, { recursive: true });
        fs.writeFileSync(path.join(localVaultDir, 'vault.json'), JSON.stringify(vaultConfig, null, 2));
        console.log('✅ Local vault configuration updated with environment variables');
        
    } catch (error) {
        console.error('❌ Failed to setup Smythos vault:', error);
        process.exit(1);
    }
};

const main = () => {
    console.log('🚀 Setting up Smythos vault with environment variables...');
    setupSmythVault();
    console.log('✅ Vault setup complete!');
};

main();