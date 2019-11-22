"use strict";



//  P A C K A G E

const R = require("ramda");

//  U T I L S

const ArgumentError = require("../util/argument-error");
const CryptoEDDSAUtil = require("../util/crypto-eddsa-util");
const CryptoUtil = require("../util/crypto-util");
const Transaction = require("../blockchain/transaction");



//  P R O G R A M

class TransactionBuilder {
  constructor() {
    this.listOfUTXO = null;
    this.outputAddresses = null;
    this.totalAmount = null;
    this.changeAddress = null;
    this.feeAmount = 0;
    this.secretKey = null;
    this.type = "regular";
  }

  build() {
    // Check required information
    if (this.listOfUTXO === null)
      throw new ArgumentError("It is necessary to inform a list of unspent output transactions.");

    if (this.outputAddress === null)
      throw new ArgumentError("It is necessary to inform the destination address.");

    if (this.totalAmount === null)
      throw new ArgumentError("It is necessary to inform the transaction value.");

    // Calculates the change amount
    const totalAmountOfUTXO = R.sum(R.pluck("amount", this.listOfUTXO));
    const changeAmount = totalAmountOfUTXO - this.totalAmount - this.feeAmount;

    // For each transaction input, calculates the hash of the input and sign the data.
    const self = this;

    const inputs = R.map(utxo => {
      const txiHash = CryptoUtil.hash({
        address: utxo.address,
        index: utxo.index,
        transaction: utxo.transaction
      });

      utxo.signature = CryptoEDDSAUtil.signHash(CryptoEDDSAUtil.generateKeyPairFromSecret(self.secretKey), txiHash);
      return utxo;
    }, this.listOfUTXO);

    const outputs = [];

    // Add target receiver
    outputs.push({
      address: this.outputAddress,
      amount: this.totalAmount
    });

    // Add change amount
    if (changeAmount > 0) {
      outputs.push({
        address: this.changeAddress,
        amount: changeAmount
      });
    } else throw new ArgumentError("The sender does not have enough to pay for the transaction.");

    // The remaining value is the fee to be collected by the block's creator.

    return Transaction.fromJson({
      data: {
        inputs: inputs,
        outputs: outputs
      },
      hash: null,
      id: CryptoUtil.randomId(64),
      type: this.type
    });
  }

  change(changeAddress) {
    this.changeAddress = changeAddress;
    return this;
  }

  fee(amount) {
    this.feeAmount = amount;
    return this;
  }

  from(listOfUTXO) {
    this.listOfUTXO = listOfUTXO;
    return this;
  }

  sign(secretKey) {
    this.secretKey = secretKey;
    return this;
  }

  to(address, amount) {
    this.outputAddress = address;
    this.totalAmount = amount;
    return this;
  }

  type(type) {
    this.type = type;
  }
}



//  E X P O R T

module.exports = exports = TransactionBuilder;
