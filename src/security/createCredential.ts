import { ApiKeyCreds, ClobClient, Chain } from "@polymarket/clob-client";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Wallet } from "@ethersproject/wallet";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { getPolymarketProxyWalletAddress } from "../utils/proxyWallet";

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
        throw new Error("Credential creation returned invalid key/secret/passphrase");
    }

    const secret = secretRaw.replace(/-/g, "+").replace(/_/g, "/");
    return { key, secret, passphrase };
}

export async function createCredential(): Promise<ApiKeyCreds | null> {
    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        logger.error("PRIVATE_KEY not found");
        return null;
    }

    // Check if credentials already exist
    // const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    // if (existsSync(credentialPath)) {
    //     logger.info("Credentials already exist. Returning existing credentials.");
    //     return JSON.parse(readFileSync(credentialPath, "utf-8"));
    // }

    try {
        const wallet = new Wallet(privateKey);
        logger.info(`Wallet address: ${wallet.address}`);
        const chainId = env.CHAIN_ID as Chain;
        const host = env.CLOB_API_URL;

        const configuredProxy = env.PROXY_WALLET_ADDRESS;
        let proxyWalletAddress = configuredProxy || undefined;
        if (!proxyWalletAddress) {
            try {
                proxyWalletAddress = await getPolymarketProxyWalletAddress(wallet.address, chainId);
                logger.info(`Auto-resolved PROXY_WALLET_ADDRESS: ${proxyWalletAddress}`);
            } catch (error) {
                logger.warn(
                    `Could not auto-resolve proxy wallet during credential creation: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // Use the same signature/proxy context as the runtime trading client.
        const clobClient = new ClobClient(host, chainId, wallet, undefined, 2, proxyWalletAddress);
        const rawCredential = (await clobClient.createOrDeriveApiKey()) as RawApiCreds;
        const credential = normalizeApiCreds(rawCredential);
        
        await saveCredential(credential);
        logger.success("Credential created successfully");
        return credential;
    } catch (error) {
        logger.error(`Error creating credential: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}   

export async function saveCredential(credential: ApiKeyCreds) {
    const credentialPath = resolve(process.cwd(), "src/data/credential.json");
    writeFileSync(credentialPath, JSON.stringify(credential, null, 2));
}