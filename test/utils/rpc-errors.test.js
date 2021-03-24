const nearApi = require('../../lib/index');
const {
    parseRpcError,
    parseRpcResultError,
    formatError,
    getErrorTypeFromErrorMessage,
} = nearApi.utils.rpc_errors;

describe('rpc-errors', () => {
    test('test AccountAlreadyExists error', async () => {
        let rpc_error = {
            TxExecutionError: {
                ActionError: {
                    index: 1,
                    kind: {AccountAlreadyExists: {account_id: 'bob.near'}}
                }
            }
        };
        let error = parseRpcError(rpc_error);
        expect(error.isSubtypeOf('TxExecutionError')).toBe(true);
        expect(error.isSubtypeOf('AccountAlreadyExists')).toBe(true);
        expect(error.index).toBe(1);
        expect(error.account_id).toBe('bob.near');
        expect(formatError(error.type, error)).toBe('Can\'t create a new account bob.near, because it already exists');
    });

    test('test ReceiverMismatch error', async () => {
        let rpc_error = {
            TxExecutionError: {
                InvalidTxError: {
                    InvalidAccessKeyError: {
                        ReceiverMismatch: {
                            ak_receiver: 'test.near',
                            tx_receiver: 'bob.near'
                        }
                    }
                }
            }
        };
        let error = parseRpcError(rpc_error);
        expect(error.isSubtypeOf('TxExecutionError')).toBe(true);
        expect(error.isSubtypeOf('InvalidTxError')).toBe(true);
        expect(error.isSubtypeOf('InvalidAccessKeyError')).toBe(true);
        expect(error.isSubtypeOf('ReceiverMismatch')).toBe(true);
        expect(error.ak_receiver).toBe('test.near');
        expect(error.tx_receiver).toBe('bob.near');
        expect(formatError(error.type, error)).toBe(
            'Wrong AccessKey used for transaction: transaction is sent to receiver_id=bob.near, but is signed with function call access key that restricted to only use with receiver_id=test.near. Either change receiver_id in your transaction or switch to use a FullAccessKey.'
        );
    });

    test('test InvalidIteratorIndex error', async () => {
        let rpc_error = {
            TxExecutionError: {
                ActionError: {
                    FunctionCallError: {
                        HostError: {
                            InvalidIteratorIndex: {iterator_index: 42}
                        }
                    }
                }
            }
        };
        let error = parseRpcError(rpc_error);
        expect(error.isSubtypeOf('TxExecutionError')).toBe(true);
        expect(error.isSubtypeOf('AccountAlreadyExists')).toBe(false);
        expect(error.isSubtypeOf('ActionError')).toBe(true);
        expect(error.isSubtypeOf('FunctionCallError')).toBe(true);
        expect(error.isSubtypeOf('HostError')).toBe(true);
        expect(error.isSubtypeOf('InvalidIteratorIndex')).toBe(true);
        expect(error.iterator_index).toBe(42);
        expect(formatError(error.type, error)).toBe('Iterator index 42 does not exist');
    });

    test('test ActionError::FunctionCallError::GasLimitExceeded error', async () => {
        let rpc_error = {
            TxExecutionError: {
                ActionError: {
                    'index': 0,
                    'kind': {
                        FunctionCallError: {
                            'HostError': 'GasLimitExceeded'
                        }
                    }
                }
            }
        };
        let error = parseRpcError(rpc_error);
        
        expect(error.isSubtypeOf('TxExecutionError')).toBe(true);
        expect(error.isSubtypeOf('ActionError')).toBe(true);
        expect(error.isSubtypeOf('FunctionCallError')).toBe(true);
        expect(error.isSubtypeOf('HostError')).toBe(true);
        expect(error.isSubtypeOf('GasLimitExceeded')).toBe(true);

        expect(formatError(error.type, error)).toBe('Exceeded the maximum amount of gas allowed to burn per contract');
    });

    // check this commit and fix: https://github.com/near/near-api-js/commit/8fa8780ab2bdfc85d63835088b89fa81ac10a920
    // test('test parse error object', async () => {
    //     const errorStr = '{"status":{"Failure":{"ActionError":{"index":0,"kind":{"FunctionCallError":{"EvmError":"ArgumentParseError"}}}}},"transaction":{"signer_id":"test.near","public_key":"ed25519:D5HVgBE8KgXkSirDE4UQ8qwieaLAR4wDDEgrPRtbbNep","nonce":110,"receiver_id":"evm","actions":[{"FunctionCall":{"method_name":"transfer","args":"888ZO7SvECKvfSCJ832LrnFXuF/QKrSGztwAAA==","gas":300000000000000,"deposit":"0"}}],"signature":"ed25519:7JtWQ2Ux63ixaKy7bTDJuRTWnv6XtgE84ejFMMjYGKdv2mLqPiCfkMqbAPt5xwLWwFdKjJniTcxWZe7FdiRWpWv","hash":"E1QorKKEh1WLJwRQSQ1pdzQN3f8yeFsQQ8CbJjnz1ZQe"},"transaction_outcome":{"proof":[],"block_hash":"HXXBPjGp65KaFtam7Xr67B8pZVGujZMZvTmVW6Fy9tXf","id":"E1QorKKEh1WLJwRQSQ1pdzQN3f8yeFsQQ8CbJjnz1ZQe","outcome":{"logs":[],"receipt_ids":["ZsKetkrZQGVTtmXr2jALgNjzcRqpoQQsk9HdLmFafeL"],"gas_burnt":2428001493624,"tokens_burnt":"2428001493624000000000","executor_id":"test.near","status":{"SuccessReceiptId":"ZsKetkrZQGVTtmXr2jALgNjzcRqpoQQsk9HdLmFafeL"}}},"receipts_outcome":[{"proof":[],"block_hash":"H6fQCVpxBDv9y2QtmTVHoxHibJvamVsHau7fDi7AmFa2","id":"ZsKetkrZQGVTtmXr2jALgNjzcRqpoQQsk9HdLmFafeL","outcome":{"logs":[],"receipt_ids":["DgRyf1Wv3ZYLFvM8b67k2yZjdmnyUUJtRkTxAwoFi3qD"],"gas_burnt":2428001493624,"tokens_burnt":"2428001493624000000000","executor_id":"evm","status":{"Failure":{"ActionError":{"index":0,"kind":{"FunctionCallError":{"EvmError":"ArgumentParseError"}}}}}}},{"proof":[],"block_hash":"9qNVA235L9XdZ8rZLBAPRNBbiGPyNnMUfpbi9WxbRdbB","id":"DgRyf1Wv3ZYLFvM8b67k2yZjdmnyUUJtRkTxAwoFi3qD","outcome":{"logs":[],"receipt_ids":[],"gas_burnt":0,"tokens_burnt":"0","executor_id":"test.near","status":{"SuccessValue":""}}}]}';
    //     const error = parseRpcError(JSON.parse(errorStr).status.Failure);
    //     expect(error).toEqual(new FunctionCallError('{"index":0,"kind":{"EvmError":"ArgumentParseError"}}'));
    // });

    test('test parseRpcResultError', async () => {
        let result =
        {
            status: {
                Failure: {
                    TxExecutionError: {
                        InvalidTxError: {
                            InvalidAccessKeyError: {
                                ReceiverMismatch: {
                                    ak_receiver: 'test.near',
                                    tx_receiver: 'bob.near'
                                }
                            }
                        }
                    }
                }
            },
        };

        let error = parseRpcResultError(result);
        expect(error.type).toBe('ReceiverMismatch');
        expect(error.ak_receiver).toBe('test.near');
        expect(error.tx_receiver).toBe('bob.near');
        expect(formatError(error.type, error)).toBe(
            'Wrong AccessKey used for transaction: transaction is sent to receiver_id=bob.near, but is signed with function call access key that restricted to only use with receiver_id=test.near. Either change receiver_id in your transaction or switch to use a FullAccessKey.'
        );
    });

    test('test JSON RPC TypedError should have errorPath in context', async () => {
        let errorPath = {
            TxExecutionError: {
                InvalidTxError: {
                    InvalidAccessKeyError: {
                        ReceiverMismatch: {
                            ak_receiver: 'test.near',
                            tx_receiver: 'bob.near'
                        }
                    }
                }
            }
        };
        let result =
        {
            status: {
                Failure: errorPath,
            },
        };

        let error = parseRpcResultError(result);
        expect(error.context.errorPath).toBe(errorPath);
    });

    test('test getErrorTypeFromErrorMessage', () => {
        const err1 = 'account random.near does not exist while viewing';
        const err2 = 'Account random2.testnet doesn\'t exist';
        const err3 = 'access key ed25519:DvXowCpBHKdbD2qutgfhG6jvBMaXyUh7DxrDSjkLxMHp does not exist while viewing';
        const err4 = 'wasm execution failed with error: FunctionCallError(CompilationError(CodeDoesNotExist { account_id: "random.testnet" }))';
        const err5 = '[-32000] Server error: Invalid transaction: Transaction nonce 1 must be larger than nonce of the used access key 1';
        expect(getErrorTypeFromErrorMessage(err1)).toEqual('AccountDoesNotExist');
        expect(getErrorTypeFromErrorMessage(err2)).toEqual('AccountDoesNotExist');
        expect(getErrorTypeFromErrorMessage(err3)).toEqual('AccessKeyDoesNotExist');
        expect(getErrorTypeFromErrorMessage(err4)).toEqual('CodeDoesNotExist');
        expect(getErrorTypeFromErrorMessage(err5)).toEqual('InvalidNonce');
        expect(getErrorTypeFromErrorMessage('random string')).toEqual('UntypedError');
        expect(getErrorTypeFromErrorMessage(undefined)).toEqual('UntypedError');
        expect(getErrorTypeFromErrorMessage('')).toEqual('UntypedError');
    });
});
