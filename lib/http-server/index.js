"use strict";



//  N A T I V E

import path from "path";

//  I M P O R T S

import bodyParser from "body-parser";
import express from "express";
import R from "ramda";
import timeago from "timeago.js";
// import swaggerUi from "swagger-ui-express";

//  U T I L S

import ArgumentError from "../util/argument-error.js";
import Block from "../blockchain/block.js";
import BlockAssertionError from "../blockchain/block-assertion-error.js";
import CryptoUtil from "../util/crypto-util.js";
import HTTPError from "./http-error.js";
// import swaggerDocument from "./swagger.json";
import Transaction from "../blockchain/transaction.js";
import TransactionAssertionError from "../blockchain/transaction-assertion-error.js";



//  P R O G R A M

class HttpServer {
  constructor(node, blockchain, operator, miner) {
    this.app = express();

    const projectWallet = wallet => {
      return {
        addresses: R.map(keyPair => {
          return keyPair.publicKey;
        }, wallet.keyPairs),
        id: wallet.id
      };
    };

    this.app.use(bodyParser.json());
    this.app.set("view engine", "pug");
    this.app.set("views", path.join(__dirname, "views"));

    this.app.locals.formatters = {
      amount: amount => amount.toLocaleString(),
      hash: hashString => {
        return hashString !== "0" ?
          `${hashString.substr(0, 5)}...${hashString.substr(hashString.length - 5, 5)}` :
          "<empty>";
      },
      time: rawTime => {
        const timeInMS = new Date(rawTime * 1000);

        return `${timeInMS.toLocaleString()} - ${timeago().format(timeInMS)}`;
      }
    };

    // this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    this.app.get("/blockchain", (req, res) => {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        res.render("blockchain/index.pug", {
          blocks: blockchain.getAllBlocks(),
          pageTitle: "Blockchain"
        });
      } else throw new HTTPError(400, "Accept content not supported");
    });

    this.app.get("/blockchain/blocks", (req, res) => {
      res.status(200).send(blockchain.getAllBlocks());
    });

    this.app.get("/blockchain/blocks/latest", (req, res) => {
      const lastBlock = blockchain.getLastBlock();

      if (lastBlock === null)
        throw new HTTPError(404, "Last block not found");

      res.status(200).send(lastBlock);
    });

    this.app.put("/blockchain/blocks/latest", (req, res) => {
      const requestBlock = Block.fromJson(req.body);
      const result = node.checkReceivedBlock(requestBlock);

      if (result === null)
        res.status(200).send("Requesting the blockchain to check.");
      else if (result)
        res.status(200).send(requestBlock);
      else
        throw new HTTPError(409, "Blockchain is update.");
    });

    this.app.get("/blockchain/blocks/:hash([a-zA-Z0-9]{64})", (req, res) => {
      const blockFound = blockchain.getBlockByHash(req.params.hash);

      if (blockFound === null)
        throw new HTTPError(404, `Block not found with hash "${req.params.hash}"`);

      res.status(200).send(blockFound);
    });

    this.app.get("/blockchain/blocks/:index", (req, res) => {
      const blockFound = blockchain.getBlockByIndex(parseInt(req.params.index));

      if (blockFound === null)
        throw new HTTPError(404, `Block not found with index "${req.params.index}"`);

      res.status(200).send(blockFound);
    });

    this.app.get("/blockchain/blocks/transactions/:transactionId([a-zA-Z0-9]{64})", (req, res) => {
      const transactionFromBlock = blockchain.getTransactionFromBlocks(req.params.transactionId);

      if (transactionFromBlock === null)
        throw new HTTPError(404, `Transaction "${req.params.transactionId}" not found in any block`);

      res.status(200).send(transactionFromBlock);
    });

    this.app.get("/blockchain/transactions", (req, res) => {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        res.render("blockchain/transactions/index.pug", {
          pageTitle: "Unconfirmed Transactions",
          transactions: blockchain.getAllTransactions()
        });
      } else res.status(200).send(blockchain.getAllTransactions());
    });

    this.app.post("/blockchain/transactions", (req, res) => {
      const requestTransaction = Transaction.fromJson(req.body);
      const transactionFound = blockchain.getTransactionById(requestTransaction.id);

      if (transactionFound !== null)
        throw new HTTPError(409, `Transaction "${requestTransaction.id}" already exists`);

      try {
        const newTransaction = blockchain.addTransaction(requestTransaction);
        res.status(201).send(newTransaction); // eslint-disable-line padding-line-between-statements
      } catch(ex) {
        if (ex instanceof TransactionAssertionError)
          throw new HTTPError(400, ex.message, requestTransaction, ex);
        else
          throw ex;
      }
    });

    this.app.get("/blockchain/transactions/unspent", (req, res) => {
      res.status(200).send(blockchain.getUnspentTransactionsForAddress(req.query.address));
    });

    this.app.get("/operator/wallets", (req, res) => {
      const wallets = operator.getWallets();
      const projectedWallets = R.map(projectWallet, wallets);

      res.status(200).send(projectedWallets);
    });

    this.app.post("/operator/wallets", (req, res) => {
      const password = req.body.password;

      if (R.match(/\w+/g, password).length <= 4)
        throw new HTTPError(400, "Password must contain more than 4 words");

      const newWallet = operator.createWalletFromPassword(password);
      const projectedWallet = projectWallet(newWallet);

      res.status(201).send(projectedWallet);
    });

    this.app.get("/operator/wallets/:walletId", (req, res) => {
      const walletFound = operator.getWalletById(req.params.walletId);

      if (walletFound === null)
        throw new HTTPError(404, `Wallet not found with id "${req.params.walletId}".`);

      const projectedWallet = projectWallet(walletFound);

      res.status(200).send(projectedWallet);
    });

    this.app.post("/operator/wallets/:walletId/transactions", (req, res) => {
      const walletId = req.params.walletId;
      const password = req.headers.password;

      if (password === null)
        throw new HTTPError(401, "Wallet password is missing.");

      const passwordHash = CryptoUtil.hash(password);

      try {
        if (!operator.checkWalletPassword(walletId, passwordHash))
          throw new HTTPError(403, `Invalid password for wallet "${walletId}"`);

        const newTransaction = operator.createTransaction(
          walletId,
          req.body.fromAddress,
          req.body.toAddress,
          req.body.amount,
          req.body.changeAddress || req.body.fromAddress
        );

        newTransaction.check();

        const transactionCreated = blockchain.addTransaction(Transaction.fromJson(newTransaction));

        res.status(201).send(transactionCreated);
      } catch(ex) {
        if (ex instanceof ArgumentError || ex instanceof TransactionAssertionError)
          throw new HTTPError(400, ex.message, walletId, ex);
        else
          throw ex;
      }
    });

    this.app.get("/operator/wallets/:walletId/addresses", (req, res) => {
      const walletId = req.params.walletId;

      try {
        const addresses = operator.getAddressesForWallet(walletId);
        res.status(200).send(addresses); // eslint-disable-line padding-line-between-statements
      } catch(ex) {
        if (ex instanceof ArgumentError)
          throw new HTTPError(400, ex.message, walletId, ex);
        else
          throw ex;
      }
    });

    this.app.post("/operator/wallets/:walletId/addresses", (req, res) => {
      const walletId = req.params.walletId;
      const password = req.headers.password;

      if (password === null)
        throw new HTTPError(401, "Wallet password is missing.");

      const passwordHash = CryptoUtil.hash(password);

      try {
        if (!operator.checkWalletPassword(walletId, passwordHash))
          throw new HTTPError(403, `Invalid password for wallet "${walletId}"`);

        const newAddress = operator.generateAddressForWallet(walletId);

        res.status(201).send({ address: newAddress });
      } catch(ex) {
        if (ex instanceof ArgumentError)
          throw new HTTPError(400, ex.message, walletId, ex);
        else
          throw ex;
      }
    });

    this.app.get("/operator/:addressId/balance", (req, res) => {
      const addressId = req.params.addressId;

      try {
        const balance = operator.getBalanceForAddress(addressId);

        res.status(200).send({ balance });
      } catch(ex) {
        if (ex instanceof ArgumentError)
          throw new HTTPError(404, ex.message, { addressId }, ex);
        else
          throw ex;
      }
    });

    this.app.get("/node/peers", (req, res) => {
      res.status(200).send(node.peers);
    });

    this.app.post("/node/peers", (req, res) => {
      const newPeer = node.connectToPeer(req.body);
      res.status(201).send(newPeer); // eslint-disable-line padding-line-between-statements
    });

    this.app.get("/node/transactions/:transactionId([a-zA-Z0-9]{64})/confirmations", (req, res) => {
      node.getConfirmations(req.params.transactionId)
        .then(confirmations => {
          res.status(200).send({ confirmations: confirmations });
        });
    });

    this.app.post("/miner/mine", (req, res, next) => {
      miner.mine(req.body.rewardAddress, req.body.feeAddress || req.body.rewardAddress)
        .then(newBlock => {
          newBlock = Block.fromJson(newBlock);
          blockchain.addBlock(newBlock);
          res.status(201).send(newBlock);
        })
        .catch(ex => {
          if (ex instanceof BlockAssertionError && ex.message.includes("Invalid index"))
            next(new HTTPError(409, "A new block were added before we were able to mine one"), null, ex);
          else
            next(ex);
        });
    });

    this.app.use(function(err, req, res, next) { // eslint-disable-line no-unused-vars
      if (err instanceof HTTPError)
        res.status(err.status);
      else
        res.status(500);

      res.send(err.message + (err.cause ? " - " + err.cause.message : ""));
    });
  }

  listen(host, port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, err => {
        if (err)
          reject(err);

        console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs`);
        resolve(this);
      });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err)
          reject(err);

        console.info("Closing http");
        resolve(this);
      });
    });
  }
}



//  E X P O R T

export default HttpServer;
