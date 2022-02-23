import { Account, SignAndSendTransactionOptions } from '../../account';
import { SignInOptions, Wallet, RequestSignTransactionsOptions } from '../interface';
import { accessKeyMatchesTransaction } from "../utils";
import { Near } from '../../near';
import { KeyStore } from '../../key_stores';
import { InMemorySigner } from '../../signer';
import {
    Action,
    SCHEMA,
    createTransaction
} from '../../transaction';
import { KeyPair, PublicKey } from '../../utils';
import { baseDecode } from 'borsh';
import { serialize } from 'borsh';

const LOGIN_WALLET_URL_SUFFIX = '/login/';
const LOCAL_STORAGE_KEY_SUFFIX = '_wallet_auth_key';
const PENDING_ACCESS_KEY_PREFIX = 'pending_key'; // browser storage key for a pending access key (i.e. key has been generated but we are not sure it was added yet)

export class WalletRedirect implements Wallet {

    /** @hidden */
    _walletBaseUrl: string;

    /** @hidden */
    _authDataKey: string;

    /** @hidden */
    _keyStore: KeyStore;

    /** @hidden */
    _authData: any;

    /** @hidden */
    _networkId: string;

    /** @hidden */
    _near: Near;

    constructor(near: Near, appKeyPrefix: string | null, walletBaseUrl: string) {
        this._near = near;
        const authDataKey = appKeyPrefix + LOCAL_STORAGE_KEY_SUFFIX;
        const authData = JSON.parse(window.localStorage.getItem(authDataKey));
        this._networkId = near.config.networkId;
        this._walletBaseUrl = walletBaseUrl;
        appKeyPrefix = appKeyPrefix || near.config.contractName || 'default';
        this._keyStore = (near.connection.signer as InMemorySigner).keyStore;
        this._authData = authData || { allKeys: [] };
        this._authDataKey = authDataKey;
        if (!this.isSignedIn()) {
            this._completeSignInWithAccessKey();
        }
    }

    /**
     * Redirects current page to the wallet authentication page.
     */
    async requestSignIn({ contractId, methodNames, successUrl, failureUrl }: SignInOptions): Promise<void> {
        const currentUrl = new URL(window.location.href);
        const newUrl = new URL(this._walletBaseUrl + LOGIN_WALLET_URL_SUFFIX);
        newUrl.searchParams.set('success_url', successUrl || currentUrl.href);
        newUrl.searchParams.set('failure_url', failureUrl || currentUrl.href);
        if (contractId) {
            /* Throws exception if contract account does not exist */
            const contractAccount = await this._near.account(contractId);
            await contractAccount.state();

            newUrl.searchParams.set('contract_id', contractId);
            const accessKey = KeyPair.fromRandom('ed25519');
            newUrl.searchParams.set('public_key', accessKey.getPublicKey().toString());
            await this._keyStore.setKey(this._networkId, PENDING_ACCESS_KEY_PREFIX + accessKey.getPublicKey(), accessKey);
        }

        if (methodNames) {
            methodNames.forEach(methodName => {
                newUrl.searchParams.append('methodNames', methodName);
            });
        }

        window.location.assign(newUrl.toString());
    }

    /**
     * Returns true, if authorized with the wallet.
     */
    isSignedIn(): boolean {
        return !!this._authData.accountId;
    }

    /**
     * Sign out from the current account
     */
    signOut(): boolean {
        this._authData = {};
        window.localStorage.removeItem(this._authDataKey);
        return true;
    }

    /**
     * Returns authorized Account ID.
     */
    getAccountId(): string {
        return this._authData.accountId || '';
    }

