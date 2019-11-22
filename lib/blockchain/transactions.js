const Transaction = require("./transaction");
const R = require("ramda");

class Transactions extends Array {
  static fromJson(data) {
    const transactions = new Transactions();

    R.forEach((transaction) => { transactions.push(Transaction.fromJson(transaction)); }, data);
    return transactions;
  }
}

module.exports = exports = Transactions;
