import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { Chain, ClobClient } from "@polymarket/clob-client";
import type { ApiKeyCreds } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getPolymarketProxyWalletAddress } from "../utils/proxyWallet";

// Cache for ClobClient instance to avoid repeated initialization
let cachedClient: ClobClient | null = null;
let cachedConfig: { chainId: number; host: string; proxyWalletAddress?: string } | null = null;

type RawApiCreds = Partial<ApiKeyCreds> & {
    apiKey?: string;
    apiSecret?: string;
    apiPassphrase?: string;
};

function normalizeApiCreds(raw: RawApiCreds): ApiKeyCreds {
    const key = (raw.key || raw.apiKey || "").trim();
    const secretRaw = (raw.secret || raw.apiSecret || "").trim();
    const passphrase = (raw.passphrase || raw.apiPassphrase || "").trim();

    if (!key || !secretRaw || !passphrase) {
        throw new Error(
            "Invalid credential.json format. Missing key/secret/passphrase. Delete src/data/credential.json and restart to regenerate credentials."
        );
    }

    // clob-client expects standard base64; some SDK responses use base64url.
    const secret = secretRaw.replace(/-/g, "+").replace(/_/g, "/");
    return { key, secret, passphrase };
}

/**
 * Initialize ClobClient from credentials (cached singleton)
 * Prevents creating multiple ClobClient instances
 */
export async function getClobClient(): Promise<ClobClient> {
    // Load credentials
    const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    
    if (!existsSync(credentialPath)) {
        throw new Error("Credential file not found. Run createCredential() first.");
    }

    const rawCreds = JSON.parse(readFileSync(credentialPath, "utf-8")) as RawApiCreds;
    const creds = normalizeApiCreds(rawCreds);
    
    const chainId = env.CHAIN_ID as Chain;
    const host = env.CLOB_API_URL;

    // Create wallet from private key
    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found");
    }
    const wallet = new Wallet(privateKey);

    const configuredProxy = env.PROXY_WALLET_ADDRESS;
    let proxyWalletAddress = configuredProxy || undefined;
    if (!proxyWalletAddress) {
        try {
            proxyWalletAddress = await getPolymarketProxyWalletAddress(wallet.address, chainId);
            logger.info(`Auto-resolved PROXY_WALLET_ADDRESS: ${proxyWalletAddress}`);
        } catch (error) {
            logger.warn(
                `Could not auto-resolve proxy wallet: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Return cached client if config hasn't changed
    if (cachedClient && cachedConfig && 
        cachedConfig.chainId === chainId && 
        cachedConfig.host === host &&
        cachedConfig.proxyWalletAddress === proxyWalletAddress) {
        return cachedClient;
    }

    // Create and cache client
    cachedClient = new ClobClient(host, chainId, wallet, creds, 2, proxyWalletAddress);
    cachedConfig = { chainId, host, proxyWalletAddress };

    return cachedClient;
}

/**
 * Clear cached ClobClient (useful for testing or re-initialization)
 */
export function clearClobClientCache(): void {
    cachedClient = null;
    cachedConfig = null;
}