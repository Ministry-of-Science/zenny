"use strict";



//  P A C K A G E

const R = require("ramda");

//  U T I L

const Block = require("./block");



//  P R O G R A M

class Blocks extends Array {
  static fromJson(data) {
    const blocks = new Blocks();

    R.forEach(block => { blocks.push(Block.fromJson(block)); }, data);
    return blocks;
  }
}



//  E X P O R T

module.exports = exports = Blocks;
