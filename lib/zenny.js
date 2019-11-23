"use strict";



//  U T I L S

const Blockchain = require("./blockchain");
const HttpServer = require("./http-server");
const Miner = require("./miner");
const Node = require("./node");
const Operator = require("./operator");



//  E X P O R T

module.exports = exports = function zenny(host, port, peers, logLevel, name) {
  host = process.env.HOST || host || "localhost";
  port = process.env.PORT || process.env.HTTP_PORT || port || 3001;
  peers = (process.env.PEERS ? process.env.PEERS.split(",") : peers || []);
  peers = peers.map((peer) => { return { url: peer }; });
  logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);
  name = process.env.NAME || name || "1";

  require("./util/console-wrapper.js")(name, logLevel);
  console.info(`Starting node ${name}`);

  const blockchain = new Blockchain(name);
  const operator = new Operator(name, blockchain);
  const miner = new Miner(blockchain, logLevel);
  const node = new Node(host, port, peers, blockchain);
  const httpServer = new HttpServer(node, blockchain, operator, miner);

  httpServer.listen(host, port);
};
