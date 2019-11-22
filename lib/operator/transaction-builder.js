const R = require("ramda");
const CryptoUtil = require("../util/crypto-util");
const CryptoEdDSAUtil = require("../util/crypto-eddsa-util");
const ArgumentError = require("../util/argument-error");
const Transaction = require("../blockchain/transaction");

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

  from(listOfUTXO) {
    this.listOfUTXO = listOfUTXO;
    return this;
  }

  to(address, amount) {
    this.outputAddress = address;
    this.totalAmount = amount;
    return this;
  }

  change(changeAddress) {
    this.changeAddress = changeAddress;
    return this;
  }

  fee(amount) {
    this.feeAmount = amount;
    return this;
  }

  sign(secretKey) {
    this.secretKey = secretKey;
    return this;
  }

  type(type) {
    this.type = type;
  }

  build() {
    // Check required information
    if (this.listOfUTXO === null)
      throw new ArgumentError("It's necessary to inform a list of unspent output transactions.");

    if (this.outputAddress === null)
      throw new ArgumentError("It's necessary to inform the destination address.");

    if (this.totalAmount === null)
      throw new ArgumentError("It's necessary to inform the transaction value.");

    // Calculates the change amount
    const totalAmountOfUTXO = R.sum(R.pluck("amount", this.listOfUTXO));
    const changeAmount = totalAmountOfUTXO - this.totalAmount - this.feeAmount;

    // For each transaction input, calculates the hash of the input and sign the data.
    const self = this;
    const inputs = R.map((utxo) => {
      const txiHash = CryptoUtil.hash({
        transaction: utxo.transaction,
        index: utxo.index,
        address: utxo.address
      });

      utxo.signature = CryptoEdDSAUtil.signHash(CryptoEdDSAUtil.generateKeyPairFromSecret(self.secretKey), txiHash);
      return utxo;
    }, this.listOfUTXO);

    const outputs = [];

    // Add target receiver
    outputs.push({
      amount: this.totalAmount,
      address: this.outputAddress
    });

    // Add change amount
    if (changeAmount > 0) {
      outputs.push({
        amount: changeAmount,
        address: this.changeAddress
      });
    } else
      throw new ArgumentError("The sender does not have enough to pay for the transaction.");


    // The remaining value is the fee to be collected by the block's creator.

    return Transaction.fromJson({
      id: CryptoUtil.randomId(64),
      hash: null,
      type: this.type,
      data: {
        inputs: inputs,
        outputs: outputs
      }
    });
  }
}

module.exports = exports = TransactionBuilder;
