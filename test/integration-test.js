"use strict"; require("mocha-steps"); require("../lib/util/console-wrapper.js")("integrationTest", 0); /* global describe, it, step */



//  N A T I V E

import assert from "assert";

//  I M P O R T S

import fs from "fs-extra";
import supertest from "supertest";

//  U T I L S

import HttpServer from "../lib/http-server";
import Blockchain from "../lib/blockchain";
import Operator from "../lib/operator";
import Miner from "../lib/miner";
import Node from "../lib/node";

// const logLevel = 0;



//  P R O G R A M

describe("Integration Test", () => {
  const context = {};
  const name1 = "integrationTest1";
  const name2 = "integrationTest2";
  const walletPassword = "t t t t t";

  const createZenny = (name, host, port, peers, removeData = true) => {
    if (removeData)
      fs.removeSync(`data/${name}/`);

    const blockchain = new Blockchain(name);
    const operator = new Operator(name, blockchain);
    const miner = new Miner(blockchain, 0);
    const node = new Node(host, port, peers, blockchain);
    const httpServer = new HttpServer(node, blockchain, operator, miner);

    return httpServer.listen(host, port);
  };

  step("start server 1", () => {
    return createZenny(name1, "localhost", 3001, [])
      .then(httpServer => {
        context.httpServer1 = httpServer;
      });
  });

  step("create wallet", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post("/operator/wallets")
          .send({ password: walletPassword })
          .expect(201);
      })
      .then(res => {
        context.walletId = res.body.id;
      });
  });

  step("create address 1", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post(`/operator/wallets/${context.walletId}/addresses`)
          .set({ password: walletPassword })
          .expect(201);
      })
      .then(res => {
        context.address1 = res.body.address;
      });
  });

  step("create address 2", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post(`/operator/wallets/${context.walletId}/addresses`)
          .set({ password: walletPassword })
          .expect(201);
      })
      .then(res => {
        context.address2 = res.body.address;
      });
  });

  step("mine an empty block", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post("/miner/mine")
          .send({ rewardAddress: context.address1 })
          .expect(201);
      });
  });

  step("create a transaction", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post(`/operator/wallets/${context.walletId}/transactions`)
          .set({ password: walletPassword })
          .send({
            amount: 1000000000,
            changeAddress: context.address1,
            fromAddress: context.address1,
            toAddress: context.address2
          })
          .expect(201);
      })
      .then(res => {
        context.transactionId = res.body.id;
      });
  });

  step("mine a block with transactions", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post("/miner/mine")
          .send({ rewardAddress: context.address1 })
          .expect(201);
      });
  });

  step("check confirmations for the created transaction", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get(`/node/transactions/${context.transactionId}/confirmations`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.confirmations,
              1,
              `Expected confirmations of transaction "${context.transactionId}" to be "1"`
            );
          });
      });
  });

  step("check address 1 balance", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get(`/operator/${context.address1}/balance`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.balance,
              9000000000,
              `Expected balance of address "${context.address1}" to be "9000000000"`
            );
          });
      });
  });

  step("check address 2 balance", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get(`/operator/${context.address2}/balance`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.balance,
              1000000000,
              `Expected balance of address "${context.address2}" to be "1000000000"`
            );
          });
      });
  });

  step("check unspent transaction from address 1", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get("/blockchain/transactions/unspent")
          .query({ address: context.address1 })
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.length,
              3,
              `Expected unspent transactions of address "${context.address1}" to be "3"`
            );
          });
      });
  });

  step("start server 2", () => {
    return createZenny(name2, "localhost", 3002, [{ url: "http://localhost:3001" }])
      .then(httpServer => {
        context.httpServer2 = httpServer;
      });
  });

  step("wait for nodes synchronization", () => {
    return Promise.resolve()
      .then(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 1000); // Wait 1s then resolve.
        });
      });
  });

  step("check blockchain size in server 2", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer2.app)
          .get("/blockchain/blocks")
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.length,
              3,
              "Expected blockchain size of 3 on server 2"
            );
          });
      });
  });

  step("check confirmations from server 1 for the created transaction", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get(`/node/transactions/${context.transactionId}/confirmations`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.confirmations,
              2,
              `Expected confirmations of transaction "${context.transactionId}" to be "2"`
            );
          });
      });
  });

  step("check confirmations from server 2 for the created transaction", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer2.app)
          .get(`/node/transactions/${context.transactionId}/confirmations`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.confirmations,
              2,
              `Expected confirmations of transaction "${context.transactionId}" to be "2"`
            );
          });
      });
  });

  step("create a new transaction", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .post(`/operator/wallets/${context.walletId}/transactions`)
          .set({ password: walletPassword })
          .send({
            amount: 1000000000,
            changeAddress: context.address1,
            fromAddress: context.address1,
            toAddress: context.address2
          })
          .expect(201);
      })
      .then(res => {
        context.transactionId = res.body.id;
      });
  });

  step("wait for nodes synchronization", () => {
    return Promise.resolve()
      .then(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 1000); // wait 1s then resolve
        });
      });
  });

  step("check transactions", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get("/blockchain/transactions")
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.length,
              1,
              `Expected transactions size of "${context.transactionId}" to be "1"`
            );
          });
      })
      .then(res => {
        context.transactionId = res.body.id;
      });
  });

  step("check address 1 balance", () => {
    return Promise.resolve()
      .then(() => {
        return supertest(context.httpServer1.app)
          .get(`/operator/${context.address1}/balance`)
          .expect(200)
          .expect(res => {
            assert.strict.equal(
              res.body.balance,
              7999999999,
              `Expected balance of address "${context.address1}" to be "7999999999"`
            );
          });
      });
  });

  step("stop server 2", () => {
    return Promise.resolve()
      .then(() => context.httpServer2.stop())
      .then(() => {
        fs.removeSync(`data/${name2}/`);
      });
  });

  // Complementary tests to reach untested paths
  describe("Complementary tests", () => {
    step("get wallets", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get("/operator/wallets")
            .expect(200)
            .expect(res => {
              assert.strict.equal(
                res.body.length,
                1,
                "Expected 1 wallet."
              );

              assert.strict.equal(
                res.body[0].addresses.length,
                2,
                "Expected 2 addresses."
              );
            });
        });
    });

    step("get wallet addresses", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get(`/operator/wallets/${context.walletId}/addresses`)
            .expect(200)
            .expect(res => {
              assert.strict.equal(
                res.body.length,
                2,
                "Expected 2 addresses."
              );
            });
        });
    });

    step("get wallet", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get(`/operator/wallets/${context.walletId}`)
            .expect(200)
            .expect(res => {
              assert.strict.equal(
                res.body.addresses.length,
                2,
                "Expected 2 addresses."
              );
            });
        });
    });

    step("restart server 1", () => {
      return Promise.resolve()
        .then(() => context.httpServer1.stop())
        .then(() => {
          return createZenny(name1, "localhost", 3001, [], false)
            .then(httpServer => {
              context.httpServer1 = httpServer;
            });
        });
    });

    step("get latest block", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get("/blockchain/blocks/latest")
            .expect(200);
        })
        .then(res => {
          const { hash, index } = res.body;

          context.latestBlock = {
            hash,
            index
          };
        });
    });

    step("get block by hash", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get(`/blockchain/blocks/${context.latestBlock.hash}`)
            .expect(200)
            .expect(res => {
              assert.strict.equal(
                res.body.hash,
                context.latestBlock.hash,
                `Expected hash of block index "${context.latestBlock.index}" to be "${context.latestBlock.hash}"`
              );
            });
        });
    });

    step("get block by index", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .get(`/blockchain/blocks/${context.latestBlock.index}`)
            .expect(200)
            .expect(res => {
              assert.strict.equal(
                res.body.index,
                context.latestBlock.index,
                `Expected index of block hash "${context.latestBlock.hash}" to be "${context.latestBlock.index}"`
              );
            });
        });
    });

    step("create a new transaction with more value than funds", () => {
      return Promise.resolve()
        .then(() => {
          return supertest(context.httpServer1.app)
            .post(`/operator/wallets/${context.walletId}/transactions`)
            .set({ password: walletPassword })
            .send({
              amount: 8000000000,
              changeAddress: context.address1,
              fromAddress: context.address1,
              toAddress: context.address2
            })
            .expect(400);
        });
    });

    describe("get the pages", () => {
      it("should get the blockchain page", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain")
              .set("Accept", "text/html")
              .expect("Content-Type", /html/)
              .expect(200);
          });
      });

      it("should not get the blockchain json", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain")
              .set("Accept", "application/json")
              .expect(400);
          });
      });

      it("should get the unconfirmed transactions page", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain/transactions")
              .set("Accept", "text/html")
              .expect("Content-Type", /html/)
              .expect(200);
          });
      });
    });

    describe("force errors", () => {
      it("should not get the block by hash", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain/blocks/1111111111111111111111111111111111111111111111111111111111111111")
              .expect(404);
          });
      });

      it("should not get the block by index", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain/blocks/1000")
              .expect(404);
          });
      });

      it("should not get the transaction by ID from the blockchain", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/blockchain/blocks/transactions/1111111111111111111111111111111111111111111111111111111111111111")
              .expect(404);
          });
      });

      it("should not create a wallet with no password", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post("/operator/wallets")
              .send({ password: "" })
              .expect(400);
          });
      });

      it("should not get the wallet", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/operator/wallets/a")
              .expect(404);
          });
      });

      it("should not get the addresses of a inexistent wallet", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/operator/wallets/a/addresses")
              .expect(400);
          });
      });

      it("should not create a transaction with missing password", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post(`/operator/wallets/${context.walletId}/transactions`)
              .send({
                amount: 1000000000,
                changeAddress: context.address1,
                fromAddress: context.address1,
                toAddress: context.address2
              })
              .expect(401);
          });
      });

      it("should not create a transaction with invalid password", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post(`/operator/wallets/${context.walletId}/transactions`)
              .set({ password: "wrong one" })
              .send({
                amount: 1000000000,
                changeAddress: context.address1,
                fromAddress: context.address1,
                toAddress: context.address2
              })
              .expect(403);
          });
      });

      it("should not create a wallet address without a password", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post(`/operator/wallets/${context.walletId}/addresses`)
              .expect(401);
          });
      });

      it("should not create a wallet address with a wrong password", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post(`/operator/wallets/${context.walletId}/addresses`)
              .set({ password: "wrong one" })
              .expect(403);
          });
      });

      it("should not create a wallet address with a wrong wallet ID", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .post("/operator/wallets/A/addresses")
              .set({ password: walletPassword })
              .expect(400);
          });
      });

      it("should not get the address balance because no transactions were found", () => {
        return Promise.resolve()
          .then(() => {
            return supertest(context.httpServer1.app)
              .get("/operator/A/balance")
              .expect(404);
          });
      });
    });

    step("stop server 1", () => {
      return Promise.resolve()
        .then(() => context.httpServer1.stop())
        .then(() => {
          fs.removeSync(`data/${name1}/`);
        });
    });
  });
});
