"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L S

import Config from "../config.js";
import CryptoEDDSAUtil from "../util/crypto-eddsa-util.js";
import CryptoUtil from "../util/crypto-util.js";
import TransactionAssertionError from "./transaction-assertion-error.js";



//  P R O G R A M

class Transaction {
  construct() {
    this.id = null;
    this.hash = null;
    this.type = null;
    this.data = {
      inputs: [],
      outputs: []
    };
  }

  static fromJson(data) {
    const transaction = new Transaction();

    R.forEachObjIndexed((value, key) => { transaction[key] = value; }, data);
    transaction.hash = transaction.toHash();
    return transaction;
  }

  check() {
    // Check if the transaction hash is correct
    const isTransactionHashValid = this.hash === this.toHash();

    if (!isTransactionHashValid) {
      console.error(`Invalid transaction hash "${this.hash}"`);
      throw new TransactionAssertionError(`Invalid transaction hash "${this.hash}"`, this);
    }

    // Check if the signature of all input transactions are correct (transaction data is signed by the public key of the address)
    R.map(txInput => {
      const txInputHash = CryptoUtil.hash({
        address: txInput.address,
        index: txInput.index,
        transaction: txInput.transaction
      });

      const isValidSignature = CryptoEDDSAUtil.verifySignature(txInput.address, txInput.signature, txInputHash);

      if (!isValidSignature) {
        console.error(`Invalid transaction input signature "${JSON.stringify(txInput)}"`);
        throw new TransactionAssertionError(`Invalid transaction input signature "${JSON.stringify(txInput)}"`, txInput);
      }
    }, this.data.inputs);


    if (this.type === "regular") {
      const outputsLen = this.data.outputs.length;

      // Check if the sum of input transactions are greater than output transactions, it needs to leave some room for the transaction fee

      const sumOfInputsAmount = R.sum(
        R.map(
          R.prop("amount"),
          this.data.inputs
        )
      );

      const sumOfOutputsAmount = R.sum(
        R.map(
          R.prop("amount"),
          this.data.outputs
        )
      );

      let negativeOutputsFound = 0;
      let i = 0;

      // Check for negative outputs
      for (i = 0; i < outputsLen; i++) {
        if (this.data.outputs[i].amount < 0)
          negativeOutputsFound++;
      }

      const isInputsAmountGreaterOrEqualThanOutputsAmount = R.gte(sumOfInputsAmount, sumOfOutputsAmount);

      if (!isInputsAmountGreaterOrEqualThanOutputsAmount) {
        console.error(`Invalid transaction balance: inputs sum "${sumOfInputsAmount}", outputs sum "${sumOfOutputsAmount}"`);

        throw new TransactionAssertionError(
          `Invalid transaction balance: inputs sum "${sumOfInputsAmount}", outputs sum "${sumOfOutputsAmount}"`, {
            sumOfInputsAmount,
            sumOfOutputsAmount
          }
        );
      }

      const isEnoughFee = (sumOfInputsAmount - sumOfOutputsAmount) >= Config.FEE_PER_TRANSACTION; // 1 because the fee is 1 satoshi per transaction

      if (!isEnoughFee) {
        console.error(`Not enough fee: expected "${Config.FEE_PER_TRANSACTION}" got "${(sumOfInputsAmount - sumOfOutputsAmount)}"`);

        throw new TransactionAssertionError(
          `Not enough fee: expected "${Config.FEE_PER_TRANSACTION}" got "${(sumOfInputsAmount - sumOfOutputsAmount)}"`, {
            sumOfInputsAmount,
            sumOfOutputsAmount,
            FEE_PER_TRANSACTION: Config.FEE_PER_TRANSACTION
          }
        );
      }

      if (negativeOutputsFound > 0) {
        console.error(`Transaction is either empty or negative, output(s) caught: "${negativeOutputsFound}"`);
        throw new TransactionAssertionError(`Transaction is either empty or negative, output(s) caught: "${negativeOutputsFound}"`);
      }
    }

    return true;
  }

  toHash() {
    // INFO: There are different implementations of the hash algorithm, for example: https://en.bitcoin.it/wiki/Hashcash
    return CryptoUtil.hash(this.id + this.type + JSON.stringify(this.data));
  }
}



//  E X P O R T

export default Transaction;



// Transaction structure:
// { // Transaction
//   "data": {
//     "inputs": [ // Transaction inputs
//       {
//         "address": "dda3ce5aa5...b409bf3fdc", // from address (64 bytes)
//         "amount": 5000000000, // amount of satoshis
//         "index": "0", // index of the transaction taken from a previous unspent transaction output
//         "signature": "27d911cac0...6486adbf05", // transaction input hash: sha256 (transaction + index + amount + address) signed with owner address's secret key (128 bytes)
//         "transaction": "9e765ad30c...e908b32f0c" // transaction hash taken from a previous unspent transaction output (64 bytes)
//       }
//     ],
//     "outputs": [ // Transaction outputs
//       {
//         "address": "4f8293356d...b53e8c5b25", // to address (64 bytes)
//         "amount": 10000 // amount of satoshis
//       },
//       {
//         "address": "dda3ce5aa5...b409bf3fdc", // change address (64 bytes)
//         "amount": 4999989999 // amount of satoshis
//       }
//     ]
//   },
//   "hash": "f697d4ae63...c1e85f0ac3", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
//   "id": "84286bba8d...7477efdae1", // random id (64 bytes)
//   "type": "regular", // transaction type (regular, fee, reward)
// }
