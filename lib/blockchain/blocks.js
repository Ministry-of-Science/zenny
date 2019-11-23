"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L

import Block from "./block.js";



//  P R O G R A M

class Blocks extends Array {
  static fromJson(data) {
    const blocks = new Blocks();

    R.forEach(block => { blocks.push(Block.fromJson(block)); }, data);
    return blocks;
  }
}



//  E X P O R T

export default Blocks;
