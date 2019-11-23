"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L

import Transaction from "./transaction";



//  P R O G R A M

class Transactions extends Array {
  static fromJson(data) {
    const transactions = new Transactions();

    R.forEach(transaction => { transactions.push(Transaction.fromJson(transaction)); }, data);
    return transactions;
  }
}



//  E X P O R T

export default Transactions;
