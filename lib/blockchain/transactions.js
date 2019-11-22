"use strict";



//  P A C K A G E

const R = require("ramda");

//  U T I L

const Transaction = require("./transaction");



//  P R O G R A M

class Transactions extends Array {
  static fromJson(data) {
    const transactions = new Transactions();

    R.forEach(transaction => { transactions.push(Transaction.fromJson(transaction)); }, data);
    return transactions;
  }
}



//  E X P O R T

module.exports = exports = Transactions;