    async requestSignTransactions({ transactions, meta, callbackUrl }: RequestSignTransactionsOptions) {
        if (!this.isSignedIn()) {
            throw new Error('Can not execute requestSignTransactions() while not Signed In');
        }

        const currentUrl = new URL(window.location.href);
        const newUrl = new URL('sign', this._walletBaseUrl);

        newUrl.searchParams.set('transactions', transactions
            .map(transaction => serialize(SCHEMA, transaction))
            .map(serialized => Buffer.from(serialized).toString('base64'))
            .join(','));
        newUrl.searchParams.set('callbackUrl', callbackUrl || currentUrl.href);
        if (meta) newUrl.searchParams.set('meta', meta);

        window.location.assign(newUrl.toString());
    }

    async requestSignTransaction({
        receiverId,
        actions,
        walletMeta,
        walletCallbackUrl,
    }: SignAndSendTransactionOptions) {
        if (!this.isSignedIn()) {
            throw new Error('Can not execute requestSignTransaction() while not Signed In');
        }

        const accessKey = await this.accessKeyFromWalletForTransaction(this.getAccountId(), receiverId, actions);
        const block = await this._near.connection.provider.block({ finality: 'final' });
        const blockHash = baseDecode(block.header.hash);

        const publicKey = PublicKey.from(accessKey.public_key);
        // TODO: Cache & listen for nonce updates for given access key
        const nonce = accessKey.access_key.nonce + 1;
        const transaction = createTransaction(this.getAccountId(), publicKey, receiverId, nonce, actions, blockHash);
        await this.requestSignTransactions({
            transactions: [transaction],
            meta: walletMeta,
            callbackUrl: walletCallbackUrl
        });

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Failed to redirect to sign transaction'));
            }, 1000);
        });
    }


    /**
     * @hidden
     * Complete sign in for a given account id and public key. To be invoked by the app when getting a callback from the wallet.
     */
    async _completeSignInWithAccessKey() {
        const currentUrl = new URL(window.location.href);
        const publicKey = currentUrl.searchParams.get('public_key') || '';
        const allKeys = (currentUrl.searchParams.get('all_keys') || '').split(',');
        const accountId = currentUrl.searchParams.get('account_id') || '';
        // TODO: Handle errors during login
        if (accountId) {
            this._authData = {
                accountId,
                allKeys
            };
            window.localStorage.setItem(this._authDataKey, JSON.stringify(this._authData));
            if (publicKey) {
                await this._moveKeyFromTempToPermanent(accountId, publicKey);
            }
        }
        currentUrl.searchParams.delete('public_key');
        currentUrl.searchParams.delete('all_keys');
        currentUrl.searchParams.delete('account_id');
        currentUrl.searchParams.delete('meta');
        currentUrl.searchParams.delete('transactionHashes');

        window.history.replaceState({}, document.title, currentUrl.toString());
    }

    /**
     * @hidden
     * @param accountId The NEAR account owning the given public key
     * @param publicKey The public key being set to the key store
     */
    async _moveKeyFromTempToPermanent(accountId: string, publicKey: string) {
        const keyPair = await this._keyStore.getKey(this._networkId, PENDING_ACCESS_KEY_PREFIX + publicKey);
        await this._keyStore.setKey(this._networkId, accountId, keyPair);
        await this._keyStore.removeKey(this._networkId, PENDING_ACCESS_KEY_PREFIX + publicKey);
    }

    /**
     * @hidden
     * Helper function returning the access key (if it exists) to the receiver that grants the designated permission
     * @param accountId
     * @param receiverId The NEAR account seeking the access key for a transaction
     * @param actions The action(s) sought to gain access to
     * @returns Promise<any>
     */
    async accessKeyFromWalletForTransaction(accountId: string, receiverId: string, actions: Action[]): Promise<any> {
        //TODO: what is the differance between accountId and recieverId here?
        const account = new Account(this._near.connection, accountId);
        const accessKeys = await account.getAccessKeys();
        const walletKeys = this._authData.allKeys;
        for (const accessKey of accessKeys) {
            if (walletKeys.indexOf(accessKey.public_key) !== -1 && await accessKeyMatchesTransaction(accountId, accessKey, receiverId, actions)) {
                return accessKey;
            }
        }

        return null;
    }
}
