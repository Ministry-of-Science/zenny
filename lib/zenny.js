"use strict";



//  U T I L S

import Blockchain from "./blockchain/index.js";
import HttpServer from "./http-server/index.js";
import Miner from "./miner/index.js";
import Node from "./node/index.js";
import Operator from "./operator/index.js";



//  E X P O R T

export default (host, port, peers, logLevel, name) => {
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
